import { describe, expect, it } from 'vitest';
import { has, objectsOf } from '../../tests/fixtures/readTriples';
import {
  addClass,
  addRelation,
  attachProperty,
  deleteClass,
  detachUsage,
  renameClass,
} from './mutations';
import { createEmptyOntology } from './ontology';
import { blank, iri, literal, ontologyToTriples } from './triples';
import type { Triple } from './triples';
import type { Ontology } from './types';
import { ONTOLOGY_REF, entityRef, nodeShapeRef, propertyShapeRef, setAside } from './unmodelled';

/**
 * Statements the model does not hold, kept and written back.
 *
 * Driven through the writer and the real mutations, because the claim is about what a saved
 * file says after someone has edited the schema, not about the bookkeeping on its own.
 */

const FLEET = 'https://example.org/fleet/';
const OWL = 'http://www.w3.org/2002/07/owl#';
const SH = 'http://www.w3.org/ns/shacl#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDFS_SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
const RDF_FIRST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first';
const RDF_REST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest';
const RDF_NIL = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

const say = (subject: string, predicate: string, object: Triple['object']): Triple => ({
  subject,
  predicate,
  object,
});

type Ids = Record<'car' | 'truck' | 'company' | 'ownedBy' | 'usage', string>;

/** Car and Truck, with `Car ownedBy Company` drawn, and whatever kept statements are given. */
function fleet(kept: (ids: Ids) => Triple[]) {
  let ontology = createEmptyOntology(FLEET, 'fleet');
  const car = addClass(ontology, { localName: 'Car' });
  const truck = addClass(car.ontology, { localName: 'Truck' });
  const company = addClass(truck.ontology, { localName: 'Company' });
  const ownedBy = addRelation(company.ontology, { localName: 'ownedBy' });
  const usage = attachProperty(ownedBy.ontology, {
    propertyId: ownedBy.id,
    subjectClassId: car.id,
    objectClassId: company.id,
  });
  ontology = usage.ontology;
  const ids: Ids = {
    car: car.id,
    truck: truck.id,
    company: company.id,
    ownedBy: ownedBy.id,
    usage: usage.id,
  };
  return { ontology: { ...ontology, unmodelled: kept(ids) } satisfies Ontology, ids };
}

describe('statements about modelled terms', () => {
  it('are written under the names the terms have now', () => {
    const { ontology, ids } = fleet((id) => [
      say(entityRef(id.car), `${OWL}disjointWith`, iri(entityRef(id.truck))),
    ]);

    const renamed = renameClass(ontology, ids.car, 'Automobile');

    expect(
      objectsOf(ontologyToTriples(renamed), `${FLEET}Automobile`, `${OWL}disjointWith`),
    ).toEqual([`${FLEET}Truck`]);
  });

  it('go with a term that is deleted, and leave the rest alone', () => {
    const { ontology, ids } = fleet((id) => [
      say(entityRef(id.car), `${OWL}disjointWith`, iri(entityRef(id.truck))),
      say(entityRef(id.car), `${OWL}deprecated`, literal('true', { datatype: `${XSD}boolean` })),
    ]);

    const triples = ontologyToTriples(deleteClass(ontology, ids.truck));

    expect(objectsOf(triples, `${FLEET}Car`, `${OWL}disjointWith`)).toEqual([]);
    expect(has(triples, `${FLEET}Car`, `${OWL}deprecated`, { datatype: `${XSD}boolean` })).toBe(
      true,
    );
  });

  it('take a restriction on a deleted class with them, rather than leave half of it', () => {
    const { ontology, ids } = fleet((id) => [
      say(entityRef(id.car), RDFS_SUBCLASS_OF, blank('_:k1')),
      say('_:k1', RDF_TYPE, iri(`${OWL}Restriction`)),
      say('_:k1', `${OWL}onProperty`, iri(entityRef(id.ownedBy))),
      say('_:k1', `${OWL}someValuesFrom`, iri(entityRef(id.company))),
    ]);

    const kept = ontologyToTriples(ontology);
    expect(kept.filter((triple) => triple.predicate === `${OWL}onProperty`)).toHaveLength(1);

    const triples = ontologyToTriples(deleteClass(ontology, ids.company));
    expect(triples.some((triple) => triple.predicate === `${OWL}onProperty`)).toBe(false);
    expect(objectsOf(triples, `${FLEET}Car`, RDFS_SUBCLASS_OF)).toEqual([]);
    expect(has(triples, `${FLEET}Car`, RDF_TYPE, { value: `${OWL}Class` })).toBe(true);
  });

  /* Pointed at by nothing, so there is nothing to hang it from but itself. */
  it('keep a blank statement that stands on its own, until a member of it goes', () => {
    const { ontology, ids } = fleet((id) => [
      say('_:k1', RDF_TYPE, iri(`${OWL}AllDisjointClasses`)),
      say('_:k1', `${OWL}members`, blank('_:k2')),
      say('_:k2', RDF_FIRST, iri(entityRef(id.car))),
      say('_:k2', RDF_REST, blank('_:k3')),
      say('_:k3', RDF_FIRST, iri(entityRef(id.truck))),
      say('_:k3', RDF_REST, iri(RDF_NIL)),
    ]);

    const members = (model: Ontology) =>
      ontologyToTriples(model).filter((triple) => triple.predicate === RDF_FIRST);

    expect(members(ontology).map((triple) => triple.object.value)).toEqual([
      `${FLEET}Car`,
      `${FLEET}Truck`,
    ]);
    const triples = ontologyToTriples(deleteClass(ontology, ids.truck));
    expect(triples.some((triple) => triple.predicate === `${OWL}members`)).toBe(false);
    expect(triples.some((triple) => triple.predicate === RDF_FIRST)).toBe(false);
  });

  it('sit in the block of the term they are about', () => {
    const { ontology } = fleet((id) => [
      say(entityRef(id.car), `${OWL}disjointWith`, iri(entityRef(id.truck))),
    ]);

    const subjects = ontologyToTriples(ontology).map((triple) => triple.subject);
    const car = subjects.flatMap((subject, position) =>
      subject === `${FLEET}Car` ? [position] : [],
    );
    expect(car.at(-1)! - car[0]! + 1).toBe(car.length);
  });

  it('about the ontology itself follow its header', () => {
    const { ontology } = fleet(() => [
      say(ONTOLOGY_REF, `${OWL}imports`, iri('http://xmlns.com/foaf/0.1/')),
    ]);

    expect(
      objectsOf(ontologyToTriples(ontology), 'https://example.org/fleet', `${OWL}imports`),
    ).toEqual(['http://xmlns.com/foaf/0.1/']);
  });
});

describe('constraints on the shapes the writer generates', () => {
  it('land on the property shape for that class and property', () => {
    const { ontology } = fleet((id) => [
      say(
        propertyShapeRef(id.car, id.ownedBy),
        `${SH}minCount`,
        literal('1', { datatype: `${XSD}integer` }),
      ),
    ]);

    const triples = ontologyToTriples(ontology);
    const [shape] = objectsOf(triples, `${FLEET}CarShape`, `${SH}property`);
    expect(has(triples, shape!, `${SH}minCount`, { value: '1' })).toBe(true);
  });

  it('go when the class no longer uses that property', () => {
    const { ontology, ids } = fleet((id) => [
      say(
        propertyShapeRef(id.car, id.ownedBy),
        `${SH}minCount`,
        literal('1', { datatype: `${XSD}integer` }),
      ),
    ]);

    const triples = ontologyToTriples(detachUsage(ontology, ids.usage));
    expect(triples.some((triple) => triple.predicate === `${SH}minCount`)).toBe(false);
  });

  it('keep a node shape for a class that no longer has a property to draw', () => {
    const { ontology } = fleet((id) => [
      say(nodeShapeRef(id.truck), RDF_TYPE, iri(`${SH}NodeShape`)),
      say(nodeShapeRef(id.truck), `${SH}targetClass`, iri(entityRef(id.truck))),
      say(nodeShapeRef(id.truck), `${SH}closed`, literal('true', { datatype: `${XSD}boolean` })),
    ]);

    const triples = ontologyToTriples(ontology);
    expect(objectsOf(triples, `${FLEET}TruckShape`, `${SH}targetClass`)).toEqual([`${FLEET}Truck`]);
    expect(has(triples, `${FLEET}TruckShape`, `${SH}closed`, { value: 'true' })).toBe(true);
  });
});

describe('which layer a kept statement is written with', () => {
  const { ontology } = fleet((id) => [
    say(`${FLEET}acme`, RDF_TYPE, iri(entityRef(id.company))),
    say(
      propertyShapeRef(id.car, id.ownedBy),
      `${SH}minCount`,
      literal('1', { datatype: `${XSD}integer` }),
    ),
  ]);
  const said = (triples: Triple[]) => ({
    individual: triples.some((triple) => triple.subject === `${FLEET}acme`),
    constraint: triples.some((triple) => triple.predicate === `${SH}minCount`),
  });

  it('goes with the axioms, or with the shapes when it says something in SHACL', () => {
    expect(said(ontologyToTriples(ontology))).toEqual({ individual: true, constraint: true });
    expect(said(ontologyToTriples(ontology, { includeAxioms: false }))).toEqual({
      individual: false,
      constraint: true,
    });
    expect(said(ontologyToTriples(ontology, { includeShapes: false }))).toEqual({
      individual: true,
      constraint: false,
    });
  });

  it('never leaves a reference in the output', () => {
    for (const options of [{}, { includeAxioms: false }, { includeShapes: false }]) {
      const written = JSON.stringify(ontologyToTriples(ontology, options));
      expect(written).not.toContain('urn:ontoschema:');
    }
  });
});

describe('setting aside what an import did not use', () => {
  it('replaces the terms the model owns and relabels blank nodes away from the writer’s', () => {
    const used = say(`${FLEET}Car`, RDF_TYPE, iri(`${OWL}Class`));
    const triples = [
      used,
      say(`${FLEET}Car`, RDFS_SUBCLASS_OF, blank('_:x1')),
      say('_:x1', `${OWL}onProperty`, iri(`${FLEET}ownedBy`)),
    ];

    const kept = setAside(triples, new Set([used]), new Map([[`${FLEET}Car`, entityRef('cls_1')]]));

    expect(kept).toEqual([
      say(entityRef('cls_1'), RDFS_SUBCLASS_OF, blank('_:k1')),
      say('_:k1', `${OWL}onProperty`, iri(`${FLEET}ownedBy`)),
    ]);
  });
});
