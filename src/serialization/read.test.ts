import { describe, expect, it } from 'vitest';
import { buildAutoOntology, buildReusedOntology } from '../../tests/fixtures/autoOntology';
import { allScenarios } from '../../tests/fixtures/scenarios';
import type { Ontology } from '../ontologymodel';
import { serialize } from './index';
import { formatForFilename, parseDocument, readOntology } from './read';

/**
 * Reading a document from text, in both syntaxes the app writes.
 *
 * The measure of success is that a file this app produced comes back as the schema it was
 * produced from, and that Turtle and RDF/XML agree — they are two renderings of one graph, so
 * a difference between them is a bug in one of the writers or one of the readers.
 */

const names = (ontology: Ontology) => ontology.classes.map((entity) => entity.localName).sort();

describe('recognising a file by its name', () => {
  it.each([
    ['schema.ttl', 'turtle'],
    ['SCHEMA.TTL', 'turtle'],
    ['schema.rdf', 'rdfxml'],
    ['schema.owl', 'rdfxml'],
  ])('reads %s as %s', (filename, format) => {
    expect(formatForFilename(filename)).toBe(format);
  });

  it.each(['notes.txt', 'schema', 'backup.json', 'diagram.mmd'])(
    'does not claim to know what %s is',
    (filename) => {
      expect(formatForFilename(filename)).toBeUndefined();
    },
  );
});

describe('a document this app wrote', () => {
  const { ontology } = buildAutoOntology();

  it('comes back from Turtle as the schema it was written from', async () => {
    const turtle = serialize(ontology, 'turtle', 'auto', { includeShapes: false }).content;
    const { ontology: restored } = await readOntology(turtle, 'turtle');

    expect(names(restored)).toEqual(names(ontology));
    expect(restored.iri).toBe(ontology.iri);
    // The prefix survives only because Turtle declares it; nothing in the triples carries it.
    expect(restored.prefix).toBe(ontology.prefix);
  });

  it('comes back from RDF/XML saying the same thing', async () => {
    const rdfxml = serialize(ontology, 'rdfxml', 'auto', { includeShapes: false }).content;
    const { ontology: restored } = await readOntology(rdfxml, 'rdfxml');

    expect(names(restored)).toEqual(names(ontology));
    expect(restored.iri).toBe(ontology.iri);
    // Read out of the xmlns declarations, since RDF/XML reports no prefixes of its own.
    expect(restored.prefix).toBe(ontology.prefix);
  });

  it('keeps the positions, which is what makes reopening a file useful', async () => {
    const turtle = serialize(ontology, 'turtle', 'auto').content;
    const { ontology: restored } = await readOntology(turtle, 'turtle');

    const placed = restored.classes.find((entity) => entity.localName === 'Car');
    const original = ontology.classes.find((entity) => entity.localName === 'Car');
    expect(placed?.position).toEqual(original?.position);
  });

  it('keeps a language tag through both syntaxes', async () => {
    for (const format of ['turtle', 'rdfxml'] as const) {
      const document = serialize(ontology, format, 'auto', { includeShapes: false }).content;
      const { ontology: restored } = await readOntology(document, format);
      const car = restored.classes.find((entity) => entity.localName === 'Car');

      expect(car?.annotations.some((annotation) => annotation.language === 'nl')).toBe(true);
    }
  });
});

/*
 * Turtle and RDF/XML render one graph, so what comes back from them must be the same schema.
 * Checked over every awkward fixture the suite has, since the two writers escape text, name
 * blank nodes and abbreviate IRIs by quite different rules.
 */
describe.each(allScenarios())('$name, through both syntaxes', ({ ontology }) => {
  it('reads back the same classes, attributes and relations either way', async () => {
    const fromTurtle = await readOntology(
      serialize(ontology, 'turtle', 'x', { includeShapes: false }).content,
      'turtle',
    );
    const fromRdfXml = await readOntology(
      serialize(ontology, 'rdfxml', 'x', { includeShapes: false }).content,
      'rdfxml',
    );

    const summary = (model: Ontology) => ({
      classes: names(model),
      attributes: model.attributes.map((entity) => `${entity.localName}:${entity.range}`).sort(),
      relations: model.relations.map((entity) => entity.localName).sort(),
      usages: model.usages.length,
    });

    expect(summary(fromRdfXml.ontology)).toEqual(summary(fromTurtle.ontology));
    expect(fromRdfXml.report).toEqual(fromTurtle.report);
  });
});

describe('the shapes a document may arrive in', () => {
  it('ignores the SHACL shapes that ride alongside, without tripping over them', async () => {
    const { ontology } = buildReusedOntology();
    // Written with both layers, which is what an export from this app contains by default.
    const withShapes = serialize(ontology, 'turtle', 'auto').content;
    const { ontology: restored, report } = await readOntology(withShapes, 'turtle');

    expect(names(restored)).toEqual(names(ontology));
    // A node shape is a subject typed `sh:NodeShape`, which is not something this app models.
    expect(report.individuals).toBeGreaterThan(0);
    expect(restored.classes.some((entity) => entity.localName.includes('Shape'))).toBe(false);
  });

  it('refuses a document that is not Turtle rather than reading it as empty', async () => {
    await expect(readOntology('this is certainly not turtle {{{', 'turtle')).rejects.toThrow();
  });

  it('refuses a document that is not RDF/XML', async () => {
    await expect(readOntology('<not-really><unclosed>', 'rdfxml')).rejects.toThrow();
  });

  it('reads a document written by hand, with no prefix declared for its own namespace', async () => {
    const turtle = `
      @prefix owl: <http://www.w3.org/2002/07/owl#>.
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
      <https://example.org/hand/Car> a owl:Class; rdfs:label "Car".
      <https://example.org/hand/Wheel> a owl:Class.
      <https://example.org/hand/hasWheel> a owl:ObjectProperty;
        rdfs:domain <https://example.org/hand/Car>;
        rdfs:range <https://example.org/hand/Wheel>.
    `;
    const { ontology } = await readOntology(turtle, 'turtle');

    expect(names(ontology)).toEqual(['Car', 'Wheel']);
    expect(ontology.iri).toBe('https://example.org/hand/');
    expect(ontology.relations.map((entity) => entity.localName)).toEqual(['hasWheel']);
    expect(ontology.usages).toHaveLength(1);
  });
});

describe('the prefixes a document declares', () => {
  it('collects them from Turtle', async () => {
    const { prefixes } = await parseDocument(
      '@prefix auto: <https://example.org/auto/>.\nauto:Car a auto:Thing.',
      'turtle',
    );
    expect(prefixes.auto).toBe('https://example.org/auto/');
  });

  it('collects them from the xmlns declarations of an RDF/XML document', async () => {
    const { ontology } = buildAutoOntology();
    const rdfxml = serialize(ontology, 'rdfxml', 'auto').content;
    const { prefixes } = await parseDocument(rdfxml, 'rdfxml');

    expect(prefixes.auto).toBe('https://example.org/auto/');
    expect(prefixes.owl).toBe('http://www.w3.org/2002/07/owl#');
  });
});
