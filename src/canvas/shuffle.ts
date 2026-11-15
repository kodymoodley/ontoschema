import type { Position } from '../ontologymodel';
import { d3dagAffordable, d3dagGroup } from './d3daglayout';
import { dagreGroup, normalised, pack } from './layeredlayout';
import type { Direction, GroupLayout, LayoutGraph } from './layeredlayout';
import { scoreLayout } from './layoutscore';

/**
 * A different arrangement of the schema each time, and never a worse one than Tidy up.
 *
 * Tidy up gives the same answer every time, so when it leaves lines crossing there is no way to
 * ask for another. Each shuffle lays every group out many times, from random starting orders and
 * with two engines, scores each layout (`layoutscore.ts`), and keeps the best one that is not
 * what is on screen already. Tidy up's own layout, in the same direction, is always among the
 * candidates and sets the bar: a candidate that scores worse is never chosen.
 *
 * Pure apart from the clock, so it can be tested here and run in a worker (`shuffle.worker.ts`).
 */

export interface ShuffleRequest {
  graph: LayoutGraph;
  /** Where the classes are now, so the shuffle can avoid handing back the same layout. */
  current: ReadonlyMap<string, Position>;
  direction: Direction;
  /** Decides the random starting orders; the same seed gives the same layout. */
  seed: number;
  /** Roughly how long to keep trying. One try per group always runs, however long it takes. */
  budgetMs: number;
}

export interface ShuffleResult {
  positions: Map<string, Position>;
  /** False when nothing better than what is on screen turned up, and nothing moved. */
  changed: boolean;
}

/** Enough tries for a small schema to have shown most of what it can look like. */
const MAX_ROUNDS = 12;

/** Groups smaller than this have only one sensible layout, Tidy up's. */
const SMALLEST_TO_SHUFFLE = 3;

/** How far a class may be from where it was and still count as not having moved. */
const SAME_WITHIN = 1;

/** Park-Miller: small, seedable, and good enough to shuffle a list. */
export function seeded(seed: number): () => number {
  let state = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

function sameLayout(left: GroupLayout, right: GroupLayout): boolean {
  for (const [id, position] of left.positions) {
    const other = right.positions.get(id);
    if (
      !other ||
      Math.abs(other.x - position.x) > SAME_WITHIN ||
      Math.abs(other.y - position.y) > SAME_WITHIN
    ) {
      return false;
    }
  }
  return true;
}

interface GroupSearch {
  members: readonly string[];
  consider: (layout: GroupLayout) => void;
  /** The best layout found, or what is on screen if nothing beat it. */
  result: () => { layout: GroupLayout; changed: boolean };
}

/** The search for one group: the bar to clear, what is on screen, and the best found so far. */
function groupSearch(
  graph: LayoutGraph,
  members: readonly string[],
  current: ReadonlyMap<string, Position>,
  direction: Direction,
): GroupSearch {
  const score = (layout: GroupLayout) =>
    scoreLayout(layout.positions, graph.boxes, graph.links).value;

  const here = new Map<string, Position>();
  for (const id of members) {
    const position = current.get(id);
    if (position) here.set(id, position);
  }
  const onScreen = normalised(here, graph.boxes);
  const tidy = dagreGroup(graph, members, { direction });
  const bar = score(tidy);
  let best: { layout: GroupLayout; value: number } | null = null;

  const consider = (layout: GroupLayout) => {
    if (sameLayout(layout, onScreen)) return;
    const value = score(layout);
    if (value > bar) return;
    if (best === null || value < best.value) best = { layout, value };
  };
  consider(tidy);

  return {
    members,
    consider,
    result: () =>
      best ? { layout: best.layout, changed: true } : { layout: onScreen, changed: false },
  };
}

export function shuffleLayout(
  request: ShuffleRequest,
  clock: () => number = () => performance.now(),
): ShuffleResult {
  const { graph, current, direction, seed, budgetMs } = request;
  const started = clock();
  const random = seeded(seed);
  const searches = graph.groups.map((members) => groupSearch(graph, members, current, direction));
  const shufflable = searches.filter((search) => search.members.length >= SMALLEST_TO_SHUFFLE);

  const affordable = shufflable.map((search) => d3dagAffordable(graph, search.members));

  // Round by round, a try for each group in turn, until the rounds or the time run out.
  for (let attempt = 0; attempt < MAX_ROUNDS * shufflable.length; attempt += 1) {
    const round = Math.floor(attempt / shufflable.length);
    const which = attempt % shufflable.length;
    const search = shufflable[which];
    if (!search) break;
    // Every group gets one try past Tidy up's, however long it takes, so there is something else
    // to show.
    if (round > 0 && clock() - started > budgetMs) break;
    // d3-dag first where it is affordable: on schemas of the size people draw, it untangles most.
    const engine = round % 2 === 0 && affordable[which] ? d3dagGroup : dagreGroup;
    search.consider(engine(graph, search.members, { direction, random }));
  }

  const results = searches.map((search) => search.result());
  return {
    positions: pack(results.map((result) => result.layout)),
    changed: results.some((result) => result.changed),
  };
}
