/**
 * Drawing a right-angled connector: the path through its corners, its ends fitted to where they
 * are actually drawn, and where its name goes.
 *
 * Shared by both canvases. The taxonomy view works out its own lanes, the schema view has its
 * lines routed around the classes, and both are drawn by the relation edge, which may not reach
 * into the canvas for the geometry. So the drawing lives here, below both.
 */

export interface Point {
  x: number;
  y: number;
}

/** Which way a line leaves the box it starts from, or enters the one it ends at. */
export type Side = 'left' | 'right' | 'top' | 'bottom';

/**
 * An SVG path through the points, with the corners rounded just enough to read as a turn.
 *
 * Rounded rather than square for the same reason the subclass links are: a hard corner at this
 * stroke width reads as a join between two separate lines.
 */
export function orthogonalPath(points: readonly Point[], radius = 8): string {
  if (points.length === 0) return '';
  if (points.length < 3) {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  }

  let path = `M ${points[0]!.x},${points[0]!.y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]!;
    const corner = points[index]!;
    const next = points[index + 1]!;

    // Never round more than half of either leg, or short segments turn inside out.
    const back = Math.min(radius, distance(previous, corner) / 2);
    const forward = Math.min(radius, distance(corner, next) / 2);

    path += ` L ${towards(corner, previous, back).x},${towards(corner, previous, back).y}`;
    path += ` Q ${corner.x},${corner.y} ${towards(corner, next, forward).x},${
      towards(corner, next, forward).y
    }`;
  }
  const last = points.at(-1)!;
  return `${path} L ${last.x},${last.y}`;
}

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

function towards(from: Point, to: Point, by: number): Point {
  const length = distance(from, to) || 1;
  return {
    x: from.x + ((to.x - from.x) / length) * by,
    y: from.y + ((to.y - from.y) / length) * by,
  };
}

const horizontal = (side: Side) => side === 'left' || side === 'right';

/**
 * The ends and the corners of a route, without repeated points or points partway along a straight
 * run. A router can leave either behind; drawn, each would be rounded as if the line turned there.
 */
function corners(points: readonly Point[]): Point[] {
  const kept: Point[] = [];
  for (const point of points) {
    const last = kept.at(-1);
    if (last && last.x === point.x && last.y === point.y) continue;
    const before = kept.at(-2);
    const onTheRun =
      before &&
      last &&
      ((before.x === last.x && last.x === point.x) || (before.y === last.y && last.y === point.y));
    if (onTheRun) kept.pop();
    kept.push(point);
  }
  return kept;
}

/**
 * A route moved to start at `from` and end at `to`, every segment still square.
 *
 * A route is worked out for where the classes were when it was asked for, and drawn for where
 * they are now. Those differ by a few pixels at rest, since a line is drawn from the outer edge of
 * its handle rather than the border, and by more while a class is being dragged and the router
 * has not caught up. Moving only the end points would leave the first and last segments slanted;
 * moving the corner next to each end along with it keeps them square, and the rest of the route,
 * the part that goes around the classes, is untouched.
 *
 * The sides say which way each end leaves its box, which is what decides how its first corner
 * moves. A route with no corners stays straight while its ends still line up, and otherwise gets a
 * pair, so a straight line that is no longer straight becomes a step rather than a slant.
 */
export function fitToEnds(
  points: readonly Point[],
  from: Point,
  fromSide: Side,
  to: Point,
  toSide: Side,
): Point[] {
  const route = corners(points);
  if (route.length < 3) {
    const linedUp = horizontal(fromSide) ? from.y === to.y : from.x === to.x;
    return linedUp ? [{ ...from }, { ...to }] : stepBetween(from, fromSide, to);
  }
  // Moving the first and last corners keeps the route square only if its first and last segments
  // run the way their sides face. One that does not is drawn as a plain step instead.
  const runsAcross = (a: Point, b: Point) => a.y === b.y;
  const last = route.length - 1;
  if (
    runsAcross(route[0]!, route[1]!) !== horizontal(fromSide) ||
    runsAcross(route[last - 1]!, route[last]!) !== horizontal(toSide) ||
    (route.length === 3 && horizontal(fromSide) === horizontal(toSide))
  ) {
    return stepBetween(from, fromSide, to);
  }

  const fitted = route.map((point) => ({ ...point }));
  fitted[0] = { ...from };
  fitted[fitted.length - 1] = { ...to };
  const afterStart = fitted[1]!;
  const beforeEnd = fitted[fitted.length - 2]!;
  if (horizontal(fromSide)) afterStart.y = from.y;
  else afterStart.x = from.x;
  if (horizontal(toSide)) beforeEnd.y = to.y;
  else beforeEnd.x = to.x;
  return fitted;
}

/** Two corners halfway across, leaving `from` the way its side faces. */
function stepBetween(from: Point, fromSide: Side, to: Point): Point[] {
  if (horizontal(fromSide)) {
    const middle = (from.x + to.x) / 2;
    return [from, { x: middle, y: from.y }, { x: middle, y: to.y }, to];
  }
  const middle = (from.y + to.y) / 2;
  return [from, { x: from.x, y: middle }, { x: to.x, y: middle }, to];
}

/** Where a connector's name goes: the middle of its longest straight run, out in the open. */
export function labelPoint(points: readonly Point[]): Point {
  let best = { length: -1, at: points[0] ?? { x: 0, y: 0 } };
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]!;
    const b = points[index]!;
    const length = distance(a, b);
    if (length > best.length) best = { length, at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  }
  return best.at;
}
