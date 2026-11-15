import dagre from '@dagrejs/dagre';
import type { Position } from '../ontologymodel';

/**
 * The pieces every arrangement of the schema canvas shares, whichever engine places the classes.
 *
 * Kept apart from the schema itself, so the shuffle can run in a worker: the worker is handed this
 * plain graph rather than an ontology, and never loads the model to read one.
 *
 * Two arrangements use it. "Tidy up" lays each group out once with dagre, left to right, and is
 * the same every time (`arrange.ts`). "Shuffle" tries many layouts from two engines and keeps the
 * best (`shuffle.ts`). Both lay out each joined group on its own and pack the groups afterwards.
 */

/** Between ranks: wide enough for a relation's name to sit on the line without touching either box. */
export const RANK_GAP = 140;

/** Between boxes within a rank. */
export const NODE_GAP = 44;

/** Between disconnected groups, and where a row of them wraps. */
const GROUP_GAP = 90;
const MAX_ROW_WIDTH = 2400;

/** The canvas margin, so the arrangement does not start hard against the origin. */
const ORIGIN = { x: 60, y: 60 };

/** Which way the ranks run: left to right, or top to bottom. */
export type Direction = 'LR' | 'TB';

export interface Box {
  width: number;
  height: number;
}

export interface Link {
  from: string;
  to: string;
  /** How much the layout wants this link short and straight. */
  weight: number;
  /** Whether the schema view draws a line for it, which is what a layout is judged on. */
  drawn: boolean;
}

/** What a layout is computed from: the boxes, the links between them, and the joined groups. */
export interface LayoutGraph {
  boxes: ReadonlyMap<string, Box>;
  links: readonly Link[];
  /** Largest first; see `groups`. */
  groups: readonly (readonly string[])[];
}

/** One group laid out, with its top-left corner at the origin. */
export interface GroupLayout {
  positions: Map<string, Position>;
  width: number;
  height: number;
}

/**
 * The groups of classes that are joined to each other, largest first.
 *
 * Laid out separately and packed afterwards. Handing dagre a disconnected graph gets one
 * enormously wide row, because it has no reason to put anything below anything else; a
 * schema's unrelated corners are exactly what wants wrapping.
 */
export function groups(ids: readonly string[], links: readonly Link[]): string[][] {
  const neighbours = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const { from, to } of links) {
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

/** The links with both ends in a group. */
export function linksWithin(graph: LayoutGraph, members: readonly string[]): Link[] {
  const inside = new Set(members);
  return graph.links.filter(({ from, to }) => inside.has(from) && inside.has(to));
}

/**
 * Moves a group's top-left corner to the origin and measures it, from top-left positions.
 *
 * Every engine ends here, so the packing below can treat every group the same way.
 */
export function normalised(
  positions: ReadonlyMap<string, Position>,
  boxes: ReadonlyMap<string, Box>,
): GroupLayout {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [id, { x, y }] of positions) {
    const box = boxes.get(id);
    if (!box) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + box.width);
    maxY = Math.max(maxY, y + box.height);
  }
  if (!Number.isFinite(minX)) return { positions: new Map(), width: 0, height: 0 };

  const moved = new Map<string, Position>();
  for (const [id, { x, y }] of positions) moved.set(id, { x: x - minX, y: y - minY });
  return { positions: moved, width: maxX - minX, height: maxY - minY };
}

/** A copy in a random order, so dagre starts its search somewhere else. */
export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other] as T, copy[index] as T];
  }
  return copy;
}

/**
 * One group laid out by dagre.
 *
 * Dagre is deterministic for a given input order, and the order it is handed decides where its
 * search for fewer crossings starts. Tidy up hands it the schema's own order, so it gets the same
 * answer every time; the shuffle hands it a random one, given `random`, to get a different one.
 */
export function dagreGroup(
  graph: LayoutGraph,
  members: readonly string[],
  options: { direction: Direction; random?: () => number },
): GroupLayout {
  const { direction, random } = options;
  const layout = new dagre.graphlib.Graph();
  layout.setGraph({
    rankdir: direction,
    ranksep: RANK_GAP,
    nodesep: NODE_GAP,
    marginx: 0,
    marginy: 0,
  });
  layout.setDefaultEdgeLabel(() => ({}));

  const links = linksWithin(graph, members);
  for (const id of random ? shuffled(members, random) : members) {
    const box = graph.boxes.get(id);
    if (box) layout.setNode(id, { width: box.width, height: box.height });
  }
  for (const { from, to, weight } of random ? shuffled(links, random) : links) {
    layout.setEdge(from, to, { weight });
  }

  dagre.layout(layout);

  const positions = new Map<string, Position>();
  for (const id of members) {
    const node = layout.node(id) as { x: number; y: number } | undefined;
    const box = graph.boxes.get(id);
    if (!node || !box) continue;
    // Dagre reports centres; React Flow positions by top-left corner.
    positions.set(id, { x: node.x - box.width / 2, y: node.y - box.height / 2 });
  }
  return normalised(positions, graph.boxes);
}

/** Places the groups in rows, in order, wrapping a row once it is wide enough. */
export function pack(layouts: readonly GroupLayout[]): Map<string, Position> {
  const arrangement = new Map<string, Position>();
  let cursorX = ORIGIN.x;
  let cursorY = ORIGIN.y;
  let rowHeight = 0;

  for (const layout of layouts) {
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
