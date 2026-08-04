import { describe, expect, it } from 'vitest';
import { buildAutoOntology, buildReusedOntology } from '../../tests/fixtures/autoOntology';
import {
  canonicalize,
  hasBlankNodes,
  parseJsonLd,
  parseRdfXml,
  parseTurtle,
} from '../../tests/fixtures/parseRdf';
import {
  addAnnotation,
  addClass,
  createEmptyOntology,
  ontologyToTriples,
  renameClass,
  deleteClass,
} from '../ontologymodel';
import { SERIALIZATION_FORMATS, sanitizeFilename, serialize } from './index';
import { serializeJsonLd } from './jsonld';
import { serializeRdfXml } from './rdfxml';
import { serializeTurtle } from './turtle';

const { ontology: auto, ids } = buildAutoOntology();

describe('Turtle', () => {
  const turtle = serializeTurtle(auto);

  it('declares the prefixes it uses', () => {
    expect(turtle).toContain('@prefix auto: <https://example.org/auto/>');
    expect(turtle).toContain('@prefix skos: <http://www.w3.org/2004/02/skos/core#>');
    expect(turtle).toContain('@prefix owl: <http://www.w3.org/2002/07/owl#>');
  });

  it('does not declare namespaces the ontology never uses', () => {
    expect(turtle).not.toContain('http://www.w3.org/ns/prov#');
  });

  it('writes language-tagged literals', () => {
    expect(turtle).toMatch(/"Car"@en/);
    expect(turtle).toMatch(/"Auto"@nl/);
  });

  it('parses back to exactly the triples the model produced', () => {
    const quads = parseTurtle(turtle);
    expect(quads).toHaveLength(ontologyToTriples(auto).length);
    expect(hasBlankNodes(quads)).toBe(false);
  });
});

describe('RDF/XML', () => {
  const xml = serializeRdfXml(auto);

  it('starts with an XML declaration and an rdf:RDF root', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rdf:RDF');
    expect(xml.trimEnd().endsWith('</rdf:RDF>')).toBe(true);
  });

  it('uses typed node elements, the shape ontology tools expect', () => {
    expect(xml).toContain('<owl:Class rdf:about="https://example.org/auto/Car">');
    expect(xml).toContain('<owl:ObjectProperty rdf:about="https://example.org/auto/offeredBy">');
    expect(xml).toContain('<owl:DatatypeProperty rdf:about="https://example.org/auto/price">');
  });

  it('writes language tags as xml:lang', () => {
    expect(xml).toContain('xml:lang="nl"');
  });

  it('parses back to exactly the triples the model produced', async () => {
    const quads = await parseRdfXml(xml);
    expect(quads).toHaveLength(ontologyToTriples(auto).length);
  });

  it('escapes markup in annotation values instead of emitting broken XML', async () => {
    const withMarkup = addAnnotation(
      auto,
      'class',
      ids.truck,
      'rdfs:comment',
      'A <heavy> "goods" vehicle & trailer',
    );
    const output = serializeRdfXml(withMarkup);
    expect(output).toContain('A &lt;heavy&gt; "goods" vehicle &amp; trailer');

    const quads = await parseRdfXml(output);
    expect(quads.some((quad) => quad.object.value === 'A <heavy> "goods" vehicle & trailer')).toBe(
      true,
    );
  });

  it('escapes ampersands inside an IRI-valued annotation', async () => {
    const withAmpersand = addAnnotation(
      auto,
      'class',
      ids.truck,
      'rdfs:seeAlso',
      'https://example.org/lookup?make=man&model=tgx',
    );
    const output = serializeRdfXml(withAmpersand);
    expect(output).toContain('make=man&amp;model=tgx');

    const quads = await parseRdfXml(output);
    const seeAlso = quads.find(
      (quad) => quad.predicate.value === 'http://www.w3.org/2000/01/rdf-schema#seeAlso',
    );
    expect(seeAlso?.object.termType).toBe('NamedNode');
    expect(seeAlso?.object.value).toBe('https://example.org/lookup?make=man&model=tgx');
  });

  it('demotes a malformed IRI to a literal rather than emitting an unparseable document', async () => {
    const withBrokenIri = addAnnotation(
      auto,
      'class',
      ids.truck,
      'rdfs:seeAlso',
      'https://example.org/a"b c',
    );
    const quads = await parseRdfXml(serializeRdfXml(withBrokenIri));
    const seeAlso = quads.find(
      (quad) => quad.predicate.value === 'http://www.w3.org/2000/01/rdf-schema#seeAlso',
    );
    expect(seeAlso?.object.termType).toBe('Literal');
    expect(seeAlso?.object.value).toBe('https://example.org/a"b c');
  });
});

describe('JSON-LD', () => {
  const jsonld = serializeJsonLd(auto);

  it('is valid JSON with a context and a graph', () => {
    const parsed = JSON.parse(jsonld) as Record<string, unknown>;
    expect(parsed['@context']).toBeTypeOf('object');
    expect(Array.isArray(parsed['@graph'])).toBe(true);
  });

  it('compacts IRIs against the declared prefixes', () => {
    const parsed = JSON.parse(jsonld) as { '@graph': Record<string, unknown>[] };
    const car = parsed['@graph'].find((node) => node['@id'] === 'auto:Car');
    expect(car).toBeDefined();
    expect(car?.['@type']).toBe('owl:Class');
  });

  it('collects repeated predicates into an array', () => {
    const parsed = JSON.parse(jsonld) as { '@graph': Record<string, unknown>[] };
    const car = parsed['@graph'].find((node) => node['@id'] === 'auto:Car');
    expect(Array.isArray(car?.['skos:prefLabel'])).toBe(true);
    expect(car?.['skos:prefLabel']).toEqual([
      { '@value': 'Car', '@language': 'en' },
      { '@value': 'Auto', '@language': 'nl' },
    ]);
  });

  it('parses back to exactly the triples the model produced', async () => {
    const quads = await parseJsonLd(jsonld);
    expect(quads).toHaveLength(ontologyToTriples(auto).length);
  });
});

describe('the four exports are semantically identical', () => {
  it('produces the same graph in Turtle, RDF/XML, .owl and JSON-LD', async () => {
    const turtle = canonicalize(parseTurtle(serialize(auto, 'turtle').content));
    const rdfxml = canonicalize(await parseRdfXml(serialize(auto, 'rdfxml').content));
    const owl = canonicalize(await parseRdfXml(serialize(auto, 'owl').content));
    const jsonld = canonicalize(await parseJsonLd(serialize(auto, 'jsonld').content));

    expect(rdfxml).toEqual(turtle);
    expect(owl).toEqual(turtle);
    expect(jsonld).toEqual(turtle);
    expect(turtle.length).toBe(ontologyToTriples(auto).length);
  });

  it('.rdf and .owl are byte-identical, differing only in filename', () => {
    const rdf = serialize(auto, 'rdfxml', 'auto');
    const owl = serialize(auto, 'owl', 'auto');
    expect(owl.content).toBe(rdf.content);
    expect(rdf.filename).toBe('auto.rdf');
    expect(owl.filename).toBe('auto.owl');
  });

  it('stays identical after a rename and a cascading delete', async () => {
    const edited = deleteClass(renameClass(auto, ids.car, 'Automobile'), ids.truck);
    const turtle = canonicalize(parseTurtle(serializeTurtle(edited)));
    const rdfxml = canonicalize(await parseRdfXml(serializeRdfXml(edited)));
    const jsonld = canonicalize(await parseJsonLd(serializeJsonLd(edited)));

    expect(rdfxml).toEqual(turtle);
    expect(jsonld).toEqual(turtle);
    expect(turtle.some((line) => line.includes('/Automobile'))).toBe(true);
    expect(turtle.some((line) => line.includes('/Truck'))).toBe(false);
  });
});

describe('empty ontology', () => {
  const empty = createEmptyOntology('https://example.org/blank/', 'blank');

  it('exports valid documents in every format', async () => {
    const turtle = parseTurtle(serializeTurtle(empty));
    const rdfxml = await parseRdfXml(serializeRdfXml(empty));
    const jsonld = await parseJsonLd(serializeJsonLd(empty));

    for (const quads of [turtle, rdfxml, jsonld]) {
      expect(quads).toHaveLength(1);
      expect(quads[0]?.subject.value).toBe('https://example.org/blank');
      expect(quads[0]?.object.value).toBe('http://www.w3.org/2002/07/owl#Ontology');
    }
  });
});

describe('awkward but legal input', () => {
  it('handles a class named with an underscore and digits', async () => {
    const withOdd = addClass(createEmptyOntology('https://example.org/x/', 'x'), {
      localName: '_3Series',
    });
    const quads = await parseRdfXml(serializeRdfXml(withOdd.ontology));
    expect(quads.some((quad) => quad.subject.value === 'https://example.org/x/_3Series')).toBe(
      true,
    );
  });

  it('handles a namespace that ends in a hash', async () => {
    const hashed = addClass(createEmptyOntology('https://example.org/x#', 'x'), {
      localName: 'Car',
    });
    const turtle = canonicalize(parseTurtle(serializeTurtle(hashed.ontology)));
    const jsonld = canonicalize(await parseJsonLd(serializeJsonLd(hashed.ontology)));
    expect(jsonld).toEqual(turtle);
    expect(turtle.some((line) => line.startsWith('<https://example.org/x#Car>'))).toBe(true);
  });

  it('carries newlines and unicode through every format', async () => {
    const annotated = addAnnotation(
      auto,
      'class',
      ids.truck,
      'skos:definition',
      'Line one\nLine two — with an em dash and 汉字',
      'en',
    );
    const turtle = canonicalize(parseTurtle(serializeTurtle(annotated)));
    const rdfxml = canonicalize(await parseRdfXml(serializeRdfXml(annotated)));
    const jsonld = canonicalize(await parseJsonLd(serializeJsonLd(annotated)));
    expect(rdfxml).toEqual(turtle);
    expect(jsonld).toEqual(turtle);
  });
});

describe('SHACL shapes travel inside the same documents', () => {
  const { ontology: reused } = buildReusedOntology();

  it('writes shapes as ordinary RDF in Turtle', () => {
    const turtle = serializeTurtle(reused);
    expect(turtle).toContain('@prefix sh: <http://www.w3.org/ns/shacl#>');
    expect(turtle).toContain('auto:CarShape a sh:NodeShape');
    expect(turtle).toMatch(/sh:targetClass auto:Car/);
  });

  it('round-trips the shapes through every serialization identically', async () => {
    const turtle = canonicalize(parseTurtle(serialize(reused, 'turtle').content));
    const rdfxml = canonicalize(await parseRdfXml(serialize(reused, 'rdfxml').content));
    const jsonld = canonicalize(await parseJsonLd(serialize(reused, 'jsonld').content));

    expect(rdfxml).toEqual(turtle);
    expect(jsonld).toEqual(turtle);
    expect(turtle.some((line) => line.includes('shacl#targetClass'))).toBe(true);
  });

  it('contains no blank nodes, so nothing depends on collection support', async () => {
    expect(hasBlankNodes(parseTurtle(serializeTurtle(reused)))).toBe(false);
    expect(hasBlankNodes(await parseRdfXml(serializeRdfXml(reused)))).toBe(false);
    expect(hasBlankNodes(await parseJsonLd(serializeJsonLd(reused)))).toBe(false);
  });

  it('drops the shapes but keeps the axioms when asked for axioms only', () => {
    const turtle = serializeTurtle(reused, { includeShapes: false });
    expect(turtle).not.toContain('sh:NodeShape');
    expect(turtle).toContain('a owl:Class');
  });

  it('drops the axioms but keeps the shapes when asked for shapes only', () => {
    const turtle = serializeTurtle(reused, { includeAxioms: false });
    expect(turtle).toContain('sh:NodeShape');
    expect(turtle).not.toContain('a owl:Class');
    // The ontology header is always written, whichever layers are selected.
    expect(turtle).toContain('a owl:Ontology');
  });

  it('still writes the ontology header and its metadata with both layers off', () => {
    // Ontology-level metadata belongs to neither layer, so it always survives.
    const quads = parseTurtle(
      serializeTurtle(reused, { includeAxioms: false, includeShapes: false }),
    );
    expect(quads.every((quad) => quad.subject.value === 'https://example.org/auto')).toBe(true);
    expect(quads.some((quad) => quad.predicate.value === 'http://purl.org/dc/terms/title')).toBe(
      true,
    );
  });
});

describe('download descriptors', () => {
  it('offers all four formats with distinct extensions', () => {
    expect(SERIALIZATION_FORMATS.map((f) => f.extension)).toEqual(['ttl', 'rdf', 'owl', 'jsonld']);
  });

  it('names the file after the project and its format', () => {
    expect(serialize(auto, 'turtle', 'Automotive Schema').filename).toBe('Automotive-Schema.ttl');
    expect(serialize(auto, 'jsonld', 'auto').mimeType).toBe('application/ld+json');
  });

  it('falls back to a safe filename when the project name has nothing usable', () => {
    expect(sanitizeFilename('   ***   ')).toBe('ontology');
    expect(sanitizeFilename('my/project:v2')).toBe('my-project-v2');
  });
});
