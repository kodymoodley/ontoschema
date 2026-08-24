import { describe, expect, it } from 'vitest';
import { buildAutoOntology } from '../../tests/fixtures/autoOntology';
import {
  createAnnotation,
  createEmptyOntology,
  createId,
  createProject,
  findAttribute,
  findClass,
  findRelation,
  indexOntology,
  isOntologyEmpty,
  relationUsages,
  relationUsagesTouchingClass,
  usageCount,
} from './ontology';

/**
 * The model's own queries, tested directly.
 *
 * They had no test file of their own until mutation testing pointed it out: every function here
 * runs on nearly every keystroke, through a panel or a serializer, and so counted as covered —
 * while a mutant could invert a condition in `indexOntology` or empty the result of
 * `relationUsagesTouchingClass` and no assertion anywhere would notice.
 */

describe('creating things', () => {
  it('gives every id its prefix and a distinct tail', () => {
    const ids = Array.from({ length: 200 }, () => createId('cls'));

    for (const id of ids) expect(id.startsWith('cls_')).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    // A prefix on its own would make every id equal; the tail is what distinguishes them.
    expect(new Set(ids.map((id) => id.slice('cls_'.length))).size).toBe(ids.length);
  });

  it('starts a project on an empty ontology, timestamped', () => {
    const project = createProject('Vehicles');

    expect(project.name).toBe('Vehicles');
    expect(isOntologyEmpty(project.ontology)).toBe(true);
    expect(project.createdAt).toBe(project.updatedAt);
    expect(Number.isNaN(Date.parse(project.createdAt))).toBe(false);
  });

  it('makes an annotation carrying its term, and a language only when given one', () => {
    expect(createAnnotation('rdfs:label', 'Car', 'en')).toMatchObject({
      term: 'rdfs:label',
      value: 'Car',
      language: 'en',
    });
    expect(createAnnotation('rdfs:label').value).toBe('');
    expect(createAnnotation('rdfs:label', 'Car').language).toBeUndefined();
  });
});

describe('isOntologyEmpty', () => {
  it('is true only when all three kinds are absent', () => {
    const empty = createEmptyOntology();
    expect(isOntologyEmpty(empty)).toBe(true);

    // One of each kind on its own is enough to make it non-empty.
    const { ontology } = buildAutoOntology();
    expect(isOntologyEmpty({ ...empty, classes: ontology.classes })).toBe(false);
    expect(isOntologyEmpty({ ...empty, relations: ontology.relations })).toBe(false);
    expect(isOntologyEmpty({ ...empty, attributes: ontology.attributes })).toBe(false);
  });

  it('does not count annotations or a namespace as content', () => {
    const named = createEmptyOntology('https://example.org/auto/', 'auto');
    expect(
      isOntologyEmpty({ ...named, annotations: [createAnnotation('dcterms:title', 'A')] }),
    ).toBe(true);
  });
});

describe('finding one thing by id', () => {
  it('finds each kind in its own list and nowhere else', () => {
    const { ontology, ids } = buildAutoOntology();

    expect(findClass(ontology, ids.car)?.localName).toBe('Car');
    expect(findRelation(ontology, ids.offeredBy)?.localName).toBe('offeredBy');
    expect(findAttribute(ontology, ids.price)?.localName).toBe('price');

    // A relation is not an attribute, however alike the two lookups are.
    expect(findAttribute(ontology, ids.offeredBy)).toBeUndefined();
    expect(findRelation(ontology, ids.price)).toBeUndefined();
    expect(findClass(ontology, 'nothing')).toBeUndefined();
  });
});

describe('indexOntology', () => {
  it('files every usage under its class and its property', () => {
    const { ontology, ids } = buildAutoOntology();
    const index = indexOntology(ontology);

    expect(index.classById.get(ids.car)?.localName).toBe('Car');
    expect(index.attributeUsagesByClass.get(ids.car)).toHaveLength(5);
    expect(index.usagesByProperty.get(ids.offeredBy)).toHaveLength(1);
    // An attribute usage is filed as an attribute, not as a relation.
    expect(index.relationUsagesByClass.get(ids.car)).toHaveLength(1);
  });

  /*
   * A usage whose class has been deleted is skipped rather than filed under an id that names
   * nothing. Everything downstream reads these maps, so a dangling entry becomes a class that
   * cannot be drawn or a shape with no target.
   */
  it('skips a usage whose subject class is gone', () => {
    const { ontology, ids } = buildAutoOntology();
    const orphaned = {
      ...ontology,
      classes: ontology.classes.filter((entity) => entity.id !== ids.car),
    };
    const index = indexOntology(orphaned);

    expect(index.attributeUsagesByClass.get(ids.car)).toBeUndefined();
    expect(index.usagesByProperty.get(ids.price)?.some((u) => u.subjectClassId === ids.car)).toBe(
      undefined,
    );
  });
});

describe('counting and collecting usages', () => {
  it('counts how many classes carry a property', () => {
    const { ontology, ids } = buildAutoOntology();
    expect(usageCount(ontology, ids.price)).toBe(1);
    expect(usageCount(ontology, 'nothing')).toBe(0);
  });

  it('collects relation usages, and only those with both ends still present', () => {
    const { ontology, ids } = buildAutoOntology();
    expect(relationUsages(ontology)).toHaveLength(1);

    const withoutTarget = {
      ...ontology,
      classes: ontology.classes.filter((entity) => entity.id !== ids.dealership),
    };
    expect(relationUsages(withoutTarget)).toHaveLength(0);
  });

  /* Touching means either end: the edges drawn from a class and the edges drawn at it. */
  it('finds a class at either end of a relation', () => {
    const { ontology, ids } = buildAutoOntology();

    expect(relationUsagesTouchingClass(ontology, ids.car)).toHaveLength(1);
    expect(relationUsagesTouchingClass(ontology, ids.dealership)).toHaveLength(1);
    expect(relationUsagesTouchingClass(ontology, 'nothing')).toHaveLength(0);
    // An attribute usage does not touch anything: it has one end.
    expect(
      relationUsagesTouchingClass(ontology, ids.car).every((u) => u.propertyId === ids.offeredBy),
    ).toBe(true);
  });
});
