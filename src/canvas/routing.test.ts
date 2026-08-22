import { describe, expect, it } from 'vitest';
import { detourAround, segmentCrossesRect } from './routing';
import type { Rect } from './routing';

/**
 * Geometry, tested as geometry: given a line and a box, does it pass through, and if so which
 * way should the line go round. Nothing here knows what a class is.
 */

const box = (x: number, y: number, width = 100, height = 40): Rect => ({ x, y, width, height });

describe('does a line pass through a box', () => {
  const target = box(100, 100);

  it.each([
    ['straight through the middle', { x: 0, y: 120 }, { x: 300, y: 120 }],
    ['down through it, top to bottom', { x: 150, y: 40 }, { x: 150, y: 200 }],
    ['diagonally corner to corner', { x: 90, y: 90 }, { x: 210, y: 150 }],
    ['starting inside it', { x: 150, y: 120 }, { x: 400, y: 400 }],
  ])('%s: yes', (_name, from, to) => {
    expect(segmentCrossesRect(from, to, target)).toBe(true);
  });

  it.each([
    ['well above', { x: 0, y: 10 }, { x: 300, y: 10 }],
    ['well below', { x: 0, y: 300 }, { x: 300, y: 300 }],
    ['to the left', { x: 0, y: 0 }, { x: 0, y: 300 }],
    ['stopping short of it', { x: 0, y: 120 }, { x: 90, y: 120 }],
    // The bounding boxes overlap, so this is the case the cheap first test cannot answer.
    ['past the corner, boxes overlapping', { x: 0, y: 0 }, { x: 95, y: 300 }],
  ])('%s: no', (_name, from, to) => {
    expect(segmentCrossesRect(from, to, target)).toBe(false);
  });
});

describe('choosing a way round', () => {
  it('leaves a clear line alone', () => {
    expect(detourAround({ x: 0, y: 0 }, { x: 300, y: 0 }, [box(100, 100)])).toBeNull();
  });

  it('has nothing to avoid when there are no obstacles', () => {
    expect(detourAround({ x: 0, y: 0 }, { x: 300, y: 300 }, [])).toBeNull();
  });

  it('goes over the top when the line runs nearer the top', () => {
    const detour = detourAround({ x: 0, y: 105 }, { x: 300, y: 105 }, [box(100, 100)]);
    expect(detour!.y).toBeLessThan(100);
  });

  it('goes under when the line runs nearer the bottom', () => {
    const detour = detourAround({ x: 0, y: 135 }, { x: 300, y: 135 }, [box(100, 100)]);
    expect(detour!.y).toBeGreaterThan(140);
  });

  /*
   * One detour past the whole run, not one per box. Weaving between three obstacles in a row
   * would be a more accurate path and a less readable one.
   */
  it('clears every obstacle at once rather than weaving between them', () => {
    // Three boxes the line runs through, at different heights and depths.
    const obstacles = [box(100, 100), box(250, 110), box(400, 80, 100, 60)];
    const detour = detourAround({ x: 0, y: 120 }, { x: 600, y: 120 }, obstacles);

    // One bend, past the deepest of them, rather than a weave between the three.
    const lowest = Math.max(...obstacles.map((rect) => rect.y + rect.height));
    expect(detour!.y).toBeGreaterThan(lowest);
  });

  it('routes past a box it only clips, not only ones it runs through', () => {
    const detour = detourAround({ x: 0, y: 100 }, { x: 300, y: 140 }, [box(140, 100)]);
    expect(detour).not.toBeNull();
  });

  it('puts the bend halfway along, where the line has furthest to give', () => {
    const detour = detourAround({ x: 0, y: 120 }, { x: 400, y: 120 }, [box(100, 100)]);
    expect(detour!.x).toBe(200);
  });
});
