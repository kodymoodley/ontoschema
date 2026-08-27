import dagre from '@dagrejs/dagre';
import { indexOntology, subClassEdges } from '../ontologymodel';
import type { Ontology, Position } from '../ontologymodel';
import { CLASS_NODE_WIDTH, estimateClassHeight } from './layout';

/**
 * A tidy arrangement of the schema canvas, computed from the graph rather than from where
 * things happen to have been dropped.
 *
 * Two situations need it. A `.ttl` written anywhere but here carries no `ontoschema:layout`
 * annotation, so every class arrives at the same coordinate and the canvas opens as one
 * illegible pile — see `unplaced` below. And an arrangement that has been dragged into a mess
 * needs a way back.
 *
 * Ranks follow the **relations**, because those are the edges the schema view actually draws.
 * Ranking by the class hierarchy would produce something just as neat with no visible reason
 * for it: subclass links are deliberately not drawn here (see `schemaEdges`), so the reader
 * would see rows without being told what the rows mean. They still go into the graph as
 * lower-weight edges, which keeps a child near its parent without letting the hierarchy
 * overrule the relations when the two disagree.
 *
 * Left to right, not top down. A relation reads as a sentence — a Client *holds* a Policy —
 * and a sentence runs across the page. It also suits the boxes, which are fixed-width and
 * grow downwards as attributes are added, so ranking vertically would space them by their
 * most variable dimension.
 */

/** Between ranks: wide enough for a relation's name to sit on the line without touching either box. */
const RANK_GAP = 140;

/** Between boxes within a rank. */
const NODE_GAP = 44;

/** Between disconnected groups, and where a row of them wraps. */
const GROUP_GAP = 90;
const MAX_ROW_WIDTH = 2400;

/** The canvas margin, so the arrangement does not start hard against the origin. */
const ORIGIN = { x: 60, y: 60 };

/**
 * Relations carry the layout; the hierarchy only nudges it.
 *
 * Dagre reads `weight` as how much it wants an edge short and straight. Leaving both at 1 let
 * a deep hierarchy pull classes into ranks that the drawn relations then had to cross.
 */
const RELATION_WEIGHT = 4;
const SUBCLASS_WEIGHT = 1;

interface Link {
  from: string;
  to: string;
  weight: number;
}

/**
 * True when the classes cannot have been positioned by anyone.
 *
 * Two classes sharing an exact coordinate is not something dragging can produce — nodes are
 * moved one at a time, to wherever the pointer was — and `nextFreePosition` keeps new classes
 * off each other. So an exact collision means the positions were never real, which is what an
 * import without a layout annotation leaves behind.
 *
 * Deliberately not "are they all at the origin": the same pile happens wherever the fallback
 * coordinate is, and a future change to that fallback should not quietly turn this off.
 */
export function unplaced(ontology: Ontology): boolean {
  if (ontology.classes.length < 2) return false;
  const seen = new Set<string>();
  for (const entity of ontology.classes) {
    const key = `${entity.position.x},${entity.position.y}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/** Every class, with the size the canvas will render it at. */
function sizes(ontology: Ontology): Map<string, { width: number; height: number }> {
  const index = indexOntology(ontology);
  return new Map(
    ontology.classes.map((entity) => [
      entity.id,
      {
        width: CLASS_NODE_WIDTH,
        height: estimateClassHeight(
          (index.attributeUsagesByClass.get(entity.id) ?? []).length,
          entity.superClassIds.length > 0,
        ),
      },
    ]),
  );
}

/** The edges the layout is built from: drawn relations first, hierarchy as a hint. */
function links(ontology: Ontology): Link[] {
  const index = indexOntology(ontology);
  const found: Link[] = [];
  const seen = new Set<string>();

  const add = (from: string, to: string, weight: number) => {
    // A self-relation says nothing about where the class goes, and dagre treats a self-edge
    // as a rank constraint on a single node, which distorts the rank it sits in.
    if (from === to) return;
    if (!index.classById.has(from) || !index.classById.has(to)) return;
    // One line per pair per kind. Three relations between the same two classes should not
    // pull them three times harder together than a single one does.
    const key = `${from}->${to}:${weight}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ from, to, weight });
  };

  for (const usage of ontology.usages) {
    if (usage.objectClassId === null) continue;
    if (!index.relationById.has(usage.propertyId)) continue;
    add(usage.subjectClassId, usage.objectClassId, RELATION_WEIGHT);
  }
  for (const { childId, parentId } of subClassEdges(ontology)) {
    add(parentId, childId, SUBCLASS_WEIGHT);
  }

  return found;
}

/**
 * The groups of classes that are joined to each other, largest first.
 *
 * Laid out separately and packed afterwards. Handing dagre a disconnected graph gets one
 * enormously wide row, because it has no reason to put anything below anything else; a
 * schema's unrelated corners are exactly what wants wrapping.
 */
function groups(ids: readonly string[], edges: readonly Link[]): string[][] {
  const neighbours = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const { from, to } of edges) {
    neighbours.get(from)?.push(to);
    neighbours.get(to)?.push(from);
  }

  const seen = new Set<string>();
  const found: string[][] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const group: string[] = [];
    const stack = [id];
    seen.add(id);
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined) continue;
      group.push(current);
      for (const next of neighbours.get(current) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    found.push(group);
  }

  // Biggest first, so the shape of the schema is the first thing in the top-left corner and
  // the loose singletons collect at the end rather than pushing it down the canvas.
  return found.sort((left, right) => right.length - left.length);
}

interface GroupLayout {
  positions: Map<string, Position>;
  width: number;
  height: number;
}

function layoutGroup(
  members: readonly string[],
  edges: readonly Link[],
  boxes: ReadonlyMap<string, { width: number; height: number }>,
): GroupLayout {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'LR', ranksep: RANK_GAP, nodesep: NODE_GAP, marginx: 0, marginy: 0 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const id of members) {
    graph.setNode(id, boxes.get(id) ?? { width: CLASS_NODE_WIDTH, height: 100 });
  }
  const inside = new Set(members);
  for (const { from, to, weight } of edges) {
    if (inside.has(from) && inside.has(to)) graph.setEdge(from, to, { weight });
  }

  dagre.layout(graph);

  const positions = new Map<string, Position>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const id of members) {
    const node = graph.node(id) as { x: number; y: number } | undefined;
    const box = boxes.get(id);
    if (!node || !box) continue;
    // Dagre reports centres; React Flow positions by top-left corner.
    const x = node.x - box.width / 2;
    const y = node.y - box.height / 2;
    positions.set(id, { x, y });
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + box.width);
    maxY = Math.max(maxY, y + box.height);
  }

  if (!Number.isFinite(minX)) return { positions, width: 0, height: 0 };

  // Normalise to the origin so the packing below can treat every group the same way.
  for (const [id, position] of positions) {
    positions.set(id, { x: position.x - minX, y: position.y - minY });
  }
  return { positions, width: maxX - minX, height: maxY - minY };
}

/**
 * Where every class should sit.
 *
 * Pure and deterministic: the same ontology always produces the same arrangement, which is
 * what makes this usable as a button. A layout you cannot ask for twice is one you cannot
 * get back to after trying something else.
 */
export function arrangeSchema(ontology: Ontology): Map<string, Position> {
  const arrangement = new Map<string, Position>();
  if (ontology.classes.length === 0) return arrangement;

  const boxes = sizes(ontology);
  const edges = links(ontology);
  const ids = ontology.classes.map((entity) => entity.id);

  let cursorX = ORIGIN.x;
  let cursorY = ORIGIN.y;
  let rowHeight = 0;

  for (const group of groups(ids, edges)) {
    const layout = layoutGroup(group, edges, boxes);

    if (cursorX > ORIGIN.x && cursorX + layout.width > MAX_ROW_WIDTH) {
      cursorX = ORIGIN.x;
      cursorY += rowHeight + GROUP_GAP;
      rowHeight = 0;
    }

    for (const [id, position] of layout.positions) {
      arrangement.set(id, { x: cursorX + position.x, y: cursorY + position.y });
    }

    cursorX += layout.width + GROUP_GAP;
    rowHeight = Math.max(rowHeight, layout.height);
  }

  return arrangement;
}
