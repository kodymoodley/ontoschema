import { describe, expect, it } from 'vitest';
import { fitToEnds, labelPoint, orthogonalPath } from './connector';
import type { Point } from './connector';

/** True when every segment runs straight across or straight down. */
const square = (points: readonly Point[]) =>
  points.every((point, index) => {
    const previous = points[index - 1];
    return !previous || previous.x === point.x || previous.y === point.y;
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

describe('fitting a route to where its ends are drawn', () => {
  // Out of a right side, down, and into a left side: the shape a router hands back.
  const route = [
    { x: 100, y: 50 },
    { x: 150, y: 50 },
    { x: 150, y: 200 },
    { x: 300, y: 200 },
  ];

  it('moves the ends, and the corners beside them, and nothing else', () => {
    const fitted = fitToEnds(route, { x: 104, y: 60 }, 'right', { x: 296, y: 190 }, 'left');
    expect(fitted).toEqual([
      { x: 104, y: 60 },
      { x: 150, y: 60 },
      { x: 150, y: 190 },
      { x: 296, y: 190 },
    ]);
    expect(square(fitted)).toBe(true);
  });

  it('keeps a route square however far a class has moved since it was worked out', () => {
    const fitted = fitToEnds(route, { x: 40, y: 300 }, 'right', { x: 500, y: -20 }, 'left');
    expect(square(fitted)).toBe(true);
    expect(fitted[0]).toEqual({ x: 40, y: 300 });
    expect(fitted.at(-1)).toEqual({ x: 500, y: -20 });
  });

  it('leaves a route that leaves through the top going up', () => {
    const upward = [
      { x: 50, y: 100 },
      { x: 50, y: 40 },
      { x: 200, y: 40 },
      { x: 200, y: 100 },
    ];
    const fitted = fitToEnds(upward, { x: 58, y: 96 }, 'top', { x: 190, y: 96 }, 'top');
    expect(fitted).toEqual([
      { x: 58, y: 96 },
      { x: 58, y: 40 },
      { x: 190, y: 40 },
      { x: 190, y: 96 },
    ]);
  });

  it('turns a straight line that no longer lines up into a step, not a slant', () => {
    const fitted = fitToEnds(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      { x: 0, y: 0 },
      'right',
      { x: 100, y: 30 },
      'left',
    );
    expect(fitted).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 30 },
      { x: 100, y: 30 },
    ]);
  });

  it('ignores repeated points, which a router can leave where a segment has no length', () => {
    const repeated = [route[0]!, route[0]!, ...route.slice(1)];
    expect(fitToEnds(repeated, route[0]!, 'right', route.at(-1)!, 'left')).toEqual(route);
  });

  it('draws a step rather than a slant when a route does not leave the way its side faces', () => {
    // Leaves a right side going down: no way to move its first corner and stay square.
    const wrongWay = [
      { x: 100, y: 50 },
      { x: 100, y: 200 },
      { x: 300, y: 200 },
    ];
    const fitted = fitToEnds(wrongWay, { x: 100, y: 50 }, 'right', { x: 300, y: 200 }, 'left');
    expect(square(fitted)).toBe(true);
    expect(fitted).toHaveLength(4);
  });
});

describe('placing the name', () => {
  it('puts it in the middle of the longest straight run', () => {
    expect(
      labelPoint([
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 200 },
        { x: 60, y: 200 },
      ]),
    ).toEqual({ x: 20, y: 100 });
  });

  it('has somewhere to put it even for a single point', () => {
    expect(labelPoint([{ x: 5, y: 7 }])).toEqual({ x: 5, y: 7 });
  });
});
