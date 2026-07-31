import { describe, expect, it } from 'vitest';
import {
  allScenarios,
  buildAdversarialNames,
  buildDeepTaxonomy,
  buildDegenerate,
  buildDiamond,
  buildLarge,
  buildMultiTarget,
  buildPropertyHierarchy,
} from '../../tests/fixtures/scenarios';
import type { Ontology } from './types';
import { addSubClassOf, deleteClass, renameClass } from './mutations';
import {
  attributeUsagesOfClass,
  indexOntology,
  relationUsages,
  usagesOfProperty,
} from './ontology';
import {
  canSubclass,
  classForest,
  classWithDescendants,
  rootClasses,
  subClassEdges,
  taxonomyModules,
} from './taxonomy';
import { entityIri, validateLocalName } from './identifier';
import { ontologyToTriples } from './triples';

/**
 * Invariants that must hold for *any* ontology, checked against every awkward shape rather
 * than the one tidy example. A rule that only survives the happy path is not a rule.
 */
describe.each(allScenarios())('$name', ({ ontology }) => {
  it('gives every entity a distinct, legal IRI', () => {
    const names = [
      ...ontology.classes.map((e) => e.localName),
      ...ontology.objectProperties.map((e) => e.localName),
      ...ontology.datatypeProperties.map((e) => e.localName),
    ];
    for (const name of names) {
      expect(validateLocalName(name).valid, `"${name}" is not a legal local name`).toBe(true);
    }
    const iris = names.map((name) => entityIri(ontology.iri, name));
    expect(new Set(iris).size).toBe(iris.length);
  });

  it('has no subclass cycles', () => {
    for (const entity of ontology.classes) {
      // Being able to re-add an existing parent proves that link is not part of a cycle.
      for (const parentId of entity.superClassIds) {
        if (!ontology.classes.some((c) => c.id === parentId)) continue;
        expect(canSubclass(ontology, entity.id, parentId), `${entity.localName} cycles`).toBe(true);
      }
    }
  });

  it('places every class in exactly the modules it descends from', () => {
    const covered = new Set(taxonomyModules(ontology).flatMap((module) => module.members));
    // Every class is reachable from some root, because a class with no live parent is one.
    expect(covered.size).toBe(ontology.classes.length);
  });

  it('builds a finite forest', () => {
    const forest = classForest(ontology);
    expect(() => JSON.stringify(forest)).not.toThrow();
    expect(forest.length).toBe(rootClasses(ontology).length);
  });

  it('never emits a duplicate triple', () => {
    const triples = ontologyToTriples(ontology);
    const keys = triples.map(
      (t) =>
        `${t.subject}|${t.predicate}|${t.object.value}|${
          t.object.type === 'literal' ? (t.object.language ?? '') : ''
        }`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('emits no triple referring to something that does not exist', () => {
    const triples = ontologyToTriples(ontology);

    const live = new Set([
      ...ontology.classes.map((e) => entityIri(ontology.iri, e.localName)),
      ...ontology.objectProperties.map((e) => entityIri(ontology.iri, e.localName)),
      ...ontology.datatypeProperties.map((e) => entityIri(ontology.iri, e.localName)),
    ]);

    /*
     * Shapes and their `sh:or` cells are generated into the same namespace, so they are not
     * entities — but they are only legitimate if something actually describes them. Anything
     * that is a subject somewhere qualifies; anything else is a dangling reference.
     */
    const described = new Set(triples.map((triple) => triple.subject));

    const dangling = triples
      .filter((triple) => triple.object.type === 'iri')
      .map((triple) => triple.object.value)
      .filter((value) => value.startsWith(ontology.iri))
      .filter((value) => !live.has(value) && !described.has(value));

    expect(dangling).toEqual([]);
  });
});

describe('deep taxonomy', () => {
  const ontology = buildDeepTaxonomy(8, 3);

  it('keeps a single spine eight levels deep', () => {
    const depths = (function measure(nodes: ReturnType<typeof classForest>): number {
      return nodes.length === 0 ? 0 : 1 + Math.max(...nodes.map((n) => measure(n.children)));
    })(classForest(ontology));
    expect(depths).toBeGreaterThanOrEqual(8);
  });

  it('collects the whole spine as descendants of the root', () => {
    const root = rootClasses(ontology)[0]!;
    expect(classWithDescendants(ontology, root.id)).toHaveLength(ontology.classes.length);
  });

  it('refuses to make the root a subclass of its deepest leaf', () => {
    const root = rootClasses(ontology)[0]!;
    const leaf = ontology.classes.find(
      (entity) => !ontology.classes.some((other) => other.superClassIds.includes(entity.id)),
    )!;
    expect(canSubclass(ontology, root.id, leaf.id)).toBe(false);
    expect(addSubClassOf(ontology, root.id, leaf.id)).toBe(ontology);
  });
});

describe('diamond inheritance', () => {
  const { ontology, ids } = buildDiamond();

  it('lists the shared descendant under both of its parents', () => {
    const forest = classForest(ontology);
    const vehicle = forest.find((node) => node.entity.localName === 'Vehicle')!;
    const under = (name: string) =>
      vehicle.children
        .find((child) => child.entity.localName === name)!
        .children.map((c) => c.entity.localName);

    expect(under('Car')).toContain('AmphibiousCar');
    expect(under('Boat')).toContain('AmphibiousCar');
  });

  it('counts the shared descendant once, despite two paths to it', () => {
    const members = classWithDescendants(ontology, ids.Vehicle!);
    expect(members.filter((c) => c.localName === 'AmphibiousCar')).toHaveLength(1);
    expect(new Set(members.map((c) => c.id)).size).toBe(members.length);
  });

  it('emits one subclass edge per declared parent', () => {
    const edges = subClassEdges(ontology).filter((edge) => edge.childId === ids.AmphibiousCar);
    expect(edges).toHaveLength(2);
  });

  it('keeps the other parent when one is deleted', () => {
    const after = deleteClass(ontology, ids.Car!);
    const amphibious = after.classes.find((c) => c.id === ids.AmphibiousCar);
    expect(amphibious?.superClassIds).toEqual([ids.Boat]);
  });
});

describe('one property with several ranges', () => {
  const { ontology, ids } = buildMultiTarget();

  it('records one usage per target rather than overwriting', () => {
    expect(usagesOfProperty(ontology, ids.hasPart!)).toHaveLength(4);
  });

  it('leaves the property without an RDFS domain, since it is used four times', () => {
    const triples = ontologyToTriples(ontology, { includeShapes: false });
    const domains = triples.filter(
      (t) => t.subject.endsWith('/hasPart') && t.predicate.endsWith('#domain'),
    );
    expect(domains).toHaveLength(0);
  });

  it('groups the three Car targets into one shape and leaves Bicycle with its own', () => {
    const triples = ontologyToTriples(ontology, { includeAxioms: false });
    const paths = triples.filter((t) => t.predicate.endsWith('#path'));
    expect(paths).toHaveLength(2);

    const or = triples.find(
      (t) => t.subject.endsWith('Car_hasPart') && t.predicate.endsWith('#or'),
    );
    expect(or).toBeDefined();
    // Bicycle has a single target, so it gets a plain sh:class and no disjunction.
    const bicycle = triples.find(
      (t) => t.subject.endsWith('Bicycle_hasPart') && t.predicate.endsWith('#class'),
    );
    expect(bicycle?.object.value).toContain('Wheel');
  });
});

describe('adversarial names', () => {
  const ontology = buildAdversarialNames();

  it('resolves every collision into a distinct local name', () => {
    const names = ontology.classes.map((entity) => entity.localName);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('UsedCar');
    expect(names.filter((name) => name.startsWith('UsedCar')).length).toBeGreaterThan(1);
  });

  it('never produces a name that starts with a digit', () => {
    for (const entity of ontology.classes) {
      expect(entity.localName).not.toMatch(/^\d/);
    }
  });

  it('keeps a class called CarShape distinct from the shape generated for Car', () => {
    const subjects = ontologyToTriples(ontology, { includeAxioms: false })
      .filter((t) => t.predicate.endsWith('#targetClass'))
      .map((t) => t.subject);
    expect(new Set(subjects).size).toBe(subjects.length);
    // The declared class owns the plain name; the generated shape steps aside.
    expect(subjects).not.toContain(entityIri(ontology.iri, 'CarShape'));
  });

  it('folds a case-only difference into the property naming convention, then deduplicates', () => {
    // Properties are lower-camel by convention, so `Label` and `label` are the same name.
    // Rather than silently overwriting, the second becomes a distinct `label2`.
    const names = ontology.datatypeProperties.map((entity) => entity.localName);
    expect(names).toEqual(['label', 'label2']);
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps a case-only difference between classes, which are upper-camel', () => {
    // `Car` and `CarShape` are both legitimate class names and must both survive.
    const names = ontology.classes.map((entity) => entity.localName);
    expect(names).toContain('Car');
    expect(names).toContain('CarShape');
  });
});

describe('property hierarchy', () => {
  const { ontology, ids } = buildPropertyHierarchy();

  it('writes a subPropertyOf for each child', () => {
    const triples = ontologyToTriples(ontology, { includeShapes: false });
    const subProperties = triples.filter((t) => t.predicate.endsWith('#subPropertyOf'));
    expect(subProperties).toHaveLength(2);
  });

  it('still gives each child its own domain and range, being used once each', () => {
    const triples = ontologyToTriples(ontology, { includeShapes: false });
    const domains = triples.filter(
      (t) => t.subject.endsWith('/knows') && t.predicate.endsWith('#domain'),
    );
    expect(domains).toHaveLength(1);
  });

  it('leaves the unused parent property with no domain at all', () => {
    expect(usagesOfProperty(ontology, ids.isRelatedTo!)).toHaveLength(0);
  });
});

describe('a degenerate document', () => {
  const { ontology, ids } = buildDegenerate();

  it('treats a class whose parent is gone as a root', () => {
    expect(rootClasses(ontology).map((c) => c.id)).toEqual([ids.car]);
  });

  it('drops the dangling subclass link rather than emitting it', () => {
    expect(subClassEdges(ontology)).toHaveLength(0);
    const triples = ontologyToTriples(ontology, { includeShapes: false });
    expect(triples.some((t) => t.predicate.endsWith('#subClassOf'))).toBe(false);
  });

  it('ignores usages whose property or class no longer exists', () => {
    // Four usages are stored; only the self-relation is intact.
    expect(ontology.usages).toHaveLength(4);
    expect(relationUsages(ontology)).toHaveLength(1);
    expect(attributeUsagesOfClass(ontology, ids.car!)).toHaveLength(0);
  });

  it('indexes only the usages it can resolve', () => {
    const index = indexOntology(ontology);
    expect(index.relationUsagesByClass.get('class_gone')).toBeUndefined();
  });

  it('serialises a self-relation without complaint', () => {
    const triples = ontologyToTriples(ontology, { includeShapes: false });
    const domain = triples.find((t) => t.predicate.endsWith('#domain'));
    const range = triples.find((t) => t.predicate.endsWith('#range'));
    expect(domain?.object.value).toBe(range?.object.value);
  });

  it('survives a rename and a delete', () => {
    expect(() => renameClass(ontology, ids.car!, 'Automobile')).not.toThrow();
    const emptied = deleteClass(ontology, ids.car!);
    expect(emptied.classes).toHaveLength(0);
    // Every usage touched the deleted class, directly or by dangling reference.
    expect(relationUsages(emptied)).toHaveLength(0);
  });
});

describe('at scale', () => {
  const ontology: Ontology = buildLarge(200);

  it('builds what was asked for', () => {
    expect(ontology.classes).toHaveLength(200);
    expect(ontology.datatypeProperties).toHaveLength(200);
    expect(ontology.usages).toHaveLength(399);
  });

  it('derives the graph in linear-ish time, not quadratic', () => {
    // Indexing 200 classes and 400 usages should be microseconds; a quadratic scan is not.
    const started = performance.now();
    for (let run = 0; run < 20; run += 1) indexOntology(ontology);
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it('projects to triples without blowing up', () => {
    const started = performance.now();
    const triples = ontologyToTriples(ontology);
    expect(triples.length).toBeGreaterThan(1_000);
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});
