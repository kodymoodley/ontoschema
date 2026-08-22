import { describe, expect, it } from 'vitest';
import {
  CLASS_NODE_WIDTH,
  chooseSides,
  estimateClassHeight,
  sourceHandleId,
  targetHandleId,
} from './layout';
import type { Box } from './layout';

/**
 * Which sides an edge leaves from and arrives at. Forcing every relation out of the right
 * edge and into the left made lines loop back on themselves whenever the target sat above,
 * below or behind the source.
 */

const box = (x: number, y: number, height = 200): Box => ({
  x,
  y,
  width: CLASS_NODE_WIDTH,
  height,
});

describe('chooseSides', () => {
  const origin = box(0, 0);

  it.each([
    ['directly right', box(600, 0), 'right', 'left'],
    ['directly left', box(-600, 0), 'left', 'right'],
    ['directly below', box(0, 600), 'bottom', 'top'],
    ['directly above', box(0, -600), 'top', 'bottom'],
  ])('routes a target %s through the facing sides', (_label, target, source, arrival) => {
    expect(chooseSides(origin, target)).toEqual({ source, target: arrival });
  });

  it.each([
    ['down and to the right', box(600, 200), 'right'],
    ['down and to the left', box(-600, 200), 'left'],
    ['up and to the right', box(600, -200), 'right'],
  ])('prefers the horizontal sides when the target is mostly %s', (_label, target, side) => {
    expect(chooseSides(origin, target).source).toBe(side);
  });

  it('prefers the vertical sides when the target is mostly above or below', () => {
    expect(chooseSides(origin, box(120, 900)).source).toBe('bottom');
    expect(chooseSides(origin, box(-120, -900)).source).toBe('top');
  });

  it('always picks opposite sides, so the line never doubles back', () => {
    const opposite = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' } as const;
    for (const target of [
      box(500, 30),
      box(-500, 30),
      box(30, 500),
      box(-30, -500),
      box(400, 400),
    ]) {
      const sides = chooseSides(origin, target);
      expect(opposite[sides.source]).toBe(sides.target);
    }
  });

  it('weighs the gap against the boxes, not in raw pixels', () => {
    /*
     * 300px to the right and 260px down. In raw numbers the two are close, but classes are
     * 224 wide and only 120 tall here, so the vertical gap is much larger relative to the
     * boxes and the vertical sides are the shorter route.
     */
    const short = box(0, 0, 120);
    expect(chooseSides(short, { ...box(300, 260, 120) }).source).toBe('bottom');
  });

  it('is stable for two classes sitting on top of one another', () => {
    const sides = chooseSides(origin, box(0, 0));
    expect(sides.source).toBe('right');
    expect(sides.target).toBe('left');
  });

  it('is symmetric: reversing the pair reverses the sides', () => {
    const a = box(0, 0);
    const b = box(700, 120);
    const forward = chooseSides(a, b);
    const backward = chooseSides(b, a);
    expect(backward.source).toBe(forward.target);
    expect(backward.target).toBe(forward.source);
  });

  it('survives a zero-sized box without dividing by zero', () => {
    const empty: Box = { x: 0, y: 0, width: 0, height: 0 };
    expect(() => chooseSides(empty, empty)).not.toThrow();
    expect(chooseSides(empty, { x: 100, y: 0, width: 0, height: 0 }).source).toBe('right');
  });
});

describe('estimateClassHeight', () => {
  it('grows with each attribute', () => {
    expect(estimateClassHeight(3, false)).toBeGreaterThan(estimateClassHeight(1, false));
    expect(estimateClassHeight(10, false)).toBeGreaterThan(estimateClassHeight(3, false));
  });

  it('allows for the superclass line', () => {
    expect(estimateClassHeight(2, true)).toBeGreaterThan(estimateClassHeight(2, false));
  });

  it('gives an empty class the height of its placeholder, not zero', () => {
    expect(estimateClassHeight(0, false)).toBeGreaterThan(80);
  });
});

describe('handle ids', () => {
  it('match the ids the class node renders', () => {
    expect(sourceHandleId('right')).toBe('source-right');
    expect(targetHandleId('bottom')).toBe('target-bottom');
  });
});
