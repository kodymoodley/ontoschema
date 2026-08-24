import { describe, expect, it } from 'vitest';
import {
  OWL_CLASS,
  OWL_OBJECT_PROPERTY,
  OWL_UNION_OF,
  RDFS_DOMAIN,
  RDFS_RANGE,
  RDF_FIRST,
  RDF_NIL,
  RDF_REST,
} from '../annotationvocabulary';
import { buildAutoOntology, buildReusedOntology } from '../../tests/fixtures/autoOntology';
import { allScenarios } from '../../tests/fixtures/scenarios';
import { ontologyFromTriples } from './fromTriples';
import { addClass, addAttribute, attachProperty } from './mutations';
import { createEmptyOntology } from './ontology';
import { iri, literal, ontologyToTriples } from './triples';
import type { Triple } from './triples';
import type { Ontology } from './types';

/**
 * Reading a document back.
 *
 * The round trip is the test that matters: write the model out, read it in, and ask whether
 * what came back says the same thing. Names rather than ids throughout, since ids are this
 * app's own and a document carries none.
 */

const AUTO = 'https://example.org/auto/';

/** An ontology described the way a reader can compare two of them: by name, not by id. */
function summarise(ontology: Ontology) {
  const className = new Map(ontology.classes.map((entity) => [entity.id, entity.localName]));
  const propertyName = new Map(
    [...ontology.relations, ...ontology.attributes].map((entity) => [entity.id, entity.localName]),
  );

  return {
    iri: ontology.iri,
    prefix: ontology.prefix,
    classes: ontology.classes.map((entity) => entity.localName).sort(),
    /*
     * Dangling ids are skipped on both sides. The degenerate fixture carries some on purpose,
     * a writer cannot emit a triple about a class that does not exist, and a reader has no way
     * to invent one back — so comparing them would be comparing broken bookkeeping rather than
     * what the two models say.
     */
    subClassOf: ontology.classes
      .flatMap((entity) =>
        entity.superClassIds
          .filter((id) => className.has(id))
          .map((id) => `${entity.localName} < ${className.get(id)}`),
      )
      .sort(),
    attributes: ontology.attributes.map((entity) => `${entity.localName}: ${entity.range}`).sort(),
    relations: ontology.relations.map((entity) => entity.localName).sort(),
    usages: ontology.usages
      .filter(
        (usage) =>
          className.has(usage.subjectClassId) &&
          propertyName.has(usage.propertyId) &&
          (usage.objectClassId === null || className.has(usage.objectClassId)),
      )
      .map(
        (usage) =>
          `${className.get(usage.subjectClassId)} -${propertyName.get(usage.propertyId)}-> ${
            usage.objectClassId ? className.get(usage.objectClassId) : 'literal'
          }`,
      )
      .sort(),
    annotations: ontology.classes
      .flatMap((entity) =>
        entity.annotations.map(
          (annotation) =>
            `${entity.localName} ${annotation.term} ${annotation.value}${
              annotation.language ? `@${annotation.language}` : ''
            }`,
        ),
      )
      .sort(),
    positions: ontology.classes
      .map((entity) => `${entity.localName} ${entity.position.x},${entity.position.y}`)
      .sort(),
  };
}

/**
 * A document with no shapes in it, which is what a foreign ontology looks like and what this
 * app itself used to save. The axioms are all such a file has, so this is the path where a
 * union is read for what it can be read for.
 */
const roundTrip = (ontology: Ontology) =>
  ontologyFromTriples(ontologyToTriples(ontology, { includeShapes: false }), {
    [ontology.prefix]: ontology.iri,
  });

/** A file this app saves: axioms, shapes and layout together. */
const saveAndOpen = (ontology: Ontology) =>
  ontologyFromTriples(ontologyToTriples(ontology), { [ontology.prefix]: ontology.iri });

describe('the round trip', () => {
  it('brings back a schema unchanged, down to the positions and the language tags', () => {
    const { ontology } = buildAutoOntology();
    const restored = roundTrip(ontology).ontology;

    // `hasPart` is the one exception, and it has a test of its own below.
    expect(summarise(restored)).toEqual({
      ...summarise(ontology),
      relations: summarise(ontology).relations.filter((name) => name !== 'hasPart'),
    });
  });

  /*
   * A relation in the pool that is never used has no domain and no range to write, so nothing
   * in the document distinguishes it from a foreign property too vague to import — and the
   * rule is to leave those out. The consequence is worth stating plainly: a schema saved with
   * an unused relation comes back without it.
   *
   * Note the asymmetry. An unused *attribute* survives, because an attribute carries its own
   * `rdfs:range` whether or not any class uses it, so there is always something to declare.
   */
  it('loses a relation that no class uses, which an unused attribute survives', () => {
    const { ontology } = buildAutoOntology();
    const restored = roundTrip(ontology).ontology;

    expect(summarise(ontology).relations).toContain('hasPart');
    expect(summarise(restored).relations).not.toContain('hasPart');
    expect(
      ontology.usages.some(
        (usage) =>
          usage.propertyId === ontology.relations.find((r) => r.localName === 'hasPart')?.id,
      ),
    ).toBe(false);
  });

  it('reports nothing dropped from a document this app wrote', () => {
    const { ontology } = buildAutoOntology();
    const { report } = roundTrip(ontology);

    expect(report).toEqual({
      individuals: 0,
      classExpressions: 0,
      // `hasPart` exists in the fixture but is never used, so it has no ends to state.
      relationsWithoutBothEnds: 1,
      datatypesRewritten: 0,
    });
  });

  /*
   * Every awkward shape the suite knows about, checked for the properties that must hold
   * whatever the document: no class invented, none lost, and every attribute back with the
   * class it sat on. Relations are checked separately, because they are the one thing a
   * union domain cannot restore exactly.
   */
  describe.each(allScenarios())('$name', ({ ontology }) => {
    const restored = roundTrip(ontology).ontology;

    it('keeps every class, and its place in the hierarchy', () => {
      expect(summarise(restored).classes).toEqual(summarise(ontology).classes);
      expect(summarise(restored).subClassOf).toEqual(summarise(ontology).subClassOf);
    });

    it('keeps every attribute, and every class it sits on', () => {
      expect(summarise(restored).attributes).toEqual(summarise(ontology).attributes);

      const attributeUsages = (model: Ontology) =>
        summarise(model).usages.filter((usage) => usage.endsWith('literal'));
      expect(attributeUsages(restored)).toEqual(attributeUsages(ontology));
    });

    it('keeps every annotation and every position', () => {
      expect(summarise(restored).annotations).toEqual(summarise(ontology).annotations);
      expect(summarise(restored).positions).toEqual(summarise(ontology).positions);
    });

    it('never invents a relation, and never loses a pairing that was drawn', () => {
      const drawn = summarise(ontology).usages.filter((usage) => !usage.endsWith('literal'));
      const back = summarise(restored).usages.filter((usage) => !usage.endsWith('literal'));

      // Every pairing that was drawn is still there. The union may license more; see below.
      for (const usage of drawn) expect(back).toContain(usage);
      // No relation is invented, and only an unused one may go missing.
      for (const name of summarise(restored).relations) {
        expect(summarise(ontology).relations).toContain(name);
      }
    });
  });
});

/**
 * The one thing the ontology file cannot carry, asserted rather than left to be discovered.
 *
 * A union names both ends but not which end went with which, so a relation drawn between two
 * distinct pairs comes back permitting all four. The shapes keep the pairings; a document
 * read without them cannot.
 */
/**
 * What the shapes are in the saved file for. The axioms name both ends of a relation but not
 * which end went with which; the shapes are per class, so they say exactly what was drawn.
 * Without them, saving the insurance example and opening it returned two relations nobody had
 * drawn -- `MotorPolicy insures Dwelling` among them.
 */
describe('a file this app saved', () => {
  it('gives back every pairing exactly, and invents none', () => {
    const { ontology } = buildReusedOntology();
    const before = summarise(ontology).usages;
    const after = summarise(saveAndOpen(ontology).ontology).usages;

    expect(after).toEqual(before);
  });

  /*
   * And the union is not written at all, because the shapes beside it say it better. That is
   * what takes the blank nodes and the `rdf:first` chains out of a saved file.
   */
  it('states no union, since something in the same file states the pairing', () => {
    const { ontology } = buildReusedOntology();
    const saved = ontologyToTriples(ontology);
    const looseFile = ontologyToTriples(ontology, { includeShapes: false });

    expect(saved.some((triple) => triple.predicate === OWL_UNION_OF)).toBe(false);
    expect(saved.some((triple) => triple.object.type === 'blank')).toBe(false);
    // Still stated where nothing else can state it.
    expect(looseFile.some((triple) => triple.predicate === OWL_UNION_OF)).toBe(true);
  });

  /* A property used once has exact ends, so they are stated whatever else is in the file. */
  it('keeps a single use as plain rdfs:domain and rdfs:range', () => {
    const { ontology } = buildAutoOntology();
    const saved = ontologyToTriples(ontology);
    const domain = saved.find(
      (triple) => triple.predicate === RDFS_DOMAIN && triple.subject.endsWith('offeredBy'),
    );

    expect(domain?.object.type).toBe('iri');
  });
});

/**
 * Shapes that are not shaped as this app writes them.
 *
 * Every saved file now carries shapes and the reader prefers them, so a hand-edited file or one
 * from another tool is an ordinary input rather than an exotic one. Mutation testing found this
 * gap by inverting each guard below without a single test noticing.
 */
describe('reading shapes that are malformed', () => {
  const SH = 'http://www.w3.org/ns/shacl#';
  const EX = 'https://example.org/mal/';

  /** A document with two classes, one relation, and whatever shape triples are handed in. */
  const documentWith = (shape: readonly Triple[]): Triple[] => [
    { subject: `${EX}Car`, predicate: RDF_TYPE, object: iri(OWL_CLASS) },
    { subject: `${EX}Yard`, predicate: RDF_TYPE, object: iri(OWL_CLASS) },
    { subject: `${EX}keptAt`, predicate: RDF_TYPE, object: iri(OWL_OBJECT_PROPERTY) },
    ...shape,
  ];

  const pairsFor = (shape: readonly Triple[]) =>
    summarise(ontologyFromTriples(documentWith(shape)).ontology).usages;

  /* The shape this app writes, as the control: without it the rest proves nothing. */
  it('reads a well-formed shape', () => {
    expect(
      pairsFor([
        { subject: `${EX}CarShape`, predicate: RDF_TYPE, object: iri(`${SH}NodeShape`) },
        { subject: `${EX}CarShape`, predicate: `${SH}targetClass`, object: iri(`${EX}Car`) },
        { subject: `${EX}CarShape`, predicate: `${SH}property`, object: iri(`${EX}Car_keptAt`) },
        { subject: `${EX}Car_keptAt`, predicate: `${SH}path`, object: iri(`${EX}keptAt`) },
        { subject: `${EX}Car_keptAt`, predicate: `${SH}class`, object: iri(`${EX}Yard`) },
      ]),
    ).toEqual(['Car -keptAt-> Yard']);
  });

  it('ignores a node shape whose target is a literal rather than a class', () => {
    expect(
      pairsFor([
        { subject: `${EX}CarShape`, predicate: RDF_TYPE, object: iri(`${SH}NodeShape`) },
        { subject: `${EX}CarShape`, predicate: `${SH}targetClass`, object: literal('Car') },
        { subject: `${EX}CarShape`, predicate: `${SH}property`, object: iri(`${EX}Car_keptAt`) },
        { subject: `${EX}Car_keptAt`, predicate: `${SH}path`, object: iri(`${EX}keptAt`) },
        { subject: `${EX}Car_keptAt`, predicate: `${SH}class`, object: iri(`${EX}Yard`) },
      ]),
    ).toEqual([]);
  });

  it('ignores a property shape whose path is a literal rather than a property', () => {
    expect(
      pairsFor([
        { subject: `${EX}CarShape`, predicate: RDF_TYPE, object: iri(`${SH}NodeShape`) },
        { subject: `${EX}CarShape`, predicate: `${SH}targetClass`, object: iri(`${EX}Car`) },
        { subject: `${EX}CarShape`, predicate: `${SH}property`, object: iri(`${EX}Car_keptAt`) },
        { subject: `${EX}Car_keptAt`, predicate: `${SH}path`, object: literal('keptAt') },
        { subject: `${EX}Car_keptAt`, predicate: `${SH}class`, object: iri(`${EX}Yard`) },
      ]),
    ).toEqual([]);
  });

  /* A shape naming a path and nothing else says which property, but not what it points at. */
  it('ignores a property shape with neither a class, a datatype nor an sh:or', () => {
    expect(
      pairsFor([
        { subject: `${EX}CarShape`, predicate: RDF_TYPE, object: iri(`${SH}NodeShape`) },
        { subject: `${EX}CarShape`, predicate: `${SH}targetClass`, object: iri(`${EX}Car`) },
        { subject: `${EX}CarShape`, predicate: `${SH}property`, object: iri(`${EX}Car_keptAt`) },
        { subject: `${EX}Car_keptAt`, predicate: `${SH}path`, object: iri(`${EX}keptAt`) },
      ]),
    ).toEqual([]);
  });

  /*
   * A shape with no path at all, which is the case the `?.` in these guards is for. Mutation
   * testing is what asked for this one: with the optional chaining removed the reader throws
   * here, and every test above still passed, because all of them handed it a path of some kind.
   */
  it('survives a property shape with no path at all', () => {
    expect(() =>
      pairsFor([
        { subject: `${EX}CarShape`, predicate: RDF_TYPE, object: iri(`${SH}NodeShape`) },
        { subject: `${EX}CarShape`, predicate: `${SH}targetClass`, object: iri(`${EX}Car`) },
        { subject: `${EX}CarShape`, predicate: `${SH}property`, object: iri(`${EX}Car_keptAt`) },
        { subject: `${EX}Car_keptAt`, predicate: `${SH}class`, object: iri(`${EX}Yard`) },
      ]),
    ).not.toThrow();
  });

  /* And a node shape with no target, for the same reason. */
  it('survives a node shape with no target class', () => {
    expect(() =>
      pairsFor([
        { subject: `${EX}CarShape`, predicate: RDF_TYPE, object: iri(`${SH}NodeShape`) },
        { subject: `${EX}CarShape`, predicate: `${SH}property`, object: iri(`${EX}Car_keptAt`) },
        { subject: `${EX}Car_keptAt`, predicate: `${SH}path`, object: iri(`${EX}keptAt`) },
        { subject: `${EX}Car_keptAt`, predicate: `${SH}class`, object: iri(`${EX}Yard`) },
      ]),
    ).not.toThrow();
  });

  /* Two targets on one path, which is how this app writes a class used with several. */
  it('reads every alternative out of an sh:or list', () => {
    expect(
      pairsFor([
        { subject: `${EX}Shed`, predicate: RDF_TYPE, object: iri(OWL_CLASS) },
        { subject: `${EX}CarShape`, predicate: RDF_TYPE, object: iri(`${SH}NodeShape`) },
        { subject: `${EX}CarShape`, predicate: `${SH}targetClass`, object: iri(`${EX}Car`) },
        { subject: `${EX}CarShape`, predicate: `${SH}property`, object: iri(`${EX}Car_keptAt`) },
        { subject: `${EX}Car_keptAt`, predicate: `${SH}path`, object: iri(`${EX}keptAt`) },
        { subject: `${EX}Car_keptAt`, predicate: `${SH}or`, object: iri(`${EX}alt1`) },
        { subject: `${EX}alt1`, predicate: RDF_FIRST, object: iri(`${EX}altYard`) },
        { subject: `${EX}alt1`, predicate: RDF_REST, object: iri(`${EX}alt2`) },
        { subject: `${EX}altYard`, predicate: `${SH}class`, object: iri(`${EX}Yard`) },
        { subject: `${EX}alt2`, predicate: RDF_FIRST, object: iri(`${EX}altShed`) },
        { subject: `${EX}alt2`, predicate: RDF_REST, object: iri(RDF_NIL) },
        { subject: `${EX}altShed`, predicate: `${SH}class`, object: iri(`${EX}Shed`) },
      ]).sort(),
    ).toEqual(['Car -keptAt-> Shed', 'Car -keptAt-> Yard']);
  });

  /* A list that points at itself must not spin the reader for ever. */
  it('survives an sh:or list that loops back on itself', () => {
    expect(
      pairsFor([
        { subject: `${EX}CarShape`, predicate: RDF_TYPE, object: iri(`${SH}NodeShape`) },
        { subject: `${EX}CarShape`, predicate: `${SH}targetClass`, object: iri(`${EX}Car`) },
        { subject: `${EX}CarShape`, predicate: `${SH}property`, object: iri(`${EX}Car_keptAt`) },
        { subject: `${EX}Car_keptAt`, predicate: `${SH}path`, object: iri(`${EX}keptAt`) },
        { subject: `${EX}Car_keptAt`, predicate: `${SH}or`, object: iri(`${EX}loop`) },
        { subject: `${EX}loop`, predicate: RDF_FIRST, object: iri(`${EX}altYard`) },
        { subject: `${EX}loop`, predicate: RDF_REST, object: iri(`${EX}loop`) },
        { subject: `${EX}altYard`, predicate: `${SH}class`, object: iri(`${EX}Yard`) },
      ]),
    ).toEqual(['Car -keptAt-> Yard']);
  });
});

/**
 * Reading a document written by somebody else, where the parts need not line up.
 *
 * Each of these was asked for by a surviving mutant: the code handles the case and nothing
 * proved it did.
 */
describe('a foreign document', () => {
  const A = 'https://example.org/a/';
  const B = 'https://other.example/b/';

  it('takes its namespace from wherever most of the terms live', () => {
    const { ontology } = ontologyFromTriples([
      { subject: `${A}Car`, predicate: RDF_TYPE, object: iri(OWL_CLASS) },
      { subject: `${A}Van`, predicate: RDF_TYPE, object: iri(OWL_CLASS) },
      { subject: `${A}Bus`, predicate: RDF_TYPE, object: iri(OWL_CLASS) },
      { subject: `${B}Stray`, predicate: RDF_TYPE, object: iri(OWL_CLASS) },
    ]);

    expect(ontology.iri).toBe(A);
    // The stray is still imported; it is the namespace that follows the majority.
    expect(ontology.classes.map((entity) => entity.localName).sort()).toEqual([
      'Bus',
      'Car',
      'Stray',
      'Van',
    ]);
  });

  /*
   * A union naming a class the document never declares — an import that was not followed, most
   * often. The named ones are kept and the unknown one is passed over, rather than the whole
   * union being discarded or a class being invented for it.
   */
  it('keeps the members of a union it knows and skips the ones it does not', () => {
    const { ontology } = ontologyFromTriples([
      { subject: `${A}Car`, predicate: RDF_TYPE, object: iri(OWL_CLASS) },
      { subject: `${A}Van`, predicate: RDF_TYPE, object: iri(OWL_CLASS) },
      { subject: `${A}Yard`, predicate: RDF_TYPE, object: iri(OWL_CLASS) },
      { subject: `${A}keptAt`, predicate: RDF_TYPE, object: iri(OWL_OBJECT_PROPERTY) },
      { subject: `${A}keptAt`, predicate: RDFS_DOMAIN, object: { type: 'blank', value: '_:u' } },
      { subject: `${A}keptAt`, predicate: RDFS_RANGE, object: iri(`${A}Yard`) },
      { subject: '_:u', predicate: RDF_TYPE, object: iri(OWL_CLASS) },
      { subject: '_:u', predicate: OWL_UNION_OF, object: { type: 'blank', value: '_:c1' } },
      { subject: '_:c1', predicate: RDF_FIRST, object: iri(`${A}Car`) },
      { subject: '_:c1', predicate: RDF_REST, object: { type: 'blank', value: '_:c2' } },
      { subject: '_:c2', predicate: RDF_FIRST, object: iri(`${B}NeverDeclared`) },
      { subject: '_:c2', predicate: RDF_REST, object: { type: 'blank', value: '_:c3' } },
      { subject: '_:c3', predicate: RDF_FIRST, object: iri(`${A}Van`) },
      { subject: '_:c3', predicate: RDF_REST, object: iri(RDF_NIL) },
    ]);

    expect(summarise(ontology).usages.sort()).toEqual(['Car -keptAt-> Yard', 'Van -keptAt-> Yard']);
  });

  /* Half a relation cannot be drawn, so it stays in the pool and the report says so. */
  it('does not place a relation that states a domain and no range', () => {
    const { ontology, report } = ontologyFromTriples([
      { subject: `${A}Car`, predicate: RDF_TYPE, object: iri(OWL_CLASS) },
      { subject: `${A}keptAt`, predicate: RDF_TYPE, object: iri(OWL_OBJECT_PROPERTY) },
      { subject: `${A}keptAt`, predicate: RDFS_DOMAIN, object: iri(`${A}Car`) },
    ]);

    expect(ontology.relations.map((entity) => entity.localName)).toEqual([]);
    expect(report.relationsWithoutBothEnds).toBe(1);
    expect(ontology.usages).toEqual([]);
  });
});

describe('what a union domain cannot restore', () => {
  it('licenses pairings that were never drawn, when a relation was used with two pairs', () => {
    const { ontology } = buildReusedOntology();
    const before = summarise(ontology).usages.filter((usage) => usage.includes('offeredBy'));
    const after = summarise(roundTrip(ontology).ontology).usages.filter((usage) =>
      usage.includes('offeredBy'),
    );

    expect(before).toEqual(['Car -offeredBy-> Dealership', 'Truck -offeredBy-> Garage']);
    expect(after).toEqual([
      'Car -offeredBy-> Dealership',
      'Car -offeredBy-> Garage',
      'Truck -offeredBy-> Dealership',
      'Truck -offeredBy-> Garage',
    ]);
  });

  it('restores an attribute exactly, since a usage is only a class and a property', () => {
    const { ontology } = buildReusedOntology();
    const price = (model: Ontology) =>
      summarise(model).usages.filter((usage) => usage.includes('price'));

    expect(price(roundTrip(ontology).ontology)).toEqual(price(ontology));
  });
});

/* ------------------------------------------------------------------ the rules, one at a time */

const OWL = 'http://www.w3.org/2002/07/owl#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

const typed = (subject: string, type: string): Triple => ({
  subject,
  predicate: RDF_TYPE,
  object: iri(type),
});

const aClass = (name: string) => typed(`${AUTO}${name}`, `${OWL}Class`);

describe('what a document may contain that this app does not model', () => {
  it('drops an individual and says so', () => {
    const { ontology, report } = ontologyFromTriples([
      aClass('Car'),
      typed(`${AUTO}myCar`, `${AUTO}Car`),
    ]);

    expect(ontology.classes.map((entity) => entity.localName)).toEqual(['Car']);
    expect(report.individuals).toBe(1);
  });

  it('drops a restriction rather than turning it into a class', () => {
    const { ontology, report } = ontologyFromTriples([
      aClass('Car'),
      {
        subject: `${AUTO}Car`,
        predicate: `${RDFS}subClassOf`,
        object: { type: 'blank', value: '_:r1' },
      },
      typed('_:r1', `${OWL}Restriction`),
      { subject: '_:r1', predicate: `${OWL}onProperty`, object: iri(`${AUTO}hasWheel`) },
    ]);

    expect(ontology.classes).toHaveLength(1);
    expect(ontology.classes[0]?.superClassIds).toEqual([]);
    expect(report.classExpressions).toBe(1);
  });

  it('rewrites a range it does not know to a string, and counts the rewrite', () => {
    const { ontology, report } = ontologyFromTriples([
      aClass('Car'),
      typed(`${AUTO}note`, `${OWL}DatatypeProperty`),
      { subject: `${AUTO}note`, predicate: `${RDFS}range`, object: iri(`${RDFS}Literal`) },
      { subject: `${AUTO}note`, predicate: `${RDFS}domain`, object: iri(`${AUTO}Car`) },
    ]);

    expect(ontology.attributes[0]?.range).toBe('string');
    expect(report.datatypesRewritten).toBe(1);
    // Rewritten, not dropped: the attribute arrives with its name and its class.
    expect(ontology.usages).toHaveLength(1);
  });

  it('leaves out a relation with only one end, and counts it', () => {
    const { ontology, report } = ontologyFromTriples([
      aClass('Car'),
      typed(`${AUTO}drives`, `${OWL}ObjectProperty`),
      { subject: `${AUTO}drives`, predicate: `${RDFS}domain`, object: iri(`${AUTO}Car`) },
    ]);

    expect(ontology.relations).toHaveLength(0);
    expect(report.relationsWithoutBothEnds).toBe(1);
  });
});

describe('property hierarchies', () => {
  const base = [
    aClass('Person'),
    aClass('Organisation'),
    typed(`${AUTO}relatedTo`, `${OWL}ObjectProperty`),
    { subject: `${AUTO}relatedTo`, predicate: `${RDFS}domain`, object: iri(`${AUTO}Person`) },
    { subject: `${AUTO}relatedTo`, predicate: `${RDFS}range`, object: iri(`${AUTO}Organisation`) },
    typed(`${AUTO}worksFor`, `${OWL}ObjectProperty`),
    {
      subject: `${AUTO}worksFor`,
      predicate: `${RDFS}subPropertyOf`,
      object: iri(`${AUTO}relatedTo`),
    },
  ] satisfies Triple[];

  /*
   * `worksFor` states no ends of its own. It qualifies through `relatedTo`, which has both:
   * a subproperty means whatever its parent means, narrowed, so the parent's ends are the
   * most that can be said and they are enough to place it.
   */
  it('imports a subproperty that inherits both ends from its parent', () => {
    const { ontology } = ontologyFromTriples(base);

    expect(ontology.relations.map((entity) => entity.localName).sort()).toEqual([
      'relatedTo',
      'worksFor',
    ]);
    const worksFor = ontology.relations.find((entity) => entity.localName === 'worksFor');
    expect(worksFor?.superPropertyIds).toHaveLength(1);
    expect(ontology.usages.filter((usage) => usage.propertyId === worksFor?.id)).toHaveLength(1);
  });

  it('leaves out a subproperty whose ancestors have no ends either', () => {
    const orphaned = base.filter((triple) => triple.predicate !== `${RDFS}range`);
    const { ontology, report } = ontologyFromTriples(orphaned);

    expect(ontology.relations).toHaveLength(0);
    expect(report.relationsWithoutBothEnds).toBe(2);
  });
});

describe('what the document says about itself', () => {
  it('takes the namespace from the terms rather than the header, which has no separator', () => {
    const { ontology } = ontologyFromTriples([
      typed('https://example.org/auto', `${OWL}Ontology`),
      aClass('Car'),
    ]);

    expect(ontology.iri).toBe(AUTO);
  });

  it('takes the prefix from the declaration, when the document made one', () => {
    const triples = [aClass('Car')];
    expect(ontologyFromTriples(triples, { auto: AUTO }).ontology.prefix).toBe('auto');
    // A document that declared no prefix for its own namespace gets the default, not a guess.
    expect(
      ontologyFromTriples(triples, { other: 'https://example.org/other/' }).ontology.prefix,
    ).not.toBe('other');
  });

  it('keeps the ontology-level annotations', () => {
    let ontology = createEmptyOntology(AUTO, 'auto');
    ontology = addClass(ontology, { localName: 'Car' }).ontology;
    const withTitle: Ontology = {
      ...ontology,
      annotations: [{ id: 'a1', term: 'dcterms:title', value: 'Cars' }],
    };

    const restored = roundTrip(withTitle).ontology;
    expect(restored.annotations.map((annotation) => annotation.value)).toEqual(['Cars']);
  });
});

describe('a document from nowhere in particular', () => {
  it('reads an empty triple list without complaint', () => {
    const { ontology, report } = ontologyFromTriples([]);

    expect(ontology.classes).toEqual([]);
    expect(report.individuals).toBe(0);
  });

  it('sanitises a local name that would not be valid here', () => {
    const { ontology } = ontologyFromTriples([aClass('not a valid name')]);
    const [only] = ontology.classes;

    expect(only?.localName).toBeTruthy();
    expect(only?.localName).not.toContain(' ');
  });

  it('keeps two terms apart when their local names collide across namespaces', () => {
    const { ontology } = ontologyFromTriples([
      aClass('Car'),
      typed('https://elsewhere.example/Car', `${OWL}Class`),
    ]);

    const names = ontology.classes.map((entity) => entity.localName);
    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
  });

  it('ignores a layout that is not readable, and places the classes as new', () => {
    const { ontology } = ontologyFromTriples([
      typed('https://example.org/auto', `${OWL}Ontology`),
      aClass('Car'),
      {
        subject: 'https://example.org/auto',
        predicate: 'https://kodymoodley.github.io/ontoschema-site/ns#layout',
        object: literal('nonsense, frankly'),
      },
    ]);

    expect(ontology.classes[0]?.position).toEqual({ x: 0, y: 0 });
  });
});

describe('a schema built here, exported and reopened', () => {
  it('survives a class carrying an attribute used nowhere else', () => {
    let ontology = createEmptyOntology(AUTO, 'auto');
    const car = addClass(ontology, { localName: 'Car', position: { x: 40, y: 120 } });
    ontology = car.ontology;
    const price = addAttribute(ontology, { localName: 'price', range: 'decimal' });
    ontology = attachProperty(price.ontology, {
      propertyId: price.id,
      subjectClassId: car.id,
    }).ontology;

    const restored = roundTrip(ontology).ontology;
    expect(summarise(restored)).toEqual(summarise(ontology));
  });
});
