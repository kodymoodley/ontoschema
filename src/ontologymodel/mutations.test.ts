import { describe, expect, it } from 'vitest';
import { buildAutoOntology } from '../../tests/fixtures/autoOntology';
import {
  addAnnotation,
  addClass,
  addDatatypeProperty,
  addObjectProperty,
  addSubClassOf,
  deleteClass,
  deleteObjectProperty,
  removeAnnotation,
  renameClass,
  renameObjectProperty,
  setDatatypePropertyRange,
  setObjectPropertyEndpoints,
  setOntologyIri,
  setSuperClass,
  updateAnnotation,
} from './mutations';
import { createEmptyOntology, findClass, findObjectProperty, attributesOfClass } from './ontology';

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

  it('renames without disturbing identity, so relations survive', () => {
    const { ontology: base, ids } = buildAutoOntology();
    const renamed = renameClass(base, ids.car, 'Automobile');
    expect(findClass(renamed, ids.car)?.localName).toBe('Automobile');
    expect(findObjectProperty(renamed, ids.offeredBy)?.domainClassId).toBe(ids.car);
    expect(attributesOfClass(renamed, ids.car)).toHaveLength(5);
  });

  it('avoids collisions on rename by suffixing', () => {
    const { ontology, ids } = buildAutoOntology();
    const renamed = renameClass(ontology, ids.truck, 'Car');
    expect(findClass(renamed, ids.truck)?.localName).toBe('Car2');
  });

  it('is immutable — the input ontology is never modified', () => {
    const { ontology, ids } = buildAutoOntology();
    const snapshot = JSON.stringify(ontology);
    renameClass(ontology, ids.car, 'Automobile');
    deleteClass(ontology, ids.car);
    addSubClassOf(ontology, ids.truck, ids.car);
    expect(JSON.stringify(ontology)).toBe(snapshot);
  });
});

describe('deleting a class that has relations', () => {
  it('removes its attributes, its relations, and its appearance as a superclass', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = deleteClass(ontology, ids.car);

    expect(findClass(after, ids.car)).toBeUndefined();
    expect(attributesOfClass(after, ids.car)).toHaveLength(0);
    expect(after.datatypeProperties).toHaveLength(0);
    expect(findObjectProperty(after, ids.offeredBy)).toBeUndefined();
  });

  it('drops the deleted class from its children’s superclass lists', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = deleteClass(ontology, ids.vehicle);
    expect(findClass(after, ids.car)?.superClassIds).toEqual([]);
    expect(findClass(after, ids.truck)?.superClassIds).toEqual([]);
  });

  it('leaves generic object properties alone, since they never referenced the class', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = deleteClass(ontology, ids.car);
    expect(findObjectProperty(after, ids.hasPart)).toBeDefined();
  });

  it('leaves unrelated classes and their attributes intact', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = deleteClass(ontology, ids.truck);
    expect(findClass(after, ids.car)).toBeDefined();
    expect(attributesOfClass(after, ids.car)).toHaveLength(5);
    expect(findObjectProperty(after, ids.offeredBy)).toBeDefined();
  });
});

describe('subclass links', () => {
  it('refuses to make a class its own superclass', () => {
    const { ontology, ids } = buildAutoOntology();
    expect(addSubClassOf(ontology, ids.car, ids.car)).toBe(ontology);
  });

  it('refuses to close a cycle', () => {
    const { ontology, ids } = buildAutoOntology();
    // Car is already below Vehicle; making Vehicle a subclass of Car would close the loop.
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

  it('does not add the same parent twice', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = addSubClassOf(
      addSubClassOf(ontology, ids.car, ids.vehicle),
      ids.car,
      ids.vehicle,
    );
    expect(findClass(after, ids.car)?.superClassIds).toEqual([ids.vehicle]);
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

describe('datatype properties', () => {
  it('lower-camel-cases attribute names and defaults the range to string', () => {
    const { ontology, id } = addDatatypeProperty(createEmptyOntology(), {
      localName: 'Engine Size',
    });
    const property = ontology.datatypeProperties.find((p) => p.id === id);
    expect(property?.localName).toBe('engineSize');
    expect(property?.range).toBe('string');
  });

  it('changes the range', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = setDatatypePropertyRange(ontology, ids.year, 'dateTime');
    expect(after.datatypeProperties.find((p) => p.id === ids.year)?.range).toBe('dateTime');
  });

  it('shares one namespace with object properties when deduplicating names', () => {
    const { ontology } = buildAutoOntology();
    const added = addDatatypeProperty(ontology, { localName: 'offeredBy' });
    expect(added.ontology.datatypeProperties.at(-1)?.localName).toBe('offeredBy2');
  });
});

describe('object properties', () => {
  it('creates generic properties with no domain or range and keeps them that way', () => {
    const { ontology, id } = addObjectProperty(createEmptyOntology(), {
      localName: 'isRelatedTo',
      kind: 'generic',
      domainClassId: 'ignored',
      rangeClassId: 'ignored',
    });
    const property = ontology.objectProperties.find((p) => p.id === id);
    expect(property?.domainClassId).toBeNull();
    expect(property?.rangeClassId).toBeNull();
  });

  it('re-points an existing relation to a different range', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = setObjectPropertyEndpoints(ontology, ids.offeredBy, {
      rangeClassId: ids.organization,
    });
    const property = findObjectProperty(after, ids.offeredBy);
    expect(property?.domainClassId).toBe(ids.car);
    expect(property?.rangeClassId).toBe(ids.organization);
  });

  it('renames without touching endpoints', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = renameObjectProperty(ontology, ids.offeredBy, 'sold by');
    const property = findObjectProperty(after, ids.offeredBy);
    expect(property?.localName).toBe('soldBy');
    expect(property?.rangeClassId).toBe(ids.dealership);
  });

  it('deleting a relation leaves both classes standing', () => {
    const { ontology, ids } = buildAutoOntology();
    const after = deleteObjectProperty(ontology, ids.offeredBy);
    expect(findClass(after, ids.car)).toBeDefined();
    expect(findClass(after, ids.dealership)).toBeDefined();
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

  it('normalises language tags so en-gb and EN-GB are one tag', () => {
    const { ontology, ids } = buildAutoOntology();
    const added = addAnnotation(ontology, 'class', ids.truck, 'rdfs:label', 'Lorry');
    const id = findClass(added, ids.truck)?.annotations[0]?.id ?? '';
    const tagged = updateAnnotation(added, 'class', ids.truck, id, { language: 'EN-gb' });
    expect(findClass(tagged, ids.truck)?.annotations[0]?.language).toBe('en-GB');
  });

  it('clears the language tag when set to empty', () => {
    const { ontology, ids } = buildAutoOntology();
    const id = ontology.classes.find((c) => c.id === ids.car)?.annotations[0]?.id ?? '';
    const cleared = updateAnnotation(ontology, 'class', ids.car, id, { language: '' });
    expect(findClass(cleared, ids.car)?.annotations[0]?.language).toBeUndefined();
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
