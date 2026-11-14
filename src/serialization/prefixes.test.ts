import { describe, expect, it } from 'vitest';
import { createEmptyOntology } from '../ontologymodel';
import type { Ontology, Triple } from '../ontologymodel';
import { prefixesFor } from './prefixes';

/**
 * The names a saved file gives namespaces.
 *
 * A file opened here and saved again should read the way its author wrote it, which includes
 * calling Dublin Core `dc:` if that is what they called it.
 */

const FLEET = 'https://example.org/fleet/';
const DCTERMS = 'http://purl.org/dc/terms/';
const FOAF = 'http://xmlns.com/foaf/0.1/';

const fleet = (prefixes: Record<string, string>): Ontology => ({
  ...createEmptyOntology(FLEET, 'fleet'),
  prefixes,
});

/** One statement mentioning each namespace given, so each counts as used. */
const mentioning = (...namespaces: string[]): Triple[] =>
  namespaces.map((namespace) => ({
    subject: `${FLEET}thing`,
    predicate: `${namespace}term`,
    object: { type: 'literal', value: 'x' },
  }));

describe('the prefixes a file is written with', () => {
  it('names a namespace the way the document it came from did', () => {
    const table = prefixesFor(fleet({ dc: DCTERMS, foaf: FOAF }), mentioning(DCTERMS, FOAF));

    expect(table.dc).toBe(DCTERMS);
    expect(table.foaf).toBe(FOAF);
    expect(table.dcterms).toBeUndefined();
  });

  it('declares nothing the file does not use', () => {
    const table = prefixesFor(fleet({ foaf: FOAF }), mentioning(DCTERMS));

    expect(table.foaf).toBeUndefined();
    expect(table.dcterms).toBe(DCTERMS);
  });

  it('keeps the ontology’s own prefix on its own namespace, whatever the document said', () => {
    const table = prefixesFor(fleet({ f: FLEET, fleet: FOAF }), mentioning(FOAF));

    expect(table.fleet).toBe(FLEET);
    expect(table.f).toBeUndefined();
    expect(Object.values(table).filter((iri) => iri === FOAF)).toEqual([]);
  });

  /* Turtle allows it; RDF/XML has no way to write it. */
  it('passes over the empty prefix', () => {
    const table = prefixesFor(fleet({ '': FOAF }), mentioning(FOAF));

    expect(table['']).toBeUndefined();
  });
});
