/**
 * Steering an edge around the classes that have nothing to do with it.
 *
 * A relation drawn straight between two distant classes runs through whatever lies between
 * them, and in the taxonomy view that is usually three or four other classes. The line reads
 * as though it touched each one, which is the opposite of what it says.
 *
 * The alternative was moving the uninvolved classes aside while the edge is shown and putting
 * them back afterwards. That was rejected: the taxonomy layout is derived, and shifting it
 * under someone who has just clicked a class costs them the picture they were reading. Bending
 * the line is the smaller change, and it is the line that is at fault.
 *
 * The route is deliberately simple — one detour, above or below whichever is nearer, past the
 * whole run of obstacles. Anything cleverer (a visibility graph, orthogonal routing with
 * corners) is a great deal of machinery for a view that shows one class's relations at a time,
 * and the extra bends would cost more legibility than they bought.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** How far clear of an obstacle a detour passes. Enough to read as "around", not "through". */
const CLEARANCE = 22;

/**
 * A point to route through, or `null` when the straight line is already clear.
 *
 * One point rather than a path: the caller draws a curve through it, and a curve through one
 * well-chosen point is smoother than a polyline through several.
 */
export function detourAround(from: Point, to: Point, obstacles: readonly Rect[]): Point | null {
  const hit = obstacles.filter((rect) => segmentCrossesRect(from, to, rect));
  if (hit.length === 0) return null;

  const midX = (from.x + to.x) / 2;
  const top = Math.min(...hit.map((rect) => rect.y));
  const bottom = Math.max(...hit.map((rect) => rect.y + rect.height));

  // Over or under, whichever is the shorter way out from where the line already is.
  const midY = (from.y + to.y) / 2;
  return midY - top < bottom - midY
    ? { x: midX, y: top - CLEARANCE }
    : { x: midX, y: bottom + CLEARANCE };
}

/**
 * Whether a line segment passes through a rectangle.
 *
 * The cheap half first: a segment whose bounding box misses the rectangle cannot cross it, and
 * that rejects nearly everything. Only then is each of the four sides tested.
 */
export function segmentCrossesRect(from: Point, to: Point, rect: Rect): boolean {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  if (Math.max(from.x, to.x) < rect.x || Math.min(from.x, to.x) > right) return false;
  if (Math.max(from.y, to.y) < rect.y || Math.min(from.y, to.y) > bottom) return false;

  // An endpoint inside the rectangle counts: the line is through it whatever the sides say.
  if (inside(from, rect) || inside(to, rect)) return true;

  const corners: Point[] = [
    { x: rect.x, y: rect.y },
    { x: right, y: rect.y },
    { x: right, y: bottom },
    { x: rect.x, y: bottom },
  ];
  return corners.some((corner, index) =>
    segmentsIntersect(from, to, corner, corners[(index + 1) % corners.length] as Point),
  );
}

const inside = (point: Point, rect: Rect) =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

/** Orientation test, the standard one: two segments cross when each straddles the other. */
function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const side = (p: Point, q: Point, r: Point) =>
    Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b);
}
