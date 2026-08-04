import { describe, expect, it } from 'vitest';
import {
  attributeUsagesOfClass,
  classForest,
  isOntologyEmpty,
  ontologyToTriples,
  relationUsages,
  rootClasses,
  usagesOfProperty,
  validateLocalName,
  validateNamespaceIri,
  validatePrefix,
} from '../ontologymodel';
import { serializeTurtle } from '../serialization';
import { EXAMPLES, exampleSize, findExample } from './index';

/**
 * The examples are the first thing most people will open, so a broken one is a bad first
 * impression that no amount of correct code elsewhere makes up for. These check every one
 * against the same bar.
 */

/** The caps the examples are written to, so they stay comprehensible. */
const MAX_CLASSES = 15;
const MAX_OBJECT_PROPERTIES = 15;

describe.each(EXAMPLES.map((example) => [example.title, example] as const))(
  '%s',
  (_title, example) => {
    const ontology = example.build();

    it('is a valid, non-empty ontology', () => {
      expect(isOntologyEmpty(ontology)).toBe(false);
      expect(validateNamespaceIri(ontology.iri).valid).toBe(true);
      expect(validatePrefix(ontology.prefix).valid).toBe(true);
    });

    it('stays within the size the examples are written to', () => {
      expect(ontology.classes.length).toBeLessThanOrEqual(MAX_CLASSES);
      expect(ontology.objectProperties.length).toBeLessThanOrEqual(MAX_OBJECT_PROPERTIES);
      // Big enough to be worth opening.
      expect(ontology.classes.length).toBeGreaterThanOrEqual(10);
    });

    it('gives every entity a legal, distinct name', () => {
      const names = [
        ...ontology.classes.map((e) => e.localName),
        ...ontology.objectProperties.map((e) => e.localName),
        ...ontology.datatypeProperties.map((e) => e.localName),
      ];
      for (const name of names) {
        expect(validateLocalName(name).valid, `"${name}"`).toBe(true);
      }
      expect(new Set(names).size).toBe(names.length);
    });

    it('names every class exactly as the spec asked, with nothing silently renamed', () => {
      // A collision would show up as `Car2`, which would be confusing in a teaching example.
      const built = ontology.classes.map((entity) => entity.localName).sort();
      expect(built).toEqual([...example.classes.map((entry) => entry.name)].sort());
    });

    it('draws every relation the spec asked for', () => {
      const drawn = relationUsages(ontology).length;
      expect(drawn).toBe(example.relations.length);
    });

    it('gives every class at least one attribute, so no box is empty on the canvas', () => {
      for (const entity of ontology.classes) {
        expect(
          attributeUsagesOfClass(ontology, entity.id).length,
          `${entity.localName} carries nothing`,
        ).toBeGreaterThan(0);
      }
    });

    it('lays every class out somewhere distinct', () => {
      const positions = ontology.classes.map(
        (entity) => `${entity.position.x},${entity.position.y}`,
      );
      expect(new Set(positions).size).toBe(positions.length);
      for (const entity of ontology.classes) {
        expect(entity.position.x).toBeGreaterThanOrEqual(0);
        expect(entity.position.y).toBeGreaterThanOrEqual(0);
      }
    });

    it('carries ontology metadata, so the Ontology tab is not blank', () => {
      expect(ontology.annotations.length).toBeGreaterThan(0);
      expect(ontology.annotations.some((a) => a.term === 'dcterms:title')).toBe(true);
    });

    it('defines what its classes mean', () => {
      const defined = ontology.classes.filter((entity) =>
        entity.annotations.some((a) => a.term === 'skos:definition'),
      );
      expect(defined.length).toBe(ontology.classes.length);
    });

    it('builds a taxonomy that is neither flat nor a single chain', () => {
      const forest = classForest(ontology);
      expect(forest.length).toBe(rootClasses(ontology).length);
      // At least one class sits under another, or the Taxonomy tab has nothing to show.
      expect(ontology.classes.some((entity) => entity.superClassIds.length > 0)).toBe(true);
    });

    it('exports as readable Turtle carrying both layers', () => {
      const turtle = serializeTurtle(ontology);
      expect(turtle).toContain(`@prefix ${ontology.prefix}:`);
      expect(turtle).toContain('a owl:Class');
      expect(turtle).toContain('sh:NodeShape');
      expect(ontologyToTriples(ontology).length).toBeGreaterThan(50);
    });

    it('reports a size matching what it actually builds', () => {
      const size = exampleSize(example);
      expect(size.classes).toBe(ontology.classes.length);
      expect(size.objectProperties).toBe(ontology.objectProperties.length);
      expect(size.datatypeProperties).toBe(ontology.datatypeProperties.length);
    });

    it('builds the same thing every time', () => {
      expect(serializeTurtle(example.build())).toBe(serializeTurtle(example.build()));
    });
  },
);

describe('the library as a whole', () => {
  it('has a unique key and title for each example', () => {
    const keys = EXAMPLES.map((example) => example.key);
    const titles = EXAMPLES.map((example) => example.title);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('gives each example its own namespace, so two can be open at once', () => {
    const namespaces = EXAMPLES.map((example) => example.iri);
    const prefixes = EXAMPLES.map((example) => example.prefix);
    expect(new Set(namespaces).size).toBe(namespaces.length);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it('finds an example by key, and nothing by a key it does not have', () => {
    expect(findExample('music')?.title).toBe('Music library');
    expect(findExample('nope')).toBeUndefined();
  });

  it('leads with the gentlest example', () => {
    expect(EXAMPLES[0]?.key).toBe('music');
  });

  it('shows off property reuse somewhere, since that is the least obvious idea', () => {
    const reusing = EXAMPLES.filter((example) => {
      const ontology = example.build();
      return ontology.objectProperties.some(
        (property) => usagesOfProperty(ontology, property.id).length > 1,
      );
    });
    expect(reusing.length).toBeGreaterThanOrEqual(3);
  });

  it('includes a self-referencing relation somewhere, since it surprises people', () => {
    const selfReferencing = EXAMPLES.some((example) =>
      example.relations.some((relation) => relation.from === relation.to),
    );
    expect(selfReferencing).toBe(true);
  });

  it('shows language tags somewhere', () => {
    const localised = EXAMPLES.some((example) =>
      example.classes.some((entry) => (entry.labels?.length ?? 0) > 1),
    );
    expect(localised).toBe(true);
  });
});
