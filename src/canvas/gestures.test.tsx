import { describe, expect, it } from 'vitest';
import { OWNS_DOUBLE_CLICK } from './gestures';

/**
 * Which parts of the canvas answer a double-click themselves, asserted against real elements
 * rather than by reading the selector.
 *
 * This was an end-to-end test once: zoom in, project a point onto a rendered edge, click it,
 * check the view moved. It tested the arithmetic of the projection more than the decision,
 * and it failed on whichever engine put the sampled point a few pixels outside the canvas.
 * The decision is a selector, and a selector is best asked directly.
 */

/** Builds `<div class="react-flow"><div class=outer><div class=inner/></div></div>`. */
function nested(...classes: string[]): Element {
  const root = document.createElement('div');
  root.className = 'react-flow';
  let deepest = root;
  for (const className of classes) {
    const child = document.createElement('div');
    child.className = className;
    deepest.append(child);
    deepest = child;
  }
  return deepest;
}

const ownsGesture = (...classes: string[]) =>
  nested(...classes).closest(OWNS_DOUBLE_CLICK) !== null;

describe('OWNS_DOUBLE_CLICK', () => {
  it.each([
    ['a class node', ['react-flow__node', 'classNode']],
    ['the label layer over an edge', ['react-flow__edgelabel-renderer', 'relationLabel']],
    ['the zoom controls', ['react-flow__controls', 'react-flow__controls-button']],
    ['the minimap', ['react-flow__minimap']],
    ['any panel', ['react-flow__panel']],
  ])('leaves %s to answer the gesture itself', (_label, classes) => {
    expect(ownsGesture(...classes)).toBe(true);
  });

  it('treats the line of an edge as bare canvas', () => {
    /*
     * Deliberate. React Flow gives an edge an invisible 20px-wide grab stroke, so claiming
     * the line would swallow the gesture across a wide band of what looks like empty canvas.
     * Only the label is a target.
     */
    expect(ownsGesture('react-flow__edge', 'react-flow__edge-path')).toBe(false);
  });

  it('treats the pane and the background as bare canvas', () => {
    expect(ownsGesture('react-flow__pane')).toBe(false);
    expect(ownsGesture('react-flow__background')).toBe(false);
  });
});
