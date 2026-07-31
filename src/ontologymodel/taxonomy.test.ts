import { describe, expect, it } from 'vitest';
import { buildAutoOntology } from '../../tests/fixtures/autoOntology';
import { addClass, addDatatypeProperty, addSubClassOf, setSuperObjectProperty } from './mutations';
import {
  canSubclass,
  classForest,
  classWithDescendants,
  datatypePropertyList,
  objectPropertyForest,
  rootClasses,
  subClassEdges,
  taxonomyModules,
} from './taxonomy';

describe('classForest', () => {
  it('nests children under their parents with correct depths', () => {
    const { ontology } = buildAutoOntology();
    const forest = classForest(ontology);
    const names = forest.map((node) => node.entity.localName);
    expect(names).toEqual(['Vehicle', 'Organization']);

    const vehicle = forest[0];
    expect(vehicle?.depth).toBe(0);
    expect(vehicle?.children.map((c) => c.entity.localName)).toEqual(['Car', 'Truck']);
    expect(vehicle?.children[0]?.depth).toBe(1);
  });

  it('lists a multi-parent class under each of its parents', () => {
    const { ontology, ids } = buildAutoOntology();
    const multi = addSubClassOf(ontology, ids.dealership, ids.vehicle);
    const forest = classForest(multi);
    const under = (root: string) =>
      forest
        .find((node) => node.entity.localName === root)
        ?.children.map((child) => child.entity.localName) ?? [];
    expect(under('Vehicle')).toContain('Dealership');
    expect(under('Organization')).toContain('Dealership');
  });

  it('treats a class whose parent no longer exists as a root', () => {
    const { ontology } = buildAutoOntology();
    const orphaned = {
      ...ontology,
      classes: ontology.classes.map((entity) =>
        entity.localName === 'Car' ? { ...entity, superClassIds: ['deleted_id'] } : entity,
      ),
    };
    expect(rootClasses(orphaned).map((c) => c.localName)).toContain('Car');
  });

  it('terminates on a corrupt cyclic document instead of recursing forever', () => {
    const { ontology, ids } = buildAutoOntology();
    // Bypasses the mutation guard the way a hand-edited project file would.
    const corrupt = {
      ...ontology,
      classes: ontology.classes.map((entity) =>
        entity.id === ids.vehicle ? { ...entity, superClassIds: [ids.car] } : entity,
      ),
    };
    const forest = classForest(corrupt);
    expect(Array.isArray(forest)).toBe(true);
    expect(() => JSON.stringify(forest)).not.toThrow();
  });
});

describe('cycle prevention', () => {
  it('rejects self-parenting and direct inversion', () => {
    const { ontology, ids } = buildAutoOntology();
    expect(canSubclass(ontology, ids.car, ids.car)).toBe(false);
    expect(canSubclass(ontology, ids.vehicle, ids.car)).toBe(false);
  });

  it('rejects an indirect cycle three levels deep', () => {
    const { ontology: base, ids } = buildAutoOntology();
    const sedan = addClass(base, { localName: 'Sedan' });
    const withSedan = addSubClassOf(sedan.ontology, sedan.id, ids.car);
    const coupe = addClass(withSedan, { localName: 'Coupe' });
    const ontology = addSubClassOf(coupe.ontology, coupe.id, sedan.id);
    expect(canSubclass(ontology, ids.vehicle, coupe.id)).toBe(false);
  });

  it('allows an unrelated pairing', () => {
    const { ontology, ids } = buildAutoOntology();
    expect(canSubclass(ontology, ids.dealership, ids.vehicle)).toBe(true);
  });
});

describe('taxonomy modules', () => {
  it('groups every class under the root it descends from', () => {
    const { ontology, ids } = buildAutoOntology();
    const modules = taxonomyModules(ontology);
    expect(modules.map((m) => m.root.localName)).toEqual(['Vehicle', 'Organization']);

    const vehicleModule = modules.find((m) => m.root.localName === 'Vehicle');
    expect(vehicleModule?.members).toEqual(
      expect.arrayContaining([ids.vehicle, ids.car, ids.truck]),
    );
    expect(vehicleModule?.members).not.toContain(ids.dealership);
  });

  it('gives every class in the model a module', () => {
    const { ontology } = buildAutoOntology();
    const covered = new Set(taxonomyModules(ontology).flatMap((m) => m.members));
    expect(covered.size).toBe(ontology.classes.length);
  });
});

describe('classWithDescendants', () => {
  it('includes the class itself and everything below it', () => {
    const { ontology, ids } = buildAutoOntology();
    const names = classWithDescendants(ontology, ids.vehicle).map((c) => c.localName);
    expect(names).toEqual(expect.arrayContaining(['Vehicle', 'Car', 'Truck']));
    expect(names).toHaveLength(3);
  });

  it('returns just the class for a leaf', () => {
    const { ontology, ids } = buildAutoOntology();
    expect(classWithDescendants(ontology, ids.truck).map((c) => c.localName)).toEqual(['Truck']);
  });
});

describe('subClassEdges', () => {
  it('emits one edge per direct link and skips links to missing classes', () => {
    const { ontology, ids } = buildAutoOntology();
    const edges = subClassEdges(ontology);
    expect(edges).toHaveLength(3);
    expect(edges).toContainEqual({ childId: ids.car, parentId: ids.vehicle });

    const dangling = {
      ...ontology,
      classes: ontology.classes.map((entity) =>
        entity.id === ids.truck ? { ...entity, superClassIds: ['gone'] } : entity,
      ),
    };
    expect(subClassEdges(dangling)).toHaveLength(2);
  });
});

describe('object property hierarchy', () => {
  it('nests subproperties and refuses cycles', () => {
    const { ontology, ids } = buildAutoOntology();
    const nested = setSuperObjectProperty(ontology, ids.offeredBy, ids.hasPart);
    const forest = objectPropertyForest(nested);
    expect(forest.map((n) => n.entity.localName)).toEqual(['hasPart']);
    expect(forest[0]?.children.map((n) => n.entity.localName)).toEqual(['offeredBy']);

    expect(setSuperObjectProperty(nested, ids.hasPart, ids.offeredBy)).toBe(nested);
  });
});

describe('datatype property pool', () => {
  it('is a flat alphabetical list, not a hierarchy', () => {
    const { ontology } = buildAutoOntology();
    expect(datatypePropertyList(ontology).map((property) => property.localName)).toEqual([
      'engine',
      'make',
      'model',
      'price',
      'year',
    ]);
  });

  it('lists a property that is not used by any class', () => {
    const { ontology } = buildAutoOntology();
    const added = addDatatypeProperty(ontology, { localName: 'vin' });
    expect(datatypePropertyList(added.ontology).map((p) => p.localName)).toContain('vin');
  });
});
