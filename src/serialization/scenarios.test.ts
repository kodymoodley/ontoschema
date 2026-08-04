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
   * The two hand-written writers keep BCP 47's conventional casing; n3 lowercases language
   * tags on the way out. RDF 1.1 defines tags as case-insensitive, so the graphs are
   * identical either way — which the isomorphism checks above already prove — but the files
   * differ visibly, and that is worth knowing rather than discovering.
   */
  it('keeps conventional tag casing in RDF/XML and JSON-LD', () => {
    expect(serializeRdfXml(ontology)).toContain('xml:lang="zh-Hant-TW"');
    expect(serializeRdfXml(ontology)).toContain('xml:lang="en-GB"');
    expect(serializeJsonLd(ontology)).toContain('"@language": "zh-Hant-TW"');
  });

  it('lowercases them in Turtle, which is n3 normalising rather than losing information', () => {
    const turtle = serializeTurtle(ontology);
    expect(turtle).toContain('@zh-hant-tw');
    expect(turtle).not.toContain('@zh-Hant-TW');
    // The subtags all survive; only their case is folded.
    expect(turtle).toContain('@en-gb');
  });

  it('carries the same set of language tags through every format', async () => {
    /*
     * Compared case-insensitively: RDF 1.1 defines language tags that way, and the parsers
     * differ on how they normalise — n3 lowercases on read, the RDF/XML parser does not.
     */
    const tags = (quads: Awaited<ReturnType<typeof parseRdfXml>>) =>
      quads
        .filter((quad) => quad.object.termType === 'Literal' && quad.object.language)
        .map((quad) =>
          quad.object.termType === 'Literal' ? quad.object.language.toLowerCase() : '',
        )
        .sort();

    const fromTurtle = tags(parseTurtle(serializeTurtle(ontology)));
    expect(fromTurtle).toContain('zh-hant-tw');
    expect(fromTurtle).toContain('en-gb');
    expect(tags(await parseRdfXml(serializeRdfXml(ontology)))).toEqual(fromTurtle);
    expect(tags(await parseJsonLd(serializeJsonLd(ontology)))).toEqual(fromTurtle);
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
