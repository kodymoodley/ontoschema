import { describe, expect, it } from 'vitest';
import { FOCUS_AREA_FRACTION, focusZoom } from './layout';

/**
 * Bringing a class into focus should leave it filling a comfortable share of the canvas —
 * large enough to read every attribute, small enough to keep its surroundings in view.
 */

const CANVAS = { width: 1000, height: 700 };
const LIMITS = { minZoom: 0.2, maxZoom: 4 };

/** What share of the canvas *area* the node ends up covering at a given zoom. */
function areaShare(node: { width: number; height: number }, zoom: number): number {
  return (node.width * zoom * (node.height * zoom)) / (CANVAS.width * CANVAS.height);
}

describe('focusZoom', () => {
  it('lands inside the 30–40% band for a typical class', () => {
    const node = { width: 224, height: 220 };
    const share = areaShare(node, focusZoom({ node, canvas: CANVAS, ...LIMITS }));
    expect(share).toBeGreaterThanOrEqual(0.3);
    expect(share).toBeLessThanOrEqual(0.4);
  });

  it.each([
    ['no attributes', { width: 224, height: 120 }],
    ['a few attributes', { width: 224, height: 220 }],
    ['many attributes', { width: 224, height: 420 }],
    ['a very tall class', { width: 224, height: 800 }],
  ])('lands inside the band for a class with %s', (_label, node) => {
    const share = areaShare(node, focusZoom({ node, canvas: CANVAS, ...LIMITS }));
    expect(share).toBeGreaterThanOrEqual(0.3);
    expect(share).toBeLessThanOrEqual(0.4);
  });

  it.each([
    ['a laptop', { width: 900, height: 620 }],
    ['a wide monitor', { width: 1800, height: 900 }],
    ['a narrow drawer layout', { width: 700, height: 700 }],
    ['a short window', { width: 1200, height: 380 }],
  ])('lands inside the band on %s', (_label, canvas) => {
    const node = { width: 224, height: 220 };
    const zoom = focusZoom({ node, canvas, ...LIMITS });
    const share = (node.width * zoom * (node.height * zoom)) / (canvas.width * canvas.height);
    expect(share).toBeGreaterThanOrEqual(0.3);
    expect(share).toBeLessThanOrEqual(0.4);
  });

  it('aims at the middle of the band rather than an edge of it', () => {
    const node = { width: 224, height: 220 };
    const share = areaShare(node, focusZoom({ node, canvas: CANVAS, ...LIMITS }));
    expect(share).toBeCloseTo(FOCUS_AREA_FRACTION, 5);
  });

  it('scales by area, so a tall class is not zoomed as far as a short one', () => {
    const short = { width: 224, height: 120 };
    const tall = { width: 224, height: 480 };
    expect(focusZoom({ node: short, canvas: CANVAS, ...LIMITS })).toBeGreaterThan(
      focusZoom({ node: tall, canvas: CANVAS, ...LIMITS }),
    );
  });

  it('respects the zoom limits rather than exceeding them', () => {
    // A speck on a huge canvas would need an absurd zoom; the cap wins.
    const speck = { width: 4, height: 4 };
    expect(focusZoom({ node: speck, canvas: CANVAS, ...LIMITS })).toBe(LIMITS.maxZoom);

    // A node larger than the canvas needs to zoom out, but not past the floor.
    const enormous = { width: 40_000, height: 40_000 };
    expect(focusZoom({ node: enormous, canvas: CANVAS, ...LIMITS })).toBe(LIMITS.minZoom);
  });

  it('honours a caller that asks for a different share', () => {
    const node = { width: 224, height: 220 };
    const zoom = focusZoom({ node, canvas: CANVAS, ...LIMITS, areaFraction: 0.1 });
    expect(areaShare(node, zoom)).toBeCloseTo(0.1, 5);
  });

  it('leaves the zoom alone when a size is not yet known', () => {
    // React Flow reports zero until a node has been measured; dividing by that would fling
    // the viewport to infinity.
    expect(focusZoom({ node: { width: 0, height: 0 }, canvas: CANVAS, ...LIMITS })).toBe(1);
    expect(
      focusZoom({ node: { width: 224, height: 220 }, canvas: { width: 0, height: 0 }, ...LIMITS }),
    ).toBe(1);
  });
});
