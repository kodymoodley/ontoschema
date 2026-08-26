import { describe, expect, it } from 'vitest';
import {
  addAttributeToClass,
  addClass,
  addRelationBetween,
  addSubClassOf,
  attachProperty,
  createEmptyOntology,
  detachUsage,
  moveClass,
  renameClass,
} from '../ontologymodel';
import type { Ontology } from '../ontologymodel';
import {
  EDGE_TYPE,
  NODE_TYPE,
  sameClassNode,
  sameRelationEdge,
  schemaEdges,
  schemaNodes,
  taxonomyGraph,
} from './graphmodel';
import { CLASS_NODE_WIDTH } from './layout';

/** The classes whose relations the taxonomy view is showing. */
const showing = (...ids: string[]) => new Set(ids);

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

  /*
   * A relation from a class to itself -- `hasSubCategory` on Category, which published
   * ontologies are full of. `chooseSides` cannot answer this one: both centres are the same
   * point, so every comparison ties and it returns right-to-left, which is a line from the box's
   * right edge back to its own left edge. Drawn, that runs straight through the box and hides
   * behind it, and all that showed on the canvas was an arrowhead arriving at the left side from
   * nothing at all.
   *
   * The two ends must be on *different* sides, so a right-angled step between them has to go
   * around the outside.
   */
  it('sends a relation from a class to itself out one side and into another', () => {
    const first = addClass(createEmptyOntology(), { position: { x: 100, y: 100 } });
    const { ontology } = addRelationBetween(first.ontology, {
      localName: 'hasSubCategory',
      subjectClassId: first.id,
      objectClassId: first.id,
    });

    const [edge] = schemaEdges(ontology).filter((item) => item.type === EDGE_TYPE.relation);
    expect(edge?.source).toBe(first.id);
    expect(edge?.target).toBe(first.id);
    expect(edge?.sourceHandle).not.toBe(edge?.targetHandle?.replace('target', 'source'));
    expect(edge?.sourceHandle).toBe('source-right');
    expect(edge?.targetHandle).toBe('target-top');
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

  /*
   * The hierarchy belongs to the taxonomy view, which lays it out rather than drawing it over
   * wherever the classes have been dragged. Here it was a second set of lines through the same
   * crowded middle, saying what every class box already says in its own header.
   */
  it('draws no subclass links at all', () => {
    const {
      ontology,
      source: parent,
      target: child,
    } = twoClasses({ x: 0, y: 0 }, { x: 0, y: 600 });
    const linked = addSubClassOf(ontology, child, parent);

    expect(schemaEdges(linked).some((edge) => edge.type === EDGE_TYPE.subClassOf)).toBe(false);
    // And the model still holds it: this is about what is drawn, not about what exists.
    expect(
      taxonomyGraph(linked, showing(), 'off').edges.some(
        (edge) => edge.type === EDGE_TYPE.subClassOf,
      ),
    ).toBe(true);
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

/**
 * Which derived objects may be kept between renders. React Flow re-renders anything whose
 * object changed, so a rename that produced 200 fresh nodes and 199 fresh edges repainted the
 * whole canvas. What matters here is the negative case: everything the edit did not touch has
 * to compare equal, or nothing is saved.
 */
describe('what survives a re-derive', () => {
  /** A small schema with a hierarchy, attributes and relations — one of each thing that varies. */
  function schema() {
    const { ontology, source, target } = twoClasses({ x: 0, y: 0 }, { x: 600, y: 0 });
    const third = addClass(ontology, { position: { x: 0, y: 600 } });
    const withChild = addSubClassOf(third.ontology, third.id, source);
    const withAttribute = withAttributes(withChild, source, 2);
    const { ontology: related } = addRelationBetween(withAttribute, {
      subjectClassId: source,
      objectClassId: target,
    });
    return { ontology: related, source, target, child: third.id };
  }

  const nodeFor = (nodes: ReturnType<typeof schemaNodes>, id: string) =>
    nodes.find((node) => node.id === id);

  it('keeps every node and edge when nothing changed', () => {
    const { ontology } = schema();
    const before = schemaNodes(ontology);
    const after = schemaNodes(ontology);

    expect(before.every((node, index) => sameClassNode(node, after[index]!))).toBe(true);

    const edgesBefore = schemaEdges(ontology);
    const edgesAfter = schemaEdges(ontology);
    expect(edgesBefore.every((edge, index) => sameRelationEdge(edge, edgesAfter[index]!))).toBe(
      true,
    );
  });

  it('changes only the renamed class', () => {
    const { ontology, source, target } = schema();
    const before = schemaNodes(ontology);
    const after = schemaNodes(renameClass(ontology, source, 'Renamed'));

    expect(sameClassNode(nodeFor(before, source)!, nodeFor(after, source)!)).toBe(false);
    expect(sameClassNode(nodeFor(before, target)!, nodeFor(after, target)!)).toBe(true);
  });

  it('changes a child when its parent is renamed, because the child shows the name', () => {
    const { ontology, source, child, target } = schema();
    const before = schemaNodes(ontology);
    const after = schemaNodes(renameClass(ontology, source, 'Renamed'));

    expect(sameClassNode(nodeFor(before, child)!, nodeFor(after, child)!)).toBe(false);
    expect(sameClassNode(nodeFor(before, target)!, nodeFor(after, target)!)).toBe(true);
  });

  it('changes only the class that gained an attribute', () => {
    const { ontology, source, target } = schema();
    const before = schemaNodes(ontology);
    const after = schemaNodes(withAttributes(ontology, target, 1));

    expect(sameClassNode(nodeFor(before, target)!, nodeFor(after, target)!)).toBe(false);
    expect(sameClassNode(nodeFor(before, source)!, nodeFor(after, source)!)).toBe(true);
  });

  it('changes a moved class, since where it sits is part of what is drawn', () => {
    const { ontology, target } = schema();
    const before = schemaNodes(ontology);
    const after = schemaNodes(moveClass(ontology, target, { x: 40, y: 40 }));

    expect(sameClassNode(nodeFor(before, target)!, nodeFor(after, target)!)).toBe(false);
  });

  it('changes an edge whose class moved round to another side', () => {
    const { ontology, target } = schema();
    const [before] = schemaEdges(ontology).filter((edge) => edge.type === EDGE_TYPE.relation);
    const [after] = schemaEdges(moveClass(ontology, target, { x: 0, y: 900 })).filter(
      (edge) => edge.type === EDGE_TYPE.relation,
    );

    expect(sameRelationEdge(before!, after!)).toBe(false);
  });

  /*
   * The lanes decide where a line is drawn, exactly as the handles do, so an edge whose lane
   * changed is not the same edge.
   *
   * Leaving them out of the comparison was a real bug and a quiet one. An edge's lane depends on
   * how many others meet the same side of the same box, so a class arriving on that side moves
   * every line already there -- without its handles changing. The canvas kept the old objects
   * with the old lanes, two edges ended up sharing one, and the arrowheads went back to landing
   * on top of each other in exactly the arrangement this was built to fix.
   */
  it('changes an edge whose lane moved even though its handles did not', () => {
    const first = addClass(createEmptyOntology(), { localName: 'A', position: { x: 0, y: 0 } });
    const second = addClass(first.ontology, { localName: 'B', position: { x: 600, y: 0 } });
    const alone = addRelationBetween(second.ontology, {
      localName: 'points',
      subjectClassId: first.id,
      objectClassId: second.id,
    });

    // A second relation between the same two classes: same sides, but now two lanes to share.
    const crowded = addRelationBetween(alone.ontology, {
      localName: 'back',
      subjectClassId: second.id,
      objectClassId: first.id,
    });

    const edgeFor = (model: typeof alone.ontology, usageId: string) =>
      schemaEdges(model).find((edge) => edge.id === usageId);
    const before = edgeFor(alone.ontology, alone.usageId);
    const after = edgeFor(crowded.ontology, alone.usageId);
    expect(before).toBeDefined();
    expect(after).toBeDefined();
    if (!before || !after) return;

    expect(after.sourceHandle, 'the handles are meant to be unchanged here').toBe(
      before.sourceHandle,
    );
    expect(sameRelationEdge(before, after)).toBe(false);
  });

  it('refuses to compare anything without derived data', () => {
    const [node] = schemaNodes(schema().ontology);
    expect(sameClassNode(node!, { ...node!, data: undefined as never })).toBe(false);
    expect(
      sameRelationEdge(
        { id: 'a', source: 'x', target: 'y' },
        { id: 'a', source: 'x', target: 'y' },
      ),
    ).toBe(false);
  });
});

/**
 * How far a rename reaches. A attribute lives in a pool and can sit on many classes at
 * once, so renaming it from inside one class renames it on all of them. Each row therefore
 * carries the number of *other* classes holding the same property, and the node uses it to say
 * so before the rename happens.
 */
describe('how widely an attribute is used', () => {
  /** Puts one attribute on `count` classes and returns the rows of the first. */
  function rowsAfterSharingAcross(count: number) {
    let ontology = createEmptyOntology();
    const ids: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const added = addClass(ontology, { position: { x: index * 300, y: 0 } });
      ontology = added.ontology;
      ids.push(added.id);
    }

    const created = addAttributeToClass(ontology, { classId: ids[0]!, localName: 'name' });
    ontology = created.ontology;
    for (const classId of ids.slice(1)) {
      ontology = attachProperty(ontology, {
        propertyId: created.propertyId,
        subjectClassId: classId,
      }).ontology;
    }

    return { ontology, ids };
  }

  const rowsOf = (ontology: Ontology, classId: string) => {
    const node = schemaNodes(ontology).find((entry) => entry.id === classId);
    return (node?.data as { attributes: { usedOnOtherClasses: number }[] }).attributes;
  };

  it('counts nothing else when a property sits on one class alone', () => {
    const { ontology, ids } = rowsAfterSharingAcross(1);
    expect(rowsOf(ontology, ids[0]!)[0]?.usedOnOtherClasses).toBe(0);
  });

  it('counts the other classes, not itself', () => {
    const { ontology, ids } = rowsAfterSharingAcross(3);
    for (const classId of ids) {
      expect(rowsOf(ontology, classId)[0]?.usedOnOtherClasses).toBe(2);
    }
  });

  it('drops back when the property is detached from one of them', () => {
    const { ontology, ids } = rowsAfterSharingAcross(3);
    const usage = ontology.usages.find((one) => one.subjectClassId === ids[2]);
    const detached = detachUsage(ontology, usage?.id ?? '');

    expect(rowsOf(detached, ids[0]!)[0]?.usedOnOtherClasses).toBe(1);
  });

  it('counts a class once even if it holds the property twice', () => {
    const { ontology, ids } = rowsAfterSharingAcross(2);
    const property = ontology.attributes[0]!;
    const twice = attachProperty(ontology, {
      propertyId: property.id,
      subjectClassId: ids[0]!,
    }).ontology;

    // The second class is still one other class, however many rows the first one shows.
    expect(rowsOf(twice, ids[0]!)[0]?.usedOnOtherClasses).toBe(1);
  });
});

/**
 * The relation layer in the taxonomy view.
 *
 * The view reads cleanly because it draws one kind of edge, so what is worth testing is that
 * the other kind stays out of the way until it is asked for, and that asking for part of it
 * gives a part rather than everything.
 */
describe('relations in the taxonomy view', () => {
  /** Two roots, a child under each, and one relation between the two children. */
  function twoModules() {
    let ontology = createEmptyOntology();
    const vehicle = addClass(ontology, { localName: 'Vehicle' });
    ontology = vehicle.ontology;
    const car = addClass(ontology, { localName: 'Car' });
    ontology = addSubClassOf(car.ontology, car.id, vehicle.id);

    const org = addClass(ontology, { localName: 'Organisation' });
    ontology = org.ontology;
    const dealer = addClass(ontology, { localName: 'Dealership' });
    ontology = addSubClassOf(dealer.ontology, dealer.id, org.id);

    const related = addRelationBetween(ontology, {
      subjectClassId: car.id,
      objectClassId: dealer.id,
      localName: 'offeredBy',
    });
    return { ontology: related.ontology, car: car.id, dealer: dealer.id, vehicle: vehicle.id };
  }

  const relationEdgesOf = (edges: { type?: string }[]) =>
    edges.filter((edge) => edge.type === EDGE_TYPE.relation);

  it('draws none by default, which is why the view reads cleanly', () => {
    const { ontology } = twoModules();
    const { edges } = taxonomyGraph(ontology, showing());

    expect(relationEdgesOf(edges)).toHaveLength(0);
    // The subclass links are still there: this hides one layer, not the view.
    expect(edges.filter((edge) => edge.type === EDGE_TYPE.subClassOf).length).toBeGreaterThan(0);
  });

  it("draws only the selected class's relations in between", () => {
    const { ontology, car, vehicle } = twoModules();

    expect(relationEdgesOf(taxonomyGraph(ontology, showing(car), 'selected').edges)).toHaveLength(
      1,
    );
    // Vehicle is in the same module as Car and takes part in nothing.
    expect(
      relationEdgesOf(taxonomyGraph(ontology, showing(vehicle), 'selected').edges),
    ).toHaveLength(0);
    // Nothing selected, so there is nothing to draw the relations of.
    expect(relationEdgesOf(taxonomyGraph(ontology, showing(), 'selected').edges)).toHaveLength(0);
  });

  it('counts the far end too, not only the class the relation starts at', () => {
    const { ontology, dealer } = twoModules();
    expect(
      relationEdgesOf(taxonomyGraph(ontology, showing(dealer), 'selected').edges),
    ).toHaveLength(1);
  });

  it('joins nodes that exist, so React Flow has both ends of every edge', () => {
    const { ontology, dealer } = twoModules();
    const { nodes, edges } = taxonomyGraph(ontology, showing(dealer), 'selected');
    const ids = new Set(nodes.map((node) => node.id));

    for (const edge of relationEdgesOf(edges) as { source: string; target: string }[]) {
      expect(ids.has(edge.source)).toBe(true);
      expect(ids.has(edge.target)).toBe(true);
    }
  });

  /*
   * A class reachable from two roots is drawn inside both modules, so one relation has two
   * pairs of endpoints. Both are drawn: showing it attached to one copy and not the other
   * would be a picture of something that is not the case.
   */
  it('draws a relation once per pair of endpoints on screen', () => {
    const { ontology, car, dealer, vehicle } = twoModules();
    // Dealership now hangs under Vehicle as well, so it appears in two modules.
    const shared = addSubClassOf(ontology, dealer, vehicle);
    const { edges } = taxonomyGraph(shared, showing(car), 'selected');

    expect(relationEdgesOf(edges)).toHaveLength(2);
    expect(new Set(relationEdgesOf(edges).map((edge) => (edge as { id: string }).id)).size).toBe(2);
    expect(car).toBeTruthy();
  });
});
