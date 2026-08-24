import { describe, expect, it } from 'vitest';
import { buildAutoOntology, buildReusedOntology } from '../../tests/fixtures/autoOntology';
import { has, objectsOf, unionMembers } from '../../tests/fixtures/readTriples';
import {
  OWL_CLASS,
  OWL_DATATYPE_PROPERTY,
  OWL_OBJECT_PROPERTY,
  OWL_ONTOLOGY,
  OWL_UNION_OF,
  RDFS_DOMAIN,
  RDFS_RANGE,
  RDFS_SUBCLASS_OF,
  RDFS_SUBPROPERTY_OF,
  RDF_TYPE,
  SH_CLASS,
  SH_DATATYPE,
  SH_NODE_SHAPE,
  SH_OR,
  SH_PATH,
  SH_PROPERTY,
  SH_TARGET_CLASS,
} from '../annotationvocabulary';
import {
  addAnnotation,
  addClass,
  addRelation,
  attachProperty,
  updateAnnotation,
} from './mutations';
import { createEmptyOntology } from './ontology';
import type { Ontology } from './types';
import { ontologyToTriples } from './triples';

const AUTO = 'https://example.org/auto/';

describe('axioms', () => {
  const { ontology } = buildAutoOntology();
  const triples = ontologyToTriples(ontology, { includeShapes: false });

  it('declares the ontology header at the namespace IRI without its terminator', () => {
    expect(has(triples, 'https://example.org/auto', RDF_TYPE, { value: OWL_ONTOLOGY })).toBe(true);
  });

  it('types classes, relations and attributes', () => {
    expect(has(triples, `${AUTO}Car`, RDF_TYPE, { value: OWL_CLASS })).toBe(true);
    expect(has(triples, `${AUTO}offeredBy`, RDF_TYPE, { value: OWL_OBJECT_PROPERTY })).toBe(true);
    expect(has(triples, `${AUTO}price`, RDF_TYPE, { value: OWL_DATATYPE_PROPERTY })).toBe(true);
  });

  it('declares an unused property even though it is drawn nowhere', () => {
    expect(has(triples, `${AUTO}hasPart`, RDF_TYPE, { value: OWL_OBJECT_PROPERTY })).toBe(true);
    expect(objectsOf(triples, `${AUTO}hasPart`, RDFS_DOMAIN)).toHaveLength(0);
    expect(objectsOf(triples, `${AUTO}hasPart`, RDFS_RANGE)).toHaveLength(0);
  });

  it('writes the subclass hierarchy', () => {
    expect(has(triples, `${AUTO}Car`, RDFS_SUBCLASS_OF, { value: `${AUTO}Vehicle` })).toBe(true);
    expect(
      has(triples, `${AUTO}Dealership`, RDFS_SUBCLASS_OF, { value: `${AUTO}Organization` }),
    ).toBe(true);
  });

  it('takes domain and range from a relation that is used exactly once', () => {
    expect(has(triples, `${AUTO}offeredBy`, RDFS_DOMAIN, { value: `${AUTO}Car` })).toBe(true);
    expect(has(triples, `${AUTO}offeredBy`, RDFS_RANGE, { value: `${AUTO}Dealership` })).toBe(true);
  });

  it('gives each attribute an xsd range and its single class as domain', () => {
    expect(
      has(triples, `${AUTO}year`, RDFS_RANGE, {
        value: 'http://www.w3.org/2001/XMLSchema#integer',
      }),
    ).toBe(true);
    expect(has(triples, `${AUTO}make`, RDFS_DOMAIN, { value: `${AUTO}Car` })).toBe(true);
  });

  it('carries language tags through onto text annotations', () => {
    const labels = triples.filter(
      (triple) =>
        triple.subject === `${AUTO}Car` &&
        triple.predicate === 'http://www.w3.org/2004/02/skos/core#prefLabel',
    );
    expect(labels.map((t) => t.object.type === 'literal' && t.object.language).sort()).toEqual([
      'en',
      'nl',
    ]);
  });

  it('writes a date annotation as an xsd:date literal, not a plain string', () => {
    const created = triples.find((t) => t.predicate === 'http://purl.org/dc/terms/created');
    expect(created?.object).toMatchObject({
      type: 'literal',
      value: '2026-07-30',
      datatype: 'http://www.w3.org/2001/XMLSchema#date',
    });
  });

  it('writes an IRI-valued annotation as an IRI, not a literal', () => {
    const license = triples.find((t) => t.predicate === 'http://purl.org/dc/terms/license');
    expect(license?.object).toEqual({
      type: 'iri',
      value: 'https://creativecommons.org/licenses/by/4.0/',
    });
  });

  it('demotes a malformed IRI to a literal rather than emitting something unparseable', () => {
    const withText = addAnnotation(
      ontology,
      'class',
      ontology.classes[0]?.id ?? '',
      'rdfs:seeAlso',
      'see the manual',
    );
    const seeAlso = ontologyToTriples(withText).find(
      (t) => t.predicate === 'http://www.w3.org/2000/01/rdf-schema#seeAlso',
    );
    expect(seeAlso?.object).toEqual({ type: 'literal', value: 'see the manual' });
  });

  it('skips blank annotation values instead of emitting empty literals', () => {
    const withBlank = addAnnotation(
      ontology,
      'class',
      ontology.classes[0]?.id ?? '',
      'rdfs:comment',
      '   ',
    );
    expect(ontologyToTriples(withBlank, { includeShapes: false })).toHaveLength(triples.length);
  });

  it('never emits duplicate triples', () => {
    const keys = triples.map(
      (t) =>
        `${t.subject}|${t.predicate}|${t.object.value}|${
          t.object.type === 'literal' ? (t.object.language ?? '') : ''
        }`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('ignores an annotation whose term is not in the vocabulary', () => {
    const { ontology: base, ids } = buildAutoOntology();
    const annotated = addAnnotation(base, 'class', ids.truck, 'rdfs:label', 'Truck');
    const id = annotated.classes.find((c) => c.id === ids.truck)?.annotations[0]?.id ?? '';
    const bogus = updateAnnotation(annotated, 'class', ids.truck, id, { term: 'nope:whatever' });
    expect(
      ontologyToTriples(bogus).some(
        (t) => t.object.type === 'literal' && t.object.value === 'Truck',
      ),
    ).toBe(false);
  });
});

describe('a reused property states its domain as a union', () => {
  const { ontology } = buildReusedOntology();
  const triples = ontologyToTriples(ontology, { includeShapes: false });

  /*
   * Repeating `rdfs:domain` would mean intersection -- that anything with a price is a Car
   * *and* a Product -- which is false. A union is true, and it is what lets the ontology file
   * be read back on its own, without the shapes beside it.
   */
  it('points the domain at a union of every class that carries the attribute', () => {
    const [domain] = objectsOf(triples, `${AUTO}price`, RDFS_DOMAIN);
    expect(has(triples, domain!, RDF_TYPE, { value: OWL_CLASS })).toBe(true);
    expect(unionMembers(triples, domain!)).toEqual([`${AUTO}Car`, `${AUTO}Product`]);
  });

  /*
   * The union has to be anonymous, and this is the assertion that says why. Measured against
   * a real OWL parser: given a *named* class carrying `owl:unionOf`, the parser drops the
   * union and reports the domain as a bare class equivalent to nothing — which is worse than
   * stating no domain at all, since it asserts something meaningless rather than nothing.
   */
  it('makes the union anonymous, which is the only form an OWL parser reads as an expression', () => {
    const domainTriple = triples.find(
      (triple) => triple.subject === `${AUTO}price` && triple.predicate === RDFS_DOMAIN,
    );
    expect(domainTriple?.object.type).toBe('blank');
    expect(triples.some((triple) => triple.predicate === OWL_UNION_OF)).toBe(true);
    expect(
      triples.some(
        (triple) => triple.predicate === OWL_UNION_OF && !triple.subject.startsWith('_:'),
      ),
    ).toBe(false);
  });

  it('keeps the xsd range, which is the same wherever the property is used', () => {
    expect(objectsOf(triples, `${AUTO}price`, RDFS_RANGE)).toEqual([
      'http://www.w3.org/2001/XMLSchema#decimal',
    ]);
  });

  it('unions both ends of a relation drawn between two pairs', () => {
    const [domain] = objectsOf(triples, `${AUTO}offeredBy`, RDFS_DOMAIN);
    const [range] = objectsOf(triples, `${AUTO}offeredBy`, RDFS_RANGE);
    expect(unionMembers(triples, domain!)).toEqual([`${AUTO}Car`, `${AUTO}Truck`]);
    expect(unionMembers(triples, range!)).toEqual([`${AUTO}Dealership`, `${AUTO}Garage`]);
  });

  /*
   * The known cost, asserted so it cannot be mistaken for a bug later: the union gives back
   * both sets but not which subject went with which object, so Car->Garage is licensed even
   * though it was never drawn. The shapes keep the pairings; the ontology file does not.
   */
  it('loses the pairing, which is the price of being able to state anything at all', () => {
    const [domain] = objectsOf(triples, `${AUTO}offeredBy`, RDFS_DOMAIN);
    const [range] = objectsOf(triples, `${AUTO}offeredBy`, RDFS_RANGE);
    expect(unionMembers(triples, domain!)).toContain(`${AUTO}Car`);
    expect(unionMembers(triples, range!)).toContain(`${AUTO}Garage`);
  });

  it('states a single class directly when the property is used only once', () => {
    expect(objectsOf(triples, `${AUTO}make`, RDFS_DOMAIN)).toEqual([`${AUTO}Car`]);
    const domainTriple = triples.find(
      (triple) => triple.subject === `${AUTO}make` && triple.predicate === RDFS_DOMAIN,
    );
    expect(domainTriple?.object.type).toBe('iri');
  });
});

describe('SHACL shapes', () => {
  const { ontology } = buildAutoOntology();
  const triples = ontologyToTriples(ontology, { includeAxioms: false });

  it('creates one node shape per class that has usages, and none for classes without', () => {
    expect(has(triples, `${AUTO}CarShape`, RDF_TYPE, { value: SH_NODE_SHAPE })).toBe(true);
    expect(has(triples, `${AUTO}CarShape`, SH_TARGET_CLASS, { value: `${AUTO}Car` })).toBe(true);
    expect(triples.some((t) => t.subject === `${AUTO}TruckShape`)).toBe(false);
  });

  it('creates one property shape per property used on the class', () => {
    expect(has(triples, `${AUTO}CarShape`, SH_PROPERTY, { value: `${AUTO}Car_price` })).toBe(true);
    expect(has(triples, `${AUTO}Car_price`, SH_PATH, { value: `${AUTO}price` })).toBe(true);
    expect(
      has(triples, `${AUTO}Car_price`, SH_DATATYPE, {
        value: 'http://www.w3.org/2001/XMLSchema#decimal',
      }),
    ).toBe(true);
  });

  it('constrains a relation with sh:class rather than a global range', () => {
    expect(has(triples, `${AUTO}Car_offeredBy`, SH_PATH, { value: `${AUTO}offeredBy` })).toBe(true);
    expect(has(triples, `${AUTO}Car_offeredBy`, SH_CLASS, { value: `${AUTO}Dealership` })).toBe(
      true,
    );
  });

  it('emits no shapes at all when they are switched off', () => {
    const axiomsOnly = ontologyToTriples(ontology, { includeShapes: false });
    expect(axiomsOnly.some((t) => t.predicate.startsWith('http://www.w3.org/ns/shacl#'))).toBe(
      false,
    );
  });
});

describe('shapes keep the pairing that RDFS loses', () => {
  const { ontology } = buildReusedOntology();
  const triples = ontologyToTriples(ontology, { includeAxioms: false });

  it('gives each class its own constraint for the shared property', () => {
    expect(has(triples, `${AUTO}Car_offeredBy`, SH_CLASS, { value: `${AUTO}Dealership` })).toBe(
      true,
    );
    expect(has(triples, `${AUTO}Truck_offeredBy`, SH_CLASS, { value: `${AUTO}Garage` })).toBe(true);
    // Car→Garage was never drawn, and no shape licenses it.
    expect(has(triples, `${AUTO}Car_offeredBy`, SH_CLASS, { value: `${AUTO}Garage` })).toBe(false);
  });

  it('gives the reused attribute a shape on each class', () => {
    expect(has(triples, `${AUTO}Car_price`, SH_PATH, { value: `${AUTO}price` })).toBe(true);
    expect(has(triples, `${AUTO}Product_price`, SH_PATH, { value: `${AUTO}price` })).toBe(true);
  });
});

describe('one class using one property with several targets', () => {
  const built = buildAutoOntology();
  const withWheel = addClass(built.ontology, { localName: 'Wheel' });
  const withDoor = addClass(withWheel.ontology, { localName: 'Door' });
  const partOne = attachProperty(withDoor.ontology, {
    propertyId: built.ids.hasPart,
    subjectClassId: built.ids.car,
    objectClassId: withWheel.id,
  });
  const partTwo = attachProperty(partOne.ontology, {
    propertyId: built.ids.hasPart,
    subjectClassId: built.ids.car,
    objectClassId: withDoor.id,
  });
  const triples = ontologyToTriples(partTwo.ontology, { includeAxioms: false });

  it('groups them into one property shape, since two shapes on a path are conjunctive', () => {
    const shapes = triples.filter(
      (t) => t.predicate === SH_PATH && t.object.value === `${AUTO}hasPart`,
    );
    expect(shapes).toHaveLength(1);
  });

  it('expresses the alternatives as a disjunction, not a conjunction', () => {
    const or = triples.find((t) => t.subject === `${AUTO}Car_hasPart` && t.predicate === SH_OR);
    expect(or).toBeDefined();
    // Two shapes with sh:class Wheel and sh:class Door would demand parts be both at once.
    expect(has(triples, `${AUTO}Car_hasPart`, SH_CLASS, { value: `${AUTO}Wheel` })).toBe(false);

    const alternatives = triples
      .filter((t) => t.predicate === SH_CLASS && t.subject.startsWith(`${AUTO}Car_hasPart_alt`))
      .map((t) => t.object.value)
      .sort();
    expect(alternatives).toEqual([`${AUTO}Door`, `${AUTO}Wheel`]);
  });

  it('writes the disjunction as a well-formed RDF list terminated by rdf:nil', () => {
    const rest = triples.filter(
      (t) => t.predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
    );
    expect(rest).toHaveLength(2);
    expect(rest.at(-1)?.object.value).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil');
  });
});

describe('edge cases', () => {
  it('an empty ontology still declares its header', () => {
    const triples = ontologyToTriples(createEmptyOntology('https://example.org/blank/', 'blank'));
    expect(triples).toHaveLength(1);
    expect(triples[0]?.object.value).toBe(OWL_ONTOLOGY);
  });

  it('a relation usage with no target emits neither range nor sh:class', () => {
    const withClass = addClass(createEmptyOntology('https://example.org/x/', 'x'), {
      localName: 'Car',
    });
    const withProperty = addClass(withClass.ontology, { localName: 'Other' });
    const triples = ontologyToTriples(withProperty.ontology);
    expect(triples.some((t) => t.predicate === RDFS_RANGE)).toBe(false);
  });

  /*
   * Two labels that read the same and are written in different languages are two facts, and the
   * key that keeps duplicate triples out has to say so. Mutation testing found this: drop the
   * language from that key and both tests above still passed, because no case had ever put the
   * same text under two tags.
   */
  it('keeps two labels that differ only by their language tag', () => {
    const { ontology, id } = addClass(createEmptyOntology('https://example.org/x/', 'x'), {
      localName: 'Car',
    });
    const english = addAnnotation(ontology, 'class', id, 'rdfs:label', 'Auto', 'en');
    const dutch = addAnnotation(english, 'class', id, 'rdfs:label', 'Auto', 'nl');

    const labels = ontologyToTriples(dutch).filter(
      (triple) => triple.predicate === 'http://www.w3.org/2000/01/rdf-schema#label',
    );
    expect(labels).toHaveLength(2);
    expect(
      labels
        .map((triple) => (triple.object.type === 'literal' ? triple.object.language : ''))
        .sort(),
    ).toEqual(['en', 'nl']);
  });

  /*
   * A document written elsewhere can say a class is its own superclass. The editor cannot
   * produce that — `canSubclass` refuses a cycle — but the writer is what a foreign model
   * reaches, and an axiom pointing at itself is worse than none.
   */
  it('writes no self-referencing subclass or subproperty axiom', () => {
    const { ontology, id } = addClass(createEmptyOntology('https://example.org/x/', 'x'), {
      localName: 'Car',
    });
    const withRelation = addRelation(ontology, { localName: 'partOf' });
    const looped: Ontology = {
      ...withRelation.ontology,
      classes: withRelation.ontology.classes.map((entity) =>
        entity.id === id ? { ...entity, superClassIds: [id] } : entity,
      ),
      relations: withRelation.ontology.relations.map((entity) => ({
        ...entity,
        superPropertyIds: [entity.id],
      })),
    };

    const triples = ontologyToTriples(looped);
    const selfReferencing = triples.filter(
      (triple) =>
        (triple.predicate === RDFS_SUBCLASS_OF || triple.predicate === RDFS_SUBPROPERTY_OF) &&
        triple.object.value === triple.subject,
    );
    expect(selfReferencing).toEqual([]);
  });

  it('normalises a base IRI that lacks a terminator', () => {
    const ontology = createEmptyOntology('https://example.org/auto', 'auto');
    const withClass = addClass(ontology, { localName: 'Car' });
    const triples = ontologyToTriples(withClass.ontology);
    expect(triples.some((t) => t.subject === 'https://example.org/auto#Car')).toBe(true);
  });

  it('never lets a generated shape name collide with a real entity', () => {
    // A class literally called CarShape would otherwise clash with Car's node shape.
    const { ontology } = buildAutoOntology();
    const clash = addClass(ontology, { localName: 'CarShape' });
    const triples = ontologyToTriples(clash.ontology, { includeAxioms: false });

    const shapeSubjects = triples
      .filter((t) => t.predicate === SH_TARGET_CLASS)
      .map((t) => t.subject);
    expect(new Set(shapeSubjects).size).toBe(shapeSubjects.length);
    // Car's shape has stepped aside rather than overwriting the real class's IRI.
    expect(shapeSubjects).not.toContain(`${AUTO}CarShape`);
    expect(shapeSubjects).toContain(`${AUTO}CarShape2`);
  });
});
