import { describe, expect, it } from 'vitest';
import {
  allScenarios,
  AWKWARD_TEXT,
  buildLarge,
  buildMultilingual,
} from '../../tests/fixtures/scenarios';
import {
  canonicalize,
  hasBlankNodes,
  parseJsonLd,
  parseRdfXml,
  parseTurtle,
} from '../../tests/fixtures/parseRdf';
import { ontologyToTriples } from '../ontologymodel';
import { serialize } from './index';
import { serializeJsonLd } from './jsonld';
import { serializeRdfXml } from './rdfxml';
import { serializeTurtle } from './turtle';

/**
 * The three writers hand-render the same triple list, so the only honest check is to parse
 * each back with an independent parser and compare the graphs. Run against every awkward
 * shape, this is what stops one writer quietly diverging on escapes, scripts or scale.
 */
describe.each(allScenarios())('$name', ({ ontology }) => {
  it('produces the same graph in Turtle, RDF/XML and JSON-LD', async () => {
    const turtle = canonicalize(parseTurtle(serializeTurtle(ontology)));
    const rdfxml = canonicalize(await parseRdfXml(serializeRdfXml(ontology)));
    const jsonld = canonicalize(await parseJsonLd(serializeJsonLd(ontology)));

    expect(rdfxml).toEqual(turtle);
    expect(jsonld).toEqual(turtle);
  });

  it('parses back to exactly the triples the model produced', () => {
    const quads = parseTurtle(serializeTurtle(ontology));
    expect(quads).toHaveLength(ontologyToTriples(ontology).length);
  });

  it('uses no blank nodes, so nothing depends on collection support', async () => {
    expect(hasBlankNodes(parseTurtle(serializeTurtle(ontology)))).toBe(false);
    expect(hasBlankNodes(await parseRdfXml(serializeRdfXml(ontology)))).toBe(false);
  });

  it('agrees across the layers, whichever are selected', async () => {
    for (const options of [
      { includeShapes: false },
      { includeAxioms: false },
      { includeAxioms: true, includeShapes: true },
    ]) {
      const turtle = canonicalize(parseTurtle(serializeTurtle(ontology, options)));
      const rdfxml = canonicalize(await parseRdfXml(serializeRdfXml(ontology, options)));
      expect(rdfxml, JSON.stringify(options)).toEqual(turtle);
    }
  });
});

describe('text that breaks naive writers', () => {
  const { ontology } = buildMultilingual();

  it('carries every awkward value through all three formats unchanged', async () => {
    const fromTurtle = parseTurtle(serializeTurtle(ontology));
    const fromXml = await parseRdfXml(serializeRdfXml(ontology));
    const fromJson = await parseJsonLd(serializeJsonLd(ontology));

    for (const expected of Object.values(AWKWARD_TEXT)) {
      for (const [format, quads] of [
        ['turtle', fromTurtle],
        ['rdf/xml', fromXml],
        ['json-ld', fromJson],
      ] as const) {
        expect(
          quads.some((quad) => quad.object.value === expected),
          `${format} lost or altered ${JSON.stringify(expected.slice(0, 40))}`,
        ).toBe(true);
      }
    }
  });

  /*
   * Casing used to differ between the writers — the hand-written pair kept BCP 47's
   * conventional form while n3 lowercased on the way out — and there were tests here recording
   * that. It cannot happen now: a tag is two lowercase letters, so there is no case to fold and
   * no subtag to preserve. What is still worth checking is that all three writers agree.
   */
  it('writes the same language tags in every format', () => {
    const tags = (quads: Awaited<ReturnType<typeof parseRdfXml>>) =>
      quads
        .filter((quad) => quad.object.termType === 'Literal' && quad.object.language)
        .map((quad) => (quad.object.termType === 'Literal' ? quad.object.language : ''))
        .sort();

    const fromTurtle = tags(parseTurtle(serializeTurtle(ontology)));
    expect(fromTurtle).toContain('zh');
    expect(fromTurtle).toContain('ko');
    expect(fromTurtle.every((tag) => /^[a-z]{2}$/.test(tag))).toBe(true);

    return Promise.all([
      parseRdfXml(serializeRdfXml(ontology)),
      parseJsonLd(serializeJsonLd(ontology)),
    ]).then(([rdfxml, jsonld]) => {
      expect(tags(rdfxml)).toEqual(fromTurtle);
      expect(tags(jsonld)).toEqual(fromTurtle);
    });
  });

  it('escapes markup rather than emitting XML that cannot be read', () => {
    const xml = serializeRdfXml(ontology);
    expect(xml).toContain('&lt;heavy&gt;');
    expect(xml).toContain('&amp;');
    expect(xml).not.toMatch(/<[^>]*<heavy>/);
  });

  it('keeps a 2,000 character value intact', () => {
    const quads = parseTurtle(serializeTurtle(ontology));
    expect(quads.some((quad) => quad.object.value.length === 2_000)).toBe(true);
  });
});

describe('at scale', () => {
  const ontology = buildLarge(150);

  it('serialises and re-parses a large schema in every format', async () => {
    const turtle = canonicalize(parseTurtle(serialize(ontology, 'turtle').content));
    expect(turtle.length).toBeGreaterThan(1_000);
    expect(canonicalize(await parseRdfXml(serialize(ontology, 'rdfxml').content))).toEqual(turtle);
    expect(canonicalize(await parseJsonLd(serialize(ontology, 'jsonld').content))).toEqual(turtle);
  });

  it('declares each namespace once, however many entities use it', () => {
    const turtle = serialize(ontology, 'turtle').content;
    const declarations = [...turtle.matchAll(/@prefix\s+(\w+):/g)].map((match) => match[1]);
    expect(new Set(declarations).size).toBe(declarations.length);
  });
});
