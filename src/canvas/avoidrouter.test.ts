import { AvoidLib } from 'libavoid-js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Point } from '../designsystem';
import { createAvoidRouter } from './avoidrouter';
import type { AvoidApi, AvoidRouter, RoutingConnector, RoutingShape } from './avoidrouter';
import { seeded } from './shuffle';

/**
 * Routing relation lines around classes, against the real libavoid. The promise is that no line
 * passes through a class it does not belong to, so that is what most of these measure; the rest
 * hold the router to starting and ending each line exactly where it was asked to.
 */

let avoid: AvoidApi;
beforeAll(async () => {
  await AvoidLib.load();
  avoid = AvoidLib.getInstance() as unknown as AvoidApi;
});

let router: AvoidRouter | null = null;
afterEach(() => {
  router?.dispose();
  router = null;
});
const fresh = () => (router = createAvoidRouter(avoid));

const box = (id: string, x: number, y: number, width = 200, height = 100): RoutingShape => ({
  id,
  x,
  y,
  width,
  height,
});

const line = (
  id: string,
  from: string,
  to: string,
  sides: [RoutingConnector['from']['side'], RoutingConnector['to']['side']] = ['right', 'left'],
  offsets: [number, number] = [0, 0],
): RoutingConnector => ({
  id,
  from: { shape: from, side: sides[0], offset: offsets[0] },
  to: { shape: to, side: sides[1], offset: offsets[1] },
});

/** True when every segment runs straight across or straight down. */
const square = (points: readonly Point[]) =>
  points.every((p, i) => i === 0 || p.x === points[i - 1]!.x || p.y === points[i - 1]!.y);

/** The classes a route passes through, other than the two it joins. */
function crossed(points: readonly Point[], shapes: readonly RoutingShape[], ends: string[]) {
  return shapes
    .filter((shape) => !ends.includes(shape.id))
    .filter((shape) =>
      points.slice(1).some((b, i) => {
        const a = points[i]!;
        const [left, right] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
        const [top, bottom] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
        return (
          right > shape.x + 1 &&
          left < shape.x + shape.width - 1 &&
          bottom > shape.y + 1 &&
          top < shape.y + shape.height - 1
        );
      }),
    )
    .map((shape) => shape.id);
}

describe('routing a line around the classes', () => {
  // A and B side by side, and C squarely on the straight line between them.
  const shapes = [box('A', 0, 0), box('B', 600, 0), box('C', 300, -20, 120, 140)];

  it('goes around a class in the way, with every segment square', () => {
    const route = fresh()
      .route({ shapes, connectors: [line('ab', 'A', 'B')] })
      .get('ab')!;
    expect(crossed(route, shapes, ['A', 'B'])).toEqual([]);
    expect(square(route)).toBe(true);
  });

  it('starts and ends exactly where it is asked to, fan offsets included', () => {
    const route = fresh()
      .route({ shapes, connectors: [line('ab', 'A', 'B', ['right', 'left'], [13, -13])] })
      .get('ab')!;
    expect(route[0]).toEqual({ x: 200, y: 63 });
    expect(route.at(-1)).toEqual({ x: 600, y: 37 });
  });

  it('runs straight once the class in the way has moved off', () => {
    const routing = fresh();
    routing.route({ shapes, connectors: [line('ab', 'A', 'B')] });
    const moved = [shapes[0]!, shapes[1]!, box('C', 300, 400, 120, 140)];
    const route = routing.route({ shapes: moved, connectors: [line('ab', 'A', 'B')] }).get('ab')!;
    expect(route).toEqual([
      { x: 200, y: 50 },
      { x: 600, y: 50 },
    ]);
  });

  it('leaves from a side that has changed', () => {
    const routing = fresh();
    routing.route({ shapes, connectors: [line('ab', 'A', 'B')] });
    const route = routing
      .route({ shapes, connectors: [line('ab', 'A', 'B', ['bottom', 'bottom'])] })
      .get('ab')!;
    expect(route[0]).toEqual({ x: 100, y: 100 });
    expect(route.at(-1)).toEqual({ x: 700, y: 100 });
    expect(crossed(route, shapes, ['A', 'B'])).toEqual([]);
  });

  it('drops lines and classes that have gone, and takes them back', () => {
    const routing = fresh();
    routing.route({ shapes, connectors: [line('ab', 'A', 'B'), line('ac', 'A', 'C')] });
    const without = routing.route({
      shapes: shapes.slice(0, 2),
      connectors: [line('ab', 'A', 'B')],
    });
    expect([...without.keys()]).toEqual(['ab']);
    const back = routing.route({
      shapes,
      connectors: [line('ab', 'A', 'B'), line('ac', 'A', 'C')],
    });
    expect([...back.keys()].sort()).toEqual(['ab', 'ac']);
  });

  it('draws a relation from a class to itself around the outside of it', () => {
    const route = fresh()
      .route({ shapes, connectors: [line('aa', 'A', 'A', ['right', 'top'])] })
      .get('aa')!;
    expect(route[0]).toEqual({ x: 200, y: 50 });
    expect(route.at(-1)).toEqual({ x: 100, y: 0 });
    expect(square(route)).toBe(true);
    // Out of the box and back: no segment runs through it.
    expect(crossed(route, [box('inside', 1, 1, 198, 98)], [])).toEqual([]);
  });
});

/*
 * The case the router was nearly turned down over: 60 classes and 132 relations joining them at
 * random. With libavoid's defaults this took over three seconds and nearly six for each move;
 * `avoidrouter.ts` says which setting fixed it.
 */
describe('a crowded schema', () => {
  const random = seeded(7);
  const shapes = Array.from({ length: 60 }, (_, i) =>
    box(`c${i}`, (i % 10) * 320, Math.floor(i / 10) * 260, 224, 80 + Math.floor(random() * 4) * 22),
  );
  const sides = ['top', 'right', 'bottom', 'left'] as const;
  // Offsets as the fan in `bundles.ts` spreads them.
  const offsets = [-26, -13, 0, 13, 26];
  const connectors = Array.from({ length: 132 }, (_, i) => {
    const from = Math.floor(random() * 60);
    const to = (from + 1 + Math.floor(random() * 59)) % 60;
    return line(
      `r${i}`,
      `c${from}`,
      `c${to}`,
      [sides[Math.floor(random() * 4)]!, sides[Math.floor(random() * 4)]!],
      [offsets[Math.floor(random() * 5)]!, offsets[Math.floor(random() * 5)]!],
    );
  });

  /** Where an end was asked to be: on its side, moved along it by its offset. */
  const placeOf = (end: RoutingConnector['from']): Point => {
    const shape = shapes.find((candidate) => candidate.id === end.shape)!;
    const middle = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
    switch (end.side) {
      case 'top':
        return { x: middle.x + end.offset, y: shape.y };
      case 'bottom':
        return { x: middle.x + end.offset, y: shape.y + shape.height };
      case 'left':
        return { x: shape.x, y: middle.y + end.offset };
      case 'right':
        return { x: shape.x + shape.width, y: middle.y + end.offset };
    }
  };

  it('routes every line clear of every other class, from and to the places asked for, quickly', () => {
    const started = performance.now();
    const routes = fresh().route({ shapes, connectors });
    const took = performance.now() - started;

    expect(routes.size).toBe(connectors.length);
    for (const connector of connectors) {
      const route = routes.get(connector.id)!;
      expect(
        crossed(route, shapes, [connector.from.shape, connector.to.shape]),
        connector.id,
      ).toEqual([]);
      // A route libavoid could not find comes back as a straight line between the centres.
      expect(route[0], connector.id).toEqual(placeOf(connector.from));
      expect(route.at(-1), connector.id).toEqual(placeOf(connector.to));
    }
    // About 40 ms on the machine it was written on; the ceiling is for a slow CI runner.
    expect(took).toBeLessThan(1500);
  });

  it('keeps up with a class being dragged across it', () => {
    const routing = fresh();
    routing.route({ shapes, connectors });
    const started = performance.now();
    let routes = new Map<string, Point[]>();
    for (let step = 1; step <= 30; step += 1) {
      const moved = shapes.map((shape) =>
        shape.id === 'c0' ? { ...shape, x: shape.x + step * 20, y: shape.y + step * 15 } : shape,
      );
      routes = routing.route({ shapes: moved, connectors });
    }
    const perMove = (performance.now() - started) / 30;
    expect(routes.size).toBe(connectors.length);
    expect(perMove).toBeLessThan(500);
  });
});
