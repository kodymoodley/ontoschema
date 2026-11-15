import { describe, expect, it } from 'vitest';
import { canonicalize, parseJsonLd, parseRdfXml, parseTurtle } from '../../tests/fixtures/parseRdf';
import { DOCUMENT_OPTIONS, serialize } from './index';
import { readOntology } from './read';
import { renameClass } from '../ontologymodel';

/**
 * A colleague's file, opened here and saved again.
 *
 * The file says far more than the canvas shows, on purpose: every kind of statement this app
 * has no home for. The claim under test is the one a git workflow depends on — that opening a
 * file and saving it costs the file nothing it said. The writer may add what it always writes
 * (shapes, positions, a range it fills in); it may not take anything away.
 */
const COLLEAGUES_FILE = `
@prefix : <https://example.org/fleet#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .

<https://example.org/fleet> a owl:Ontology ;
  owl:imports <http://xmlns.com/foaf/0.1/> ;
  owl:versionIRI <https://example.org/fleet/1.0> ;
  owl:versionInfo "1.0" ;
  :status "draft" .

:status a owl:AnnotationProperty .

:Vehicle a owl:Class ;
  rdfs:label "Vehicle"@en, "Fahrzeug"@de ;
  skos:definition "Anything that moves people or goods." ;
  :status "stable" .
:Car a owl:Class ; rdfs:subClassOf :Vehicle ; owl:disjointWith :Truck .
:Truck a owl:Class ; rdfs:subClassOf :Vehicle ;
  rdfs:subClassOf [ a owl:Restriction ; owl:onProperty :hasPart ; owl:someValuesFrom :Axle ] .
:Automobile a owl:Class ; owl:equivalentClass :Car ; owl:deprecated "true"^^xsd:boolean .
:Axle a owl:Class .
:Company a owl:Class ; rdfs:subClassOf foaf:Organization .
:Colour a owl:Class ; owl:oneOf ( :Red :Blue ) .
:LegacyThing a rdfs:Class .
foaf:Person a owl:Class .

:hasPart a owl:ObjectProperty, owl:TransitiveProperty ; rdfs:domain :Vehicle ; rdfs:range :Axle .
:ownedBy a owl:ObjectProperty, owl:FunctionalProperty ; rdfs:domain :Vehicle ; rdfs:range :Company ;
  owl:inverseOf :owns .
:owns a owl:ObjectProperty .
:driver a owl:ObjectProperty ; rdfs:domain :Car ; rdfs:range foaf:Person .
:grandparentOf a owl:ObjectProperty ; owl:propertyChainAxiom ( :ownedBy :ownedBy ) .
:mentions a rdf:Property ; rdfs:domain :Vehicle ; rdfs:range :Company .
:weight a owl:DatatypeProperty, owl:FunctionalProperty ; rdfs:domain :Vehicle ; rdfs:range xsd:decimal .
:vin a owl:DatatypeProperty ; rdfs:domain :Car .

:acme a owl:NamedIndividual, :Company ; :weight 12.5 .
:Red a owl:NamedIndividual, :Colour .
:Blue a owl:NamedIndividual, :Colour .
:herbie a :Car ; :ownedBy :acme ; rdfs:label "Herbie" .

:VehicleShape a sh:NodeShape ; sh:targetClass :Vehicle ;
  sh:property [ sh:path :ownedBy ; sh:class :Company ; sh:minCount 1 ; sh:maxCount 1 ] ;
  sh:property :VehicleWeight .
:VehicleWeight a sh:PropertyShape ; sh:path :weight ; sh:datatype xsd:decimal ; sh:maxCount 1 .
`;

const FLEET = 'https://example.org/fleet#';
const SH = 'http://www.w3.org/ns/shacl#';

const graph = (turtle: string) => canonicalize(parseTurtle(turtle));

async function openAndSave(text: string) {
  const { ontology } = await readOntology(text, 'turtle');
  return { ontology, saved: serialize(ontology, 'turtle', 'fleet', DOCUMENT_OPTIONS).content };
}

describe('a colleague’s file, opened and saved without an edit', () => {
  /*
   * An inline shape is the one place the file is reworded rather than kept: the writer names
   * every shape it generates, so the colleague's inline property shape becomes
   * `fleet:Vehicle_ownedBy`, and the report says so. What it said is checked on that shape below.
   * Their named shape, `fleet:VehicleWeight`, keeps its name, and is covered here.
   */
  it('still says everything it said, its inline shape aside', async () => {
    const { saved } = await openAndSave(COLLEAGUES_FILE);

    const kept = new Set(graph(saved));
    const missing = graph(COLLEAGUES_FILE).filter((statement) => !kept.has(statement));
    const inlineShape = (statement: string) => statement.includes('_:') && statement.includes(SH);
    expect(missing.filter((statement) => !inlineShape(statement))).toEqual([]);
  });

  it('keeps every constraint of a shape, on the shape the writer names', async () => {
    const saved = parseTurtle((await openAndSave(COLLEAGUES_FILE)).saved);
    const said = (subject: string) =>
      saved
        .filter((quad) => quad.subject.value === subject)
        .map((quad) => `${quad.predicate.value} ${quad.object.value}`);

    const shape = saved
      .filter(
        (quad) =>
          quad.subject.value === `${FLEET}VehicleShape` && quad.predicate.value === `${SH}property`,
      )
      .map((quad) => quad.object.value)
      .find((candidate) => said(candidate).includes(`${SH}path ${FLEET}ownedBy`));
    expect(said(shape!)).toEqual(
      expect.arrayContaining([
        `${SH}path ${FLEET}ownedBy`,
        `${SH}class ${FLEET}Company`,
        `${SH}minCount 1`,
        `${SH}maxCount 1`,
      ]),
    );
  });

  it('calls other vocabularies what the file called them', async () => {
    const { saved } = await openAndSave(COLLEAGUES_FILE);

    expect(saved).toContain('@prefix foaf: <http://xmlns.com/foaf/0.1/>');
    expect(saved).toContain('foaf:Person a owl:Class');
  });

  it('says which shapes are saved with a name they did not have', async () => {
    const { report } = await readOntology(COLLEAGUES_FILE, 'turtle');

    expect(report.shapesNamed).toEqual(['Vehicle_ownedBy']);
  });

  it('comes out the same when saved a second time', async () => {
    const once = (await openAndSave(COLLEAGUES_FILE)).saved;
    const twice = (await openAndSave(once)).saved;

    expect(graph(twice)).toEqual(graph(once));
  });

  it('is the same graph in every format the app writes', async () => {
    const { ontology } = await openAndSave(COLLEAGUES_FILE);
    const write = (format: 'turtle' | 'rdfxml' | 'jsonld') =>
      serialize(ontology, format, 'fleet', DOCUMENT_OPTIONS).content;

    const turtle = canonicalize(parseTurtle(write('turtle')));
    expect(canonicalize(await parseRdfXml(write('rdfxml')))).toEqual(turtle);
    expect(canonicalize(await parseJsonLd(write('jsonld')))).toEqual(turtle);
  });
});

describe('a colleague’s file, edited and saved', () => {
  it('carries what the canvas does not show over a rename', async () => {
    const { ontology } = await readOntology(COLLEAGUES_FILE, 'turtle');
    const company = ontology.classes.find((entity) => entity.localName === 'Company');

    const renamed = renameClass(ontology, company!.id, 'Firm');
    const saved = graph(serialize(renamed, 'turtle', 'fleet', DOCUMENT_OPTIONS).content);

    const fleet = (name: string) => `<https://example.org/fleet#${name}>`;
    const rdfType = '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>';
    expect(saved).toContain(`${fleet('acme')} ${rdfType} ${fleet('Firm')} .`);
    expect(saved.some((statement) => statement.includes(fleet('Company')))).toBe(false);
  });
});
