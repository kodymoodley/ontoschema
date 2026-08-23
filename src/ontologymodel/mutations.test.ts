import { describe, expect, it } from 'vitest';
import { buildAutoOntology } from '../../tests/fixtures/autoOntology';
import {
  addAnnotation,
  addAttributeToClass,
  addClass,
  addRelation,
  addRelationBetween,
  addSubClassOf,
  removeSubClassOf,
  attachProperty,
  deleteClass,
  deleteAttribute,
  deleteRelation,
  detachUsage,
  removeAnnotation,
  renameClass,
  renameRelation,
  setAttributeRange,
  setOntologyIri,
  setSuperClass,
  setUsageEndpoints,
  updateAnnotation,
} from './mutations';
import {
  attributeUsagesOfClass,
  createEmptyOntology,
  findClass,
  findRelation,
  relationUsagesTouchingClass,
  usagesOfProperty,
} from './ontology';

describe('class mutations', () => {
  it('normalises the name of a newly dropped class', () => {
    const { ontology } = addClass(createEmptyOntology(), { localName: 'used car' });
    expect(ontology.classes[0]?.localName).toBe('UsedCar');
  });

  it('deduplicates names so two dropped classes never collide', () => {
    const first = addClass(createEmptyOntology(), { localName: 'Car' });
    const second = addClass(first.ontology, { localName: 'Car' });
    expect(second.ontology.classes.map((c) => c.localName)).toEqual(['Car', 'Car2']);
  });

  it('leaves the model untouched when a rename would produce an empty name', () => {
    const { ontology, id } = addClass(createEmptyOntology(), { localName: 'Car' });
    expect(renameClass(ontology, id, '   ')).toBe(ontology);
    expect(renameClass(ontology, id, '///')).toBe(ontology);
  });

  it('renames without disturbing identity, so usages survive', () => {
    const { ontology: base, ids } = buildAutoOntology();
    const renamed = renameClass(base, ids.car, 'Automobile');
    expect(findClass(renamed, ids.car)?.localName).toBe('Automobile');
    expect(attributeUsagesOfClass(renamed, ids.car)).toHaveLength(5);
    expect(relationUsagesTouchingClass(renamed, ids.car)).toHaveLength(1);
  });

  it('is immutable — the input ontology is never modified', () => {
    const { ontology, ids } = buildAutoOntology();
    const snapshot = JSON.stringify(ontology);
    renameClass(ontology, ids.car, 'Automobile');
    deleteClass(ontology, ids.car);
    addSubClassOf(ontology, ids.truck, ids.car);
    attachProperty(ontology, { propertyId: ids.price, subjectClassId: ids.truck });
    expect(JSON.stringify(ontology)).toBe(snapshot);
  });
});

describe('deleting a class', () => {
  it('removes every usage that touched it, but keeps the properties themselves', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = deleteClass(ontology, ids.car);

    expect(findClass(after, ids.car)).toBeUndefined();
    expect(attributeUsagesOfClass(after, ids.car)).toHaveLength(0);
    expect(after.usages).toHaveLength(0);

    // The properties are a reusable pool; they were never owned by the class.
    expect(after.attributes).toHaveLength(5);
    expect(findRelation(after, ids.offeredBy)).toBeDefined();
  });

  it('removes relations pointing at the deleted class as well as from it', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = deleteClass(ontology, ids.dealership);
    expect(usagesOfProperty(after, ids.offeredBy)).toHaveLength(0);
  });

  it('drops the deleted class from its children’s superclass lists', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = deleteClass(ontology, ids.vehicle);
    expect(findClass(after, ids.car)?.superClassIds).toEqual([]);
    expect(findClass(after, ids.truck)?.superClassIds).toEqual([]);
  });

  it('leaves unrelated classes and their attributes intact', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = deleteClass(ontology, ids.truck);
    expect(findClass(after, ids.car)).toBeDefined();
    expect(attributeUsagesOfClass(after, ids.car)).toHaveLength(5);
    expect(usagesOfProperty(after, ids.offeredBy)).toHaveLength(1);
  });
});

describe('subclass links', () => {
  it('keeps every parent a class is given', () => {
    const { ontology, ids } = buildAutoOntology();
    const both = addSubClassOf(addSubClassOf(ontology, ids.car, ids.vehicle), ids.car, ids.truck);
    expect(findClass(both, ids.car)?.superClassIds).toEqual([ids.vehicle, ids.truck]);
  });

  it('drops only the parent named, leaving the rest', () => {
    const { ontology, ids } = buildAutoOntology();
    const both = addSubClassOf(addSubClassOf(ontology, ids.car, ids.vehicle), ids.car, ids.truck);
    const one = removeSubClassOf(both, ids.car, ids.vehicle);
    expect(findClass(one, ids.car)?.superClassIds).toEqual([ids.truck]);
  });

  it('leaves a class alone when told to drop a parent it does not have', () => {
    const { ontology, ids } = buildAutoOntology();
    const before = findClass(ontology, ids.car)?.superClassIds;
    const after = removeSubClassOf(ontology, ids.car, ids.truck);
    expect(findClass(after, ids.car)?.superClassIds).toEqual(before);
  });

  it('refuses to make a class its own superclass', () => {
    const { ontology, ids } = buildAutoOntology();
    expect(addSubClassOf(ontology, ids.car, ids.car)).toBe(ontology);
  });

  it('refuses to close a cycle', () => {
    const { ontology, ids } = buildAutoOntology();
    const attempted = addSubClassOf(ontology, ids.vehicle, ids.car);
    expect(findClass(attempted, ids.vehicle)?.superClassIds).toEqual([]);
  });

  it('refuses to close a longer cycle', () => {
    const { ontology: base, ids } = buildAutoOntology();
    const sedan = addClass(base, { localName: 'Sedan' });
    const ontology = addSubClassOf(sedan.ontology, sedan.id, ids.car);
    const attempted = addSubClassOf(ontology, ids.vehicle, sedan.id);
    expect(findClass(attempted, ids.vehicle)?.superClassIds).toEqual([]);
  });

  it('permits multiple inheritance', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = addSubClassOf(ontology, ids.dealership, ids.vehicle);
    expect(findClass(after, ids.dealership)?.superClassIds).toEqual([
      ids.organization,
      ids.vehicle,
    ]);
  });

  it('re-parents to a single superclass, and to none when given null', () => {
    const { ontology, ids } = buildAutoOntology();
    const reparented = setSuperClass(ontology, ids.dealership, ids.vehicle);
    expect(findClass(reparented, ids.dealership)?.superClassIds).toEqual([ids.vehicle]);
    const promoted = setSuperClass(reparented, ids.dealership, null);
    expect(findClass(promoted, ids.dealership)?.superClassIds).toEqual([]);
  });

  it('refuses a re-parent that would close a cycle', () => {
    const { ontology, ids } = buildAutoOntology();
    expect(setSuperClass(ontology, ids.vehicle, ids.car)).toBe(ontology);
  });
});

describe('attributes', () => {
  it('creates the property and attaches it in one step', () => {
    const withClass = addClass(createEmptyOntology(), { localName: 'Car' });
    const added = addAttributeToClass(withClass.ontology, {
      classId: withClass.id,
      localName: 'Engine Size',
    });
    const property = added.ontology.attributes.find((p) => p.id === added.propertyId);
    expect(property?.localName).toBe('engineSize');
    expect(property?.range).toBe('string');
    expect(attributeUsagesOfClass(added.ontology, withClass.id)).toHaveLength(1);
  });

  it('carries one global range, since a property is the same datatype wherever it is used', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = setAttributeRange(ontology, ids.year, 'dateTime');
    expect(after.attributes.find((p) => p.id === ids.year)?.range).toBe('dateTime');
  });

  it('shares one namespace with relations when deduplicating names', () => {
    const { ontology, ids } = buildAutoOntology();
    const added = addAttributeToClass(ontology, { classId: ids.truck, localName: 'offeredBy' });
    expect(added.ontology.attributes.at(-1)?.localName).toBe('offeredBy2');
  });

  it('deleting a property removes every usage of it', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = deleteAttribute(ontology, ids.price);
    expect(usagesOfProperty(after, ids.price)).toHaveLength(0);
    expect(attributeUsagesOfClass(after, ids.car)).toHaveLength(4);
  });
});

describe('relations', () => {
  it('is created unused, with nothing on the canvas to show for it', () => {
    const { ontology, id } = addRelation(createEmptyOntology(), { localName: 'isRelatedTo' });
    expect(usagesOfProperty(ontology, id)).toHaveLength(0);
    expect(ontology.usages).toHaveLength(0);
  });

  it('renames without touching its usages', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = renameRelation(ontology, ids.offeredBy, 'sold by');
    expect(findRelation(after, ids.offeredBy)?.localName).toBe('soldBy');
    expect(usagesOfProperty(after, ids.offeredBy)).toHaveLength(1);
  });

  it('deleting a property removes its relations but leaves both classes standing', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = deleteRelation(ontology, ids.offeredBy);
    expect(findClass(after, ids.car)).toBeDefined();
    expect(findClass(after, ids.dealership)).toBeDefined();
    expect(usagesOfProperty(after, ids.offeredBy)).toHaveLength(0);
  });
});

describe('usages', () => {
  it('attaches the same property to several classes', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = attachProperty(ontology, {
      propertyId: ids.price,
      subjectClassId: ids.truck,
    }).ontology;
    expect(usagesOfProperty(after, ids.price)).toHaveLength(2);
    expect(attributeUsagesOfClass(after, ids.truck)).toHaveLength(1);
  });

  it('is idempotent: attaching the same triple twice is one usage', () => {
    const { ontology, ids } = buildAutoOntology();
    const once = attachProperty(ontology, { propertyId: ids.price, subjectClassId: ids.truck });
    const twice = attachProperty(once.ontology, {
      propertyId: ids.price,
      subjectClassId: ids.truck,
    });
    expect(twice.ontology.usages).toHaveLength(once.ontology.usages.length);
    expect(twice.id).toBe(once.id);
  });

  it('draws the same relation between a second pair of classes', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = attachProperty(ontology, {
      propertyId: ids.offeredBy,
      subjectClassId: ids.truck,
      objectClassId: ids.organization,
    }).ontology;
    expect(usagesOfProperty(after, ids.offeredBy)).toHaveLength(2);
  });

  it('refuses to attach an unknown property or to a missing class', () => {
    const { ontology, ids } = buildAutoOntology();
    expect(attachProperty(ontology, { propertyId: 'nope', subjectClassId: ids.car }).ontology).toBe(
      ontology,
    );
    expect(
      attachProperty(ontology, { propertyId: ids.price, subjectClassId: 'nope' }).ontology,
    ).toBe(ontology);
  });

  it('detaching removes the usage but keeps the property', () => {
    const { ontology, ids, usageIds } = buildAutoOntology();
    const after = detachUsage(ontology, usageIds.offeredBy);
    expect(usagesOfProperty(after, ids.offeredBy)).toHaveLength(0);
    expect(findRelation(after, ids.offeredBy)).toBeDefined();
  });

  it('re-points one end of a relation', () => {
    const { ontology, ids, usageIds } = buildAutoOntology();
    const after = setUsageEndpoints(ontology, usageIds.offeredBy, {
      objectClassId: ids.organization,
    });
    const usage = after.usages.find((entry) => entry.id === usageIds.offeredBy);
    expect(usage?.subjectClassId).toBe(ids.car);
    expect(usage?.objectClassId).toBe(ids.organization);
  });

  it('creates a relation and its property together', () => {
    const { ontology: base, ids } = buildAutoOntology();
    const created = addRelationBetween(base, {
      localName: 'servicedBy',
      subjectClassId: ids.car,
      objectClassId: ids.dealership,
    });
    expect(usagesOfProperty(created.ontology, created.propertyId)).toHaveLength(1);
    expect(created.ontology.relations.find((p) => p.id === created.propertyId)?.localName).toBe(
      'servicedBy',
    );
  });
});

describe('annotations', () => {
  it('adds, edits and removes annotations on a class', () => {
    const { ontology, ids } = buildAutoOntology();
    const added = addAnnotation(ontology, 'class', ids.truck, 'skos:prefLabel', 'Truck', 'en');
    const annotation = findClass(added, ids.truck)?.annotations[0];
    expect(annotation?.value).toBe('Truck');

    const edited = updateAnnotation(added, 'class', ids.truck, annotation?.id ?? '', {
      value: 'Lorry',
    });
    expect(findClass(edited, ids.truck)?.annotations[0]?.value).toBe('Lorry');

    const removed = removeAnnotation(edited, 'class', ids.truck, annotation?.id ?? '');
    expect(findClass(removed, ids.truck)?.annotations).toHaveLength(0);
  });

  it('settles the casing of a language tag, so EN and en are one tag', () => {
    const { ontology, ids } = buildAutoOntology();
    const added = addAnnotation(ontology, 'class', ids.truck, 'rdfs:label', 'Lorry');
    const id = findClass(added, ids.truck)?.annotations[0]?.id ?? '';
    const tagged = updateAnnotation(added, 'class', ids.truck, id, { language: ' EN ' });
    expect(findClass(tagged, ids.truck)?.annotations[0]?.language).toBe('en');
  });

  it('refuses a language tag that is not a language, rather than storing it', () => {
    const { ontology, ids } = buildAutoOntology();
    const added = addAnnotation(ontology, 'class', ids.truck, 'rdfs:label', 'Lorry', 'en');
    const id = findClass(added, ids.truck)?.annotations[0]?.id ?? '';

    /*
     * The model is where this has to be turned away. Catching it only in the writer would leave
     * the tag sitting in the project file and silently missing from the export, which is the
     * behaviour this replaced.
     */
    for (const rejected of ['zz', 'en-GB', 'eng', 'xx']) {
      const attempt = updateAnnotation(added, 'class', ids.truck, id, { language: rejected });
      expect(
        findClass(attempt, ids.truck)?.annotations[0]?.language,
        `${rejected} should not be stored`,
      ).toBeUndefined();
    }
  });

  /*
   * Asserted in two steps, and the first is the one that matters. `x[0]?.language` is undefined
   * when `x[0]` is undefined, so a single `toBeUndefined()` passed whether the tag had been
   * cleared or the whole annotation deleted -- and, with the id defaulted to '', even when the
   * fixture carried no annotation for the call to act on.
   */
  it('clears the language tag when set to empty', () => {
    const { ontology, ids } = buildAutoOntology();
    const before = findClass(ontology, ids.car)?.annotations ?? [];
    const tagged = before.find((annotation) => annotation.language !== undefined);
    expect(tagged, 'the fixture has no tagged annotation to clear').toBeDefined();

    const cleared = updateAnnotation(ontology, 'class', ids.car, tagged!.id, { language: '' });
    const after = findClass(cleared, ids.car)?.annotations ?? [];
    const same = after.find((annotation) => annotation.id === tagged!.id);

    // Still there, still saying the same thing, and only the tag gone.
    expect(after).toHaveLength(before.length);
    expect(same?.value).toBe(tagged!.value);
    expect(same?.language).toBeUndefined();
  });

  it('keeps several annotations that use the same term', () => {
    const { ontology, ids } = buildAutoOntology();
    const labels = findClass(ontology, ids.car)?.annotations.filter(
      (a) => a.term === 'skos:prefLabel',
    );
    expect(labels?.map((a) => a.language)).toEqual(['en', 'nl']);
  });
});

describe('ontology header', () => {
  it('normalises the namespace when the base IRI is set', () => {
    const ontology = setOntologyIri(createEmptyOntology(), 'https://example.org/auto');
    expect(ontology.iri).toBe('https://example.org/auto#');
  });
});
