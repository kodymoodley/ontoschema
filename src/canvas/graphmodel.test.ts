import { describe, expect, it } from 'vitest';
import {
  addAttributeToClass,
  addClass,
  addRelationBetween,
  addSubClassOf,
  createEmptyOntology,
  moveClass,
} from '../ontologymodel';
import type { Ontology } from '../ontologymodel';
import { EDGE_TYPE, NODE_TYPE, schemaEdges, schemaNodes } from './graphmodel';
import { CLASS_NODE_WIDTH } from './layout';

/**
 * The React Flow graph derived from an ontology. What matters here is the part React Flow
 * cannot work out for itself: how big a node is before it has been measured, and which of
 * its four sides each edge should use.
 */

function twoClasses(a: { x: number; y: number }, b: { x: number; y: number }) {
  const first = addClass(createEmptyOntology(), { position: a });
  const second = addClass(first.ontology, { position: b });
  return { ontology: second.ontology, source: first.id, target: second.id };
}

/** Attaches `count` fresh attributes to one class. */
function withAttributes(ontology: Ontology, classId: string, count: number): Ontology {
  let next = ontology;
  for (let index = 0; index < count; index += 1) {
    next = addAttributeToClass(next, { classId }).ontology;
  }
  return next;
}

describe('schemaNodes', () => {
  it('gives every class a size to be drawn at before it has been measured', () => {
    const { ontology } = addClass(createEmptyOntology(), { position: { x: 0, y: 0 } });
    const [node] = schemaNodes(ontology);

    // Without this React Flow paints the node hidden until its resize observer fires, so
    // every edit blanks the canvas for a frame.
    expect(node?.initialWidth).toBe(CLASS_NODE_WIDTH);
    expect(node?.initialHeight).toBeGreaterThan(0);
    expect(node?.type).toBe(NODE_TYPE.ontologyClass);
  });

  it('estimates a taller box for a class carrying more attributes', () => {
    const { ontology, id } = addClass(createEmptyOntology(), { position: { x: 0, y: 0 } });

    const heightOf = (model: Ontology) => schemaNodes(model)[0]?.initialHeight ?? 0;
    expect(heightOf(withAttributes(ontology, id, 3))).toBeGreaterThan(
      heightOf(withAttributes(ontology, id, 1)),
    );
    // An empty class is not the shortest: it shows a two-line "drop a property here" hint.
    expect(heightOf(ontology)).toBeGreaterThan(heightOf(withAttributes(ontology, id, 1)));
  });

  it('is derived from the ontology alone, so a click never rebuilds it', () => {
    const { ontology } = twoClasses({ x: 0, y: 0 }, { x: 400, y: 0 });
    expect(schemaNodes(ontology)).toEqual(schemaNodes(ontology));
  });
});

describe('schemaEdges', () => {
  it('routes a relation out of the side facing the target', () => {
    const { ontology, source, target } = twoClasses({ x: 0, y: 0 }, { x: 600, y: 0 });
    const { ontology: related } = addRelationBetween(ontology, {
      subjectClassId: source,
      objectClassId: target,
    });

    const [edge] = schemaEdges(related).filter((item) => item.type === EDGE_TYPE.relation);
    expect(edge?.sourceHandle).toBe('source-right');
    expect(edge?.targetHandle).toBe('target-left');
  });

  it('re-routes when the target is moved round to the other side', () => {
    const { ontology, source, target } = twoClasses({ x: 0, y: 0 }, { x: 600, y: 0 });
    const { ontology: related } = addRelationBetween(ontology, {
      subjectClassId: source,
      objectClassId: target,
    });
    const moved = moveClass(related, target, { x: 0, y: 600 });

    const [edge] = schemaEdges(moved).filter((item) => item.type === EDGE_TYPE.relation);
    expect(edge?.sourceHandle).toBe('source-bottom');
    expect(edge?.targetHandle).toBe('target-top');
  });

  it('keeps a subclass link vertical, flipping it when the child sits above the parent', () => {
    const {
      ontology,
      source: parent,
      target: child,
    } = twoClasses({ x: 0, y: 0 }, { x: 0, y: 600 });
    const linked = addSubClassOf(ontology, child, parent);

    const subclassEdge = (model: Ontology) =>
      schemaEdges(model).find((edge) => edge.type === EDGE_TYPE.subClassOf);

    expect(subclassEdge(linked)?.sourceHandle).toBe('source-top');
    expect(subclassEdge(linked)?.targetHandle).toBe('target-bottom');

    const flipped = moveClass(linked, child, { x: 0, y: -600 });
    expect(subclassEdge(flipped)?.sourceHandle).toBe('source-bottom');
    expect(subclassEdge(flipped)?.targetHandle).toBe('target-top');
  });

  it('accounts for the attributes a class carries when picking sides', () => {
    /*
     * The gap is judged against the boxes, not in raw pixels. These two sit 300 apart across
     * and 200 down: while both are short that is mostly a vertical gap, but once the subject
     * has grown a column of attributes the classes nearly touch top to bottom and the short
     * way between them is round the side.
     */
    const { ontology, source, target } = twoClasses({ x: 0, y: 0 }, { x: 300, y: 200 });
    const relate = (model: Ontology) =>
      addRelationBetween(model, { subjectClassId: source, objectClassId: target }).ontology;
    const sideTaken = (model: Ontology) =>
      schemaEdges(model).find((edge) => edge.type === EDGE_TYPE.relation)?.sourceHandle;

    expect(sideTaken(relate(ontology))).toBe('source-bottom');
    expect(sideTaken(relate(withAttributes(ontology, source, 8)))).toBe('source-right');
  });
});
