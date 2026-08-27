import { describe, expect, it } from 'vitest';
import { orthogonalPath, routeEdges } from './routing';
import type { Rect } from './routing';

/**
 * Lane routing, tested as geometry. Nothing here knows what a class is.
 *
 * The properties worth pinning down are the ones the drawing depends on: a line leaves and
 * enters through a box edge rather than its centre, it runs along a lane clear of everything,
 * and two lines never share a lane.
 */

const box = (x: number, y: number, width = 100, height = 40): Rect => ({ x, y, width, height });

/** The diagram: two rows of boxes, as the taxonomy view lays its modules out. */
const diagram = [box(0, 100), box(200, 100), box(400, 100), box(0, 300), box(200, 300)];

describe('routing along lanes', () => {
  it('has nothing to lay out when there are no edges', () => {
    expect(routeEdges([], diagram)).toEqual([]);
  });

  it('leaves and enters through a box edge, never through the middle of one', () => {
    const [route] = routeEdges([{ id: 'a', from: box(0, 100), to: box(400, 100) }], diagram);
    const [start, , , end] = route!.points;

    // Both ends sit on the top of their box, since this pair routes above.
    expect(start!.y).toBe(100);
    expect(end!.y).toBe(100);
    expect(start!.x).toBe(50);
    expect(end!.x).toBe(450);
  });

  it('is four points and two right angles, with no diagonal anywhere', () => {
    const [route] = routeEdges([{ id: 'a', from: box(0, 100), to: box(400, 100) }], diagram);
    const points = route!.points;

    expect(points).toHaveLength(4);
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1]!;
      const current = points[index]!;
      const straight = previous.x === current.x || previous.y === current.y;
      expect(straight, `segment ${index} is diagonal`).toBe(true);
    }
  });

  it('runs the lane clear of every box', () => {
    const [route] = routeEdges([{ id: 'a', from: box(0, 100), to: box(400, 100) }], diagram);
    const laneY = route!.points[1]!.y;
    const top = Math.min(...diagram.map((rect) => rect.y));

    expect(laneY).toBeLessThan(top);
  });

  /*
   * The reason lanes are worked out for every edge at once. Two edges on the same side sharing
   * a height would draw one line over another and look like one relation.
   */
  it('gives every edge on a side a lane of its own', () => {
    const routes = routeEdges(
      [
        { id: 'a', from: box(0, 100), to: box(400, 100) },
        { id: 'b', from: box(0, 100), to: box(200, 100) },
        { id: 'c', from: box(200, 100), to: box(400, 100) },
      ],
      diagram,
    );

    const lanes = routes.map((route) => route.points[1]!.y);
    expect(new Set(lanes).size).toBe(lanes.length);
  });

  it('sends the widest run furthest out, so shorter ones nest inside it', () => {
    const routes = routeEdges(
      [
        { id: 'narrow', from: box(0, 100), to: box(200, 100) },
        { id: 'wide', from: box(0, 100), to: box(400, 100) },
      ],
      diagram,
    );

    const laneOf = (id: string) => routes.find((route) => route.id === id)!.points[1]!.y;
    // Above the diagram, so further out is a smaller y.
    expect(laneOf('wide')).toBeLessThan(laneOf('narrow'));
  });

  it('goes under when both ends sit low in the diagram', () => {
    const [route] = routeEdges([{ id: 'a', from: box(0, 300), to: box(200, 300) }], diagram);
    const laneY = route!.points[1]!.y;
    const bottom = Math.max(...diagram.map((rect) => rect.y + rect.height));

    expect(laneY).toBeGreaterThan(bottom);
    // And it leaves from the underside of the box, not the top.
    expect(route!.points[0]!.y).toBe(340);
  });

  it('puts the label on the horizontal run, out where nothing else is', () => {
    const [route] = routeEdges([{ id: 'a', from: box(0, 100), to: box(400, 100) }], diagram);

    expect(route!.label.y).toBe(route!.points[1]!.y);
    expect(route!.label.x).toBe(250);
  });
});

describe('drawing the path', () => {
  it('describes nothing for no points', () => {
    expect(orthogonalPath([])).toBe('');
  });

  it('draws a straight line for two', () => {
    expect(
      orthogonalPath([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]),
    ).toBe('M 0,0 L 10,0');
  });

  it('rounds the corners, so a turn does not read as two separate lines', () => {
    const path = orthogonalPath([
      { x: 0, y: 100 },
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    expect(path).toContain('Q');
  });

  /*
   * A corner rounded by more than half its own leg turns the line inside out, which happens
   * whenever two points are closer together than the radius.
   */
  it('never rounds a corner by more than half the segment it is on', () => {
    const path = orthogonalPath(
      [
        { x: 0, y: 4 },
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      8,
    );
    const numbers = [...path.matchAll(/-?\d+(\.\d+)?/g)].map((match) => Number(match[0]));
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(4);
  });
});

/*
 * A relation from a class to itself. Both ends are the same box, so both attach points used to
 * land on the same coordinate: the route went out to the lane and came straight back down the
 * line it had just drawn, which is a stub with no width, no readable direction, and its own
 * name stacked on top of itself.
 */
describe('a relation from a class to itself', () => {
  const box = { x: 100, y: 100, width: 168, height: 46 };

  it('leaves and returns either side of the centre, so the loop has width', () => {
    const [route] = routeEdges([{ id: 'loop', from: box, to: box }], [box]);
    expect(route).toBeDefined();
    if (!route) return;

    const [start, , , end] = route.points;
    expect(start).toBeDefined();
    expect(end).toBeDefined();
    if (!start || !end) return;

    expect(start.x).not.toBe(end.x);
    expect(Math.abs(end.x - start.x)).toBeGreaterThan(0);
  });

  it('keeps the loop inside the class it belongs to', () => {
    const [route] = routeEdges([{ id: 'loop', from: box, to: box }], [box]);
    const xs = (route?.points ?? []).map((point) => point.x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(box.x);
    expect(Math.max(...xs)).toBeLessThanOrEqual(box.x + box.width);
  });

  it('puts the name on the run rather than on the drop', () => {
    const [route] = routeEdges([{ id: 'loop', from: box, to: box }], [box]);
    const first = route?.points[0];
    expect(first).toBeDefined();
    if (!route || !first) return;
    expect(route.label.x).not.toBe(first.x);
    // On the lane, which is clear of the box either above it or below it.
    expect(route.label.y < box.y || route.label.y > box.y + box.height).toBe(true);
  });
});
