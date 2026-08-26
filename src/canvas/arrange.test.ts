import { describe, expect, it } from 'vitest';
import {
  addAttributeToClass,
  addClass,
  addRelationBetween,
  addSubClassOf,
  createEmptyOntology,
  placeClasses,
} from '../ontologymodel';
import type { Ontology } from '../ontologymodel';
import { arrangeSchema, unplaced } from './arrange';
import { CLASS_NODE_WIDTH, estimateClassHeight } from './layout';

/**
 * The computed arrangement of the schema canvas.
 *
 * Two properties matter more than any particular set of coordinates, because the whole feature
 * rests on them: no two classes may land on the same spot (the app decides a document needs
 * arranging by looking for exactly that, so a layout that produced one would arrange forever),
 * and no two boxes may overlap (an arrangement you have to untangle is not one).
 */

/** Everything the canvas needs to know about where a class ends up. */
function boxes(ontology: Ontology) {
  const arrangement = arrangeSchema(ontology);
  return ontology.classes.map((entity) => {
    const at = arrangement.get(entity.id);
    if (!at) throw new Error(`${entity.localName} was left out of the arrangement`);
    const attributes = ontology.usages.filter(
      (usage) => usage.subjectClassId === entity.id && usage.objectClassId === null,
    ).length;
    return {
      id: entity.id,
      name: entity.localName,
      x: at.x,
      y: at.y,
      width: CLASS_NODE_WIDTH,
      height: estimateClassHeight(attributes, entity.superClassIds.length > 0),
    };
  });
}

const overlaps = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** A chain of `count` classes, each pointing at the next. */
function chain(count: number): Ontology {
  let ontology = createEmptyOntology();
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const added = addClass(ontology, { localName: `Class${index}` });
    ontology = added.ontology;
    ids.push(added.id);
  }
  for (let index = 0; index + 1 < ids.length; index += 1) {
    const from = ids[index];
    const to = ids[index + 1];
    if (from === undefined || to === undefined) continue;
    ontology = addRelationBetween(ontology, {
      localName: `points${index}`,
      subjectClassId: from,
      objectClassId: to,
    }).ontology;
  }
  return ontology;
}

/** Classes with nothing joining them, all dumped on the same coordinate. */
function piled(count: number): Ontology {
  let ontology = createEmptyOntology();
  for (let index = 0; index < count; index += 1) {
    ontology = addClass(ontology, {
      localName: `Loose${index}`,
      position: { x: 0, y: 0 },
    }).ontology;
  }
  return ontology;
}

describe('recognising a document that was never laid out', () => {
  it('sees a pile', () => {
    expect(unplaced(piled(6))).toBe(true);
  });

  it('is satisfied once it has been arranged', () => {
    const pile = piled(6);
    expect(unplaced(placeClasses(pile, arrangeSchema(pile)))).toBe(false);
  });

  /*
   * The guard that keeps this from firing on ordinary work. Dragging moves one class to
   * wherever the pointer was, so two classes agreeing to the pixel is not something a person
   * can do by hand.
   */
  it('leaves a schema that was positioned alone', () => {
    let ontology = createEmptyOntology();
    ontology = addClass(ontology, { position: { x: 40, y: 40 } }).ontology;
    ontology = addClass(ontology, { position: { x: 41, y: 40 } }).ontology;
    expect(unplaced(ontology)).toBe(false);
  });

  it('has nothing to say about one class, or none', () => {
    expect(unplaced(addClass(createEmptyOntology(), {}).ontology)).toBe(false);
    expect(unplaced(createEmptyOntology())).toBe(false);
  });
});

describe('arranging the schema', () => {
  it('places every class', () => {
    const ontology = chain(5);
    expect(arrangeSchema(ontology).size).toBe(ontology.classes.length);
  });

  /*
   * The property the auto-arrange depends on. `unplaced` is how the app decides a document
   * needs arranging; if an arrangement could produce two classes at one coordinate, arranging
   * would leave the document still asking to be arranged.
   */
  it('never puts two classes in the same place', () => {
    for (const ontology of [chain(12), piled(20), createEmptyOntology()]) {
      const placed = [...arrangeSchema(ontology).values()].map(({ x, y }) => `${x},${y}`);
      expect(new Set(placed).size).toBe(placed.length);
    }
  });

  it('leaves no two boxes overlapping', () => {
    const laid = boxes(chain(9));
    for (const [index, box] of laid.entries()) {
      for (const other of laid.slice(index + 1)) {
        expect(overlaps(box, other), `${box.name} overlaps ${other.name}`).toBe(false);
      }
    }
  });

  it('leaves loose classes clear of each other too', () => {
    const laid = boxes(piled(15));
    for (const [index, box] of laid.entries()) {
      for (const other of laid.slice(index + 1)) {
        expect(overlaps(box, other), `${box.name} overlaps ${other.name}`).toBe(false);
      }
    }
  });

  /*
   * Left to right along the relations, which is the whole reason for ranking by them rather
   * than by the hierarchy: the arrangement should read the way the sentence does.
   */
  it('puts the subject of a relation to the left of its object', () => {
    const laid = boxes(chain(4));
    const xs = laid.map((box) => box.x);
    for (let index = 0; index + 1 < xs.length; index += 1) {
      const left = xs[index];
      const right = xs[index + 1];
      expect(left).toBeDefined();
      expect(right).toBeDefined();
      if (left === undefined || right === undefined) continue;
      expect(right).toBeGreaterThan(left);
    }
  });

  /*
   * The hierarchy is a hint, not a rank. A subclass with no relations of its own should still
   * be put somewhere sensible rather than left in the far corner with the unconnected classes.
   */
  it('keeps a subclass in the same group as its parent', () => {
    let ontology = createEmptyOntology();
    const parent = addClass(ontology, { localName: 'Vehicle' });
    ontology = parent.ontology;
    const child = addClass(ontology, { localName: 'Car' });
    ontology = addSubClassOf(child.ontology, child.id, parent.id);
    const stranger = addClass(ontology, { localName: 'Unrelated' });
    ontology = stranger.ontology;

    const arrangement = arrangeSchema(ontology);
    const at = (id: string) => arrangement.get(id) ?? { x: NaN, y: NaN };
    const near = Math.abs(at(child.id).x - at(parent.id).x);
    const far = Math.abs(at(stranger.id).x - at(parent.id).x);
    expect(near).toBeLessThan(far);
  });

  /*
   * What makes this usable as a button rather than a dice roll. Press it twice and land in the
   * same place; press it after trying something else and get the arrangement back.
   */
  it('gives the same answer every time', () => {
    const ontology = chain(8);
    const once = [...arrangeSchema(ontology)];
    const twice = [...arrangeSchema(ontology)];
    expect(twice).toEqual(once);
  });

  it('is unmoved by how big the boxes are', () => {
    let ontology = chain(3);
    const first = ontology.classes[0];
    if (first) {
      for (let index = 0; index < 6; index += 1) {
        ontology = addAttributeToClass(ontology, {
          classId: first.id,
          localName: `field${index}`,
        }).ontology;
      }
    }
    const laid = boxes(ontology);
    for (const [index, box] of laid.entries()) {
      for (const other of laid.slice(index + 1)) {
        expect(overlaps(box, other), `${box.name} overlaps ${other.name}`).toBe(false);
      }
    }
  });

  it('has nothing to arrange in an empty ontology', () => {
    expect(arrangeSchema(createEmptyOntology()).size).toBe(0);
  });
});
