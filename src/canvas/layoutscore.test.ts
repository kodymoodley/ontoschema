import { describe, expect, it } from 'vitest';
import type { Link } from './layeredlayout';
import { scoreLayout, segmentHitsBox, segmentsCross } from './layoutscore';

/**
 * The number a shuffle is judged on. If it counted wrongly, the shuffle would confidently hand
 * back tangles, so each thing it counts is checked on a drawing small enough to count by eye.
 */

const BOX = { width: 100, height: 50 };

/** Classes at the given top-left corners, all the same size. */
function at(corners: Record<string, [number, number]>) {
  const positions = new Map(Object.entries(corners).map(([id, [x, y]]) => [id, { x, y }]));
  const boxes = new Map(Object.keys(corners).map((id) => [id, BOX]));
  return { positions, boxes };
}

const line = (from: string, to: string, drawn = true): Link => ({ from, to, weight: 4, drawn });

describe('two segments crossing', () => {
  it('sees an X', () => {
    expect(segmentsCross({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(
      true,
    );
  });

  it('does not count parallel lines, lines that stop short, or lines that only touch', () => {
    const origin = { x: 0, y: 0 };
    expect(segmentsCross(origin, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 })).toBe(false);
    expect(segmentsCross(origin, { x: 4, y: 4 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(false);
    expect(segmentsCross(origin, { x: 5, y: 5 }, { x: 5, y: 5 }, { x: 10, y: 0 })).toBe(false);
  });
});

describe('a segment passing through a box', () => {
  const box = { x: 100, y: 100, width: 100, height: 50 };

  it('sees a line straight through, and one that ends inside', () => {
    expect(segmentHitsBox({ x: 0, y: 125 }, { x: 300, y: 125 }, box)).toBe(true);
    expect(segmentHitsBox({ x: 0, y: 125 }, { x: 150, y: 125 }, box)).toBe(true);
  });

  it('lets a line pass by, stop short, or graze an edge', () => {
    expect(segmentHitsBox({ x: 0, y: 0 }, { x: 300, y: 0 }, box)).toBe(false);
    expect(segmentHitsBox({ x: 0, y: 125 }, { x: 90, y: 125 }, box)).toBe(false);
    expect(segmentHitsBox({ x: 0, y: 101 }, { x: 300, y: 101 }, box)).toBe(false);
  });

  it('handles a vertical line, which has no slope to divide by', () => {
    expect(segmentHitsBox({ x: 150, y: 0 }, { x: 150, y: 300 }, box)).toBe(true);
    expect(segmentHitsBox({ x: 50, y: 0 }, { x: 50, y: 300 }, box)).toBe(false);
  });
});

describe('scoring a layout', () => {
  it('counts lines that cross', () => {
    // a-d and b-c cross between the four corners.
    const { positions, boxes } = at({ a: [0, 0], b: [400, 0], c: [0, 400], d: [400, 400] });
    const score = scoreLayout(positions, boxes, [line('a', 'd'), line('b', 'c')]);
    expect(score.crossings).toBe(1);
    expect(score.through).toBe(0);
  });

  it('does not count lines meeting at the class they share', () => {
    const { positions, boxes } = at({ a: [0, 0], b: [400, 0], c: [0, 400] });
    expect(scoreLayout(positions, boxes, [line('a', 'b'), line('a', 'c')]).crossings).toBe(0);
  });

  it('counts a line through a class at neither of its ends, at three crossings', () => {
    const { positions, boxes } = at({ a: [0, 0], b: [200, 0], c: [400, 0] });
    const score = scoreLayout(positions, boxes, [line('a', 'c')]);
    expect(score.through).toBe(1);
    expect(score.value).toBeCloseTo(3 + score.length / 2000);
  });

  it('ignores links the schema view does not draw', () => {
    const { positions, boxes } = at({ a: [0, 0], b: [400, 0], c: [0, 400], d: [400, 400] });
    const score = scoreLayout(positions, boxes, [line('a', 'd', false), line('b', 'c')]);
    expect(score).toEqual({ crossings: 0, through: 0, length: score.length, value: score.value });
    expect(score.length).toBeCloseTo(Math.hypot(400, 400));
  });

  it('ignores links to classes it was not given, so a group can be scored on its own', () => {
    const { positions, boxes } = at({ a: [0, 0], b: [400, 0] });
    expect(scoreLayout(positions, boxes, [line('a', 'elsewhere')]).length).toBe(0);
  });

  it('prefers the shorter of two layouts that are otherwise as tidy', () => {
    const near = at({ a: [0, 0], b: [200, 0] });
    const far = at({ a: [0, 0], b: [800, 0] });
    const links = [line('a', 'b')];
    expect(scoreLayout(near.positions, near.boxes, links).value).toBeLessThan(
      scoreLayout(far.positions, far.boxes, links).value,
    );
  });
});
