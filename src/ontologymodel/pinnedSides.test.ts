import { describe, expect, it } from 'vitest';
import { ONTOSCHEMA_FROM_SIDE, ONTOSCHEMA_TO_SIDE } from '../annotationvocabulary';
import { ontologyFromTriples } from './fromTriples';
import { addClass, addRelationBetween, attachProperty, pinUsageEnd } from './mutations';
import { createEmptyOntology } from './ontology';
import { ontologyToTriples } from './triples';
import type { Ontology } from './types';

/**
 * The sides a relation's line was pinned to by hand.
 *
 * Layout, like a class's position: it belongs to the schema, travels in its file, and changes one
 * line of that file when it changes.
 */

const FLEET = 'https://example.org/fleet/';

/** Car, Wheel and Door, with `Car hasPart Wheel` drawn. */
function fleet() {
  let ontology = createEmptyOntology(FLEET, 'fleet');
  const car = addClass(ontology, { localName: 'Car' });
  const wheel = addClass(car.ontology, { localName: 'Wheel' });
  const door = addClass(wheel.ontology, { localName: 'Door' });
  const hasPart = addRelationBetween(door.ontology, {
    localName: 'hasPart',
    subjectClassId: car.id,
    objectClassId: wheel.id,
  });
  ontology = hasPart.ontology;
  return {
    ontology,
    ids: { car: car.id, wheel: wheel.id, door: door.id, hasPart: hasPart.propertyId },
    usage: hasPart.usageId,
  };
}

const pinsOf = (ontology: Ontology) => ontology.usages.map((usage) => usage.pinned);
const reopened = (ontology: Ontology) =>
  ontologyFromTriples(ontologyToTriples(ontology), { fleet: FLEET }).ontology;

describe('pinning one end of a line', () => {
  it('pins the end it is asked to, and leaves the other alone', () => {
    const { ontology, usage } = fleet();

    const pinned = pinUsageEnd(ontology, usage, 'target', 'top');

    expect(pinsOf(pinned)).toEqual([{ target: 'top' }]);
    expect(pinsOf(pinUsageEnd(pinned, usage, 'source', 'right'))).toEqual([
      { target: 'top', source: 'right' },
    ]);
  });

  it('lets an end follow the canvas again, and leaves nothing behind once both do', () => {
    const { ontology, usage } = fleet();
    const both = pinUsageEnd(
      pinUsageEnd(ontology, usage, 'target', 'top'),
      usage,
      'source',
      'left',
    );

    const one = pinUsageEnd(both, usage, 'target', null);
    expect(pinsOf(one)).toEqual([{ source: 'left' }]);
    const none = pinUsageEnd(one, usage, 'source', null);
    expect(none.usages[0]).not.toHaveProperty('pinned');
  });
});

describe('a pinned line in the file', () => {
  it('is saved on the relation’s shape and comes back pinned', () => {
    const { ontology, usage } = fleet();
    const pinned = pinUsageEnd(
      pinUsageEnd(ontology, usage, 'target', 'top'),
      usage,
      'source',
      'bottom',
    );

    const triples = ontologyToTriples(pinned);
    expect(triples).toContainEqual({
      subject: `${FLEET}Car_hasPart`,
      predicate: ONTOSCHEMA_TO_SIDE,
      object: { type: 'literal', value: 'top' },
    });
    expect(pinsOf(reopened(pinned))).toEqual([{ source: 'bottom', target: 'top' }]);
  });

  /* Two lines on one path share a shape; each alternative of its `sh:or` is one of them. */
  it('is saved on its own alternative when the relation points at several classes', () => {
    const { ontology, ids } = fleet();
    const both = attachProperty(ontology, {
      propertyId: ids.hasPart,
      subjectClassId: ids.car,
      objectClassId: ids.door,
    });
    const pinned = pinUsageEnd(both.ontology, both.id, 'target', 'left');

    const back = reopened(pinned);
    const pinFor = (model: Ontology, objectClassName: string) => {
      const object = model.classes.find((entity) => entity.localName === objectClassName);
      return model.usages.find((one) => one.objectClassId === object?.id)?.pinned;
    };
    expect(pinFor(back, 'Door')).toEqual({ target: 'left' });
    expect(pinFor(back, 'Wheel')).toBeUndefined();
    expect(back.unmodelled).toEqual([]);
  });

  it('declares its terms only when something is pinned', () => {
    const { ontology, usage } = fleet();
    const declared = (model: Ontology) =>
      ontologyToTriples(model)
        .filter(
          (triple) =>
            triple.subject === ONTOSCHEMA_FROM_SIDE || triple.subject === ONTOSCHEMA_TO_SIDE,
        )
        .map((triple) => triple.subject);

    expect(declared(ontology)).toEqual([]);
    expect(declared(pinUsageEnd(ontology, usage, 'target', 'top'))).toEqual([ONTOSCHEMA_TO_SIDE]);
  });

  it('is left out of a file written without its layout', () => {
    const { ontology, usage } = fleet();
    const pinned = pinUsageEnd(ontology, usage, 'target', 'top');

    const written = ontologyToTriples(pinned, { includeLayout: false });
    expect(written.some((triple) => triple.predicate === ONTOSCHEMA_TO_SIDE)).toBe(false);
  });

  it('ignores a side that is not one, rather than inventing a pin', () => {
    const { ontology, usage } = fleet();
    const triples = ontologyToTriples(pinUsageEnd(ontology, usage, 'target', 'top')).map(
      (triple) =>
        triple.predicate === ONTOSCHEMA_TO_SIDE
          ? { ...triple, object: { type: 'literal' as const, value: 'sideways' } }
          : triple,
    );

    const back = ontologyFromTriples(triples, { fleet: FLEET }).ontology;
    expect(pinsOf(back)).toEqual([undefined]);
  });
});
