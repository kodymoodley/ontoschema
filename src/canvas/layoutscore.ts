import type { Position } from '../ontologymodel';
import type { Box, Link } from './layeredlayout';

/**
 * How hard a layout is to read, as one number: lower is better.
 *
 * What makes a schema drawing hard to follow is lines crossing each other and lines running
 * through classes they do not belong to, so the number counts those. A line through a box costs
 * three crossings, because it reads as a relation the class takes part in. Total line length
 * breaks ties, so of two layouts as tangled as each other the more compact one wins.
 *
 * Judged on straight lines from centre to centre. The canvas draws its own lines, which bend
 * and fan out, but the straight line is what they follow, and judging the real routes would mean
 * running the canvas's routing for every candidate. Only drawn links count: the hierarchy shapes
 * a layout but is not drawn on the schema view, so it cannot tangle anything.
 */

/** A line through a class costs this many crossings. */
const THROUGH_COST = 3;

/** Pixels of line that cost as much as one crossing. */
const LENGTH_PER_CROSSING = 2000;

/** How far into a box a line must reach to count as passing through it, not grazing it. */
const GRAZE = 4;

export interface LayoutScore {
  crossings: number;
  /** Lines passing through a class at neither of their ends. */
  through: number;
  length: number;
  /** The three combined; what layouts are compared on. */
  value: number;
}

interface Point {
  x: number;
  y: number;
}

interface Rect extends Point {
  width: number;
  height: number;
}

/** Which side of the line from `p` to `q` the point `r` is on: -1, 0 or 1. */
function side(p: Point, q: Point, r: Point): number {
  return Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
}

/** True when the segments cross at a point inside both; touching or overlapping is not crossing. */
export function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

/** True when the segment passes through the box, shrunk by `GRAZE` so touching an edge is not it. */
export function segmentHitsBox(a: Point, b: Point, box: Rect): boolean {
  // Liang-Barsky: clip the segment against each side in turn, and see whether anything is left.
  const left = box.x + GRAZE;
  const top = box.y + GRAZE;
  const right = box.x + box.width - GRAZE;
  const bottom = box.y + box.height - GRAZE;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let enter = 0;
  let leave = 1;
  for (const [p, q] of [
    [-dx, a.x - left],
    [dx, right - a.x],
    [-dy, a.y - top],
    [dy, bottom - a.y],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > leave) return false;
      enter = Math.max(enter, t);
    } else {
      if (t < enter) return false;
      leave = Math.min(leave, t);
    }
  }
  return true;
}

/** Scores the classes in `positions`, judging only the links with both ends among them. */
export function scoreLayout(
  positions: ReadonlyMap<string, Position>,
  boxes: ReadonlyMap<string, Box>,
  links: readonly Link[],
): LayoutScore {
  const rects = new Map<string, Rect>();
  for (const [id, position] of positions) {
    const box = boxes.get(id);
    if (box) rects.set(id, { ...position, ...box });
  }
  const centre = (rect: Rect): Point => ({
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  });

  const lines: { from: string; to: string; a: Point; b: Point }[] = [];
  for (const { from, to, drawn } of links) {
    const start = rects.get(from);
    const end = rects.get(to);
    if (drawn && start && end) lines.push({ from, to, a: centre(start), b: centre(end) });
  }

  let crossings = 0;
  let through = 0;
  let length = 0;
  lines.forEach((line, index) => {
    length += Math.hypot(line.b.x - line.a.x, line.b.y - line.a.y);
    for (let next = index + 1; next < lines.length; next += 1) {
      const other = lines[next];
      if (!other) continue;
      // Lines that share a class meet there; that is a junction, not a crossing.
      const shared =
        line.from === other.from ||
        line.from === other.to ||
        line.to === other.from ||
        line.to === other.to;
      if (!shared && segmentsCross(line.a, line.b, other.a, other.b)) crossings += 1;
    }
    for (const [id, rect] of rects) {
      if (id !== line.from && id !== line.to && segmentHitsBox(line.a, line.b, rect)) through += 1;
    }
  });

  return {
    crossings,
    through,
    length,
    value: crossings + THROUGH_COST * through + length / LENGTH_PER_CROSSING,
  };
}
