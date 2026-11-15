import { coordSimplex, decrossTwoLayer, graphConnect, layeringSimplex, sugiyama } from 'd3-dag';
import type { Position } from '../ontologymodel';
import { NODE_GAP, RANK_GAP, linksWithin, normalised, shuffled } from './layeredlayout';
import type { Direction, GroupLayout, LayoutGraph, Link } from './layeredlayout';

/**
 * One group laid out by d3-dag, the shuffle's second engine.
 *
 * The same layered method as dagre, with different choices at each step: ranks that keep the
 * total line length down, and positions within a rank found by optimisation rather than by
 * heuristic. On the example schemas it untangles what dagre cannot, which is why the shuffle
 * runs both and keeps whichever scores better. It is slow on densely linked groups, hence `d3dagAffordable`.
 *
 * Only the shuffle uses it, and the shuffle runs in a worker, so it is never in the bundle the
 * app opens with.
 */

/**
 * Past this many links in a group, d3-dag's optimiser stops being quick. Its cost follows the
 * links rather than the classes, because every link that spans more than one rank becomes a chain
 * of hidden nodes to place. Measured on random schemas: about 160 ms at 96 links, 240 ms at 88
 * links between only 40 classes, and nearly two seconds at 132.
 */
const LINK_LIMIT = 100;

/** Whether d3-dag can lay this group out in a fraction of a second. */
export function d3dagAffordable(graph: LayoutGraph, members: readonly string[]): boolean {
  return linksWithin(graph, members).length <= LINK_LIMIT;
}

/**
 * The links as pairs d3-dag accepts: no cycles, no repeats.
 *
 * d3-dag lays out only acyclic graphs, and a schema's relations go round in circles all the
 * time. A depth-first walk finds the links that point back up it, and those are turned round:
 * the classes stay joined, only which of the two goes in the higher rank changes. Where the
 * walk starts, given by `order`, decides which links those are.
 */
export function acyclicPairs(links: readonly Link[], order: readonly string[]): [string, string][] {
  const out = new Map<string, string[]>(order.map((id) => [id, []]));
  for (const { from, to } of links) out.get(from)?.push(to);

  const onPath = new Set<string>();
  const done = new Set<string>();
  const backwards = new Set<string>();
  const visit = (id: string) => {
    onPath.add(id);
    for (const next of out.get(id) ?? []) {
      if (onPath.has(next)) backwards.add(`${id}\n${next}`);
      else if (!done.has(next)) visit(next);
    }
    onPath.delete(id);
    done.add(id);
  };
  for (const id of order) if (!done.has(id)) visit(id);

  const pairs = new Map<string, [string, string]>();
  for (const { from, to } of links) {
    const pair: [string, string] = backwards.has(`${from}\n${to}`) ? [to, from] : [from, to];
    pairs.set(pair.join('\n'), pair);
  }
  return [...pairs.values()];
}

export function d3dagGroup(
  graph: LayoutGraph,
  members: readonly string[],
  options: { direction: Direction; random: () => number },
): GroupLayout {
  const { direction, random } = options;
  const order = shuffled(members, random);
  const pairs = shuffled(acyclicPairs(linksWithin(graph, members), order), random);
  // A class with no links in the group is handed over as a pair with itself, which d3-dag reads
  // as a lone node once `single` is on.
  const linked = new Set(pairs.flat());
  for (const id of order) if (!linked.has(id)) pairs.push([id, id]);

  const dag = graphConnect().single(true)(pairs);

  // d3-dag ranks downwards. Left to right is the same layout turned on its side: lay it out with
  // each box's width and height swapped, then swap the coordinates back.
  const across = direction === 'LR';
  const size = (id: string): [number, number] => {
    const box = graph.boxes.get(id);
    if (!box) return [0, 0];
    return across ? [box.height, box.width] : [box.width, box.height];
  };
  sugiyama()
    .layering(layeringSimplex())
    .decross(decrossTwoLayer())
    .coord(coordSimplex())
    .nodeSize((node: { data: string }) => size(node.data))
    // Across a rank, then between ranks: d3-dag's own frame, whichever way the result is turned.
    .gap([NODE_GAP, RANK_GAP])(dag);

  const positions = new Map<string, Position>();
  for (const node of dag.nodes()) {
    const box = graph.boxes.get(node.data);
    if (!box) continue;
    const centre = across ? { x: node.y, y: node.x } : { x: node.x, y: node.y };
    // d3-dag reports centres; React Flow positions by top-left corner.
    positions.set(node.data, { x: centre.x - box.width / 2, y: centre.y - box.height / 2 });
  }
  return normalised(positions, graph.boxes);
}
