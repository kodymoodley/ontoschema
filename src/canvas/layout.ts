import dagre from '@dagrejs/dagre';
import type { OntologyClass } from '../ontologymodel';

/**
 * Tree layout for one taxonomy module.
 *
 * Dagre is used rather than a bespoke tree walk because a class may legitimately have two
 * superclasses inside the same module, which makes the module a DAG rather than a tree —
 * dagre ranks and routes that correctly, and centres each parent over its children.
 */

export const TAXONOMY_NODE_WIDTH = 168;
export const TAXONOMY_NODE_HEIGHT = 46;

export interface ModuleLayout {
  positions: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
}

export function layoutTaxonomyModule(
  members: readonly OntologyClass[],
  links: readonly { childId: string; parentId: string }[],
): ModuleLayout {
  const positions = new Map<string, { x: number; y: number }>();
  if (members.length === 0) return { positions, width: 0, height: 0 };

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    // Top-down: root at the top, leaves at the bottom.
    rankdir: 'TB',
    ranksep: 56,
    nodesep: 28,
    marginx: 0,
    marginy: 0,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const entity of members) {
    graph.setNode(entity.id, { width: TAXONOMY_NODE_WIDTH, height: TAXONOMY_NODE_HEIGHT });
  }
  // Dagre ranks sources above targets, so the edge runs parent -> child.
  for (const { childId, parentId } of links) graph.setEdge(parentId, childId);

  dagre.layout(graph);

  let maxX = 0;
  let maxY = 0;
  for (const entity of members) {
    const node = graph.node(entity.id) as { x: number; y: number } | undefined;
    if (!node) continue;
    // Dagre reports centres; React Flow positions by top-left corner.
    const x = node.x - TAXONOMY_NODE_WIDTH / 2;
    const y = node.y - TAXONOMY_NODE_HEIGHT / 2;
    positions.set(entity.id, { x, y });
    maxX = Math.max(maxX, x + TAXONOMY_NODE_WIDTH);
    maxY = Math.max(maxY, y + TAXONOMY_NODE_HEIGHT);
  }

  // Dagre can emit small negative coordinates; shift the module so it starts at the origin.
  let minX = Infinity;
  let minY = Infinity;
  for (const position of positions.values()) {
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
  }
  if (Number.isFinite(minX) && (minX !== 0 || minY !== 0)) {
    for (const [id, position] of positions) {
      positions.set(id, { x: position.x - minX, y: position.y - minY });
    }
    maxX -= minX;
    maxY -= minY;
  }

  return {
    positions,
    width: Math.max(maxX, TAXONOMY_NODE_WIDTH),
    height: Math.max(maxY, TAXONOMY_NODE_HEIGHT),
  };
}

/**
 * Grid placement for newly created schema nodes, so dropping several classes in a row does
 * not stack them on top of one another when no drop position is known.
 */
export function nextFreePosition(
  existing: readonly { x: number; y: number }[],
  origin = { x: 80, y: 80 },
): { x: number; y: number } {
  const step = 220;
  const perRow = 4;
  for (let index = 0; index < 400; index += 1) {
    const candidate = {
      x: origin.x + (index % perRow) * step,
      y: origin.y + Math.floor(index / perRow) * 180,
    };
    const occupied = existing.some(
      (position) =>
        Math.abs(position.x - candidate.x) < 40 && Math.abs(position.y - candidate.y) < 40,
    );
    if (!occupied) return candidate;
  }
  return origin;
}
