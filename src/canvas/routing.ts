/**
 * Routing relation edges through the empty canvas above and below the diagram.
 *
 * The taxonomy view lays its modules out in rows and leaves a great deal of space over and
 * under them. A relation drawn as a curve between two classes ignores that space and takes the
 * shortest way through the middle, so a handful of them pile into the same few hundred pixels,
 * cross each other, and run through whatever classes lie between.
 *
 * These are drawn the way the subclass links are: rigid, right-angled, no curves. Each one
 * leaves its class vertically, runs along a **lane** clear of every node, and comes back down
 * into the other. Lanes are stacked, so two edges sharing a direction never sit on top of one
 * another, and the horizontal run is where the label goes — out in the open, on a straight
 * line, rather than in the middle of the crowd.
 *
 * The alternative was moving the uninvolved classes aside while an edge is shown. It was
 * rejected because the layout is derived, and shifting it under someone who has just clicked a
 * class costs them the picture they were reading. Here nothing moves but the line.
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

/** Vertical distance between neighbouring lanes, and between the first lane and the diagram. */
const LANE_GAP = 34;

export interface EdgeEnds {
  id: string;
  /** The boxes being joined. The line leaves from an edge of each, never from the centre. */
  from: Rect;
  to: Rect;
}

export interface Route {
  id: string;
  points: Point[];
  /** Where the name goes: the middle of the horizontal run, clear of everything. */
  label: Point;
}

/**
 * Lays every visible relation out at once, because lanes only make sense together.
 *
 * Above or below is chosen per edge by which side its two ends are nearer, so an edge between
 * two classes low in the diagram does not climb over everything to reach a lane at the top.
 * Within a side the lanes are handed out shortest-first, which puts the widest run furthest
 * out: a short edge then nests inside a long one instead of crossing it on the way past.
 */
export function routeEdges(edges: readonly EdgeEnds[], obstacles: readonly Rect[]): Route[] {
  if (edges.length === 0) return [];

  const top = Math.min(...obstacles.map((rect) => rect.y));
  const bottom = Math.max(...obstacles.map((rect) => rect.y + rect.height));
  const middle = (top + bottom) / 2;

  const centreY = (rect: Rect) => rect.y + rect.height / 2;
  const centreX = (rect: Rect) => rect.x + rect.width / 2;

  const withSide = edges.map((edge) => ({
    edge,
    // Whichever way out is nearer, so an edge low in the diagram does not climb over it all.
    above: (centreY(edge.from) + centreY(edge.to)) / 2 < middle,
    span: Math.abs(centreX(edge.to) - centreX(edge.from)),
  }));

  const routes: Route[] = [];
  for (const goingAbove of [true, false]) {
    const side = withSide
      .filter((entry) => entry.above === goingAbove)
      // Shortest first, so it takes the nearest lane and the widest run ends up outermost.
      .sort((a, b) => a.span - b.span);

    side.forEach(({ edge }, index) => {
      const laneY = goingAbove ? top - LANE_GAP * (index + 1) : bottom + LANE_GAP * (index + 1);

      // The drops start at the box's own edge, so a line never runs up through what it leaves.
      const attach = (rect: Rect) => ({
        x: centreX(rect),
        y: goingAbove ? rect.y : rect.y + rect.height,
      });
      const start = attach(edge.from);
      const end = attach(edge.to);

      routes.push({
        id: edge.id,
        points: [start, { x: start.x, y: laneY }, { x: end.x, y: laneY }, end],
        label: { x: (start.x + end.x) / 2, y: laneY },
      });
    });
  }
  return routes;
}

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
