/**
 * Gesture policy for the canvas: which parts of it answer a double-click themselves, and how
 * forgiving a double-tap is.
 *
 * Kept apart from the canvas component because it is plain data with no React and no
 * stylesheet behind it, which means a test can ask the same question the app asks rather than
 * keeping its own copy of the answer — a copy that drifted once already.
 */

/**
 * A class focuses, a relation label opens for editing, and the overlay widgets have their own
 * buttons. Anywhere else counts as bare canvas, where a double-click frames the whole schema.
 *
 * The edge *line* is deliberately absent. React Flow gives it an invisible 20px-wide grab
 * stroke, so excluding it would silently swallow the gesture over a wide band of what looks
 * like empty canvas.
 */
export const OWNS_DOUBLE_CLICK =
  '.react-flow__node, .react-flow__edgelabel-renderer, .react-flow__controls, .react-flow__minimap, .react-flow__panel';

/** The platform double-tap interval, and a fingertip's worth of drift. */
export const DOUBLE_TAP_MS = 320;
export const TAP_SLOP_PX = 24;

export function tapDistance(
  touch: { clientX: number; clientY: number },
  from: { x: number; y: number },
): number {
  return Math.hypot(touch.clientX - from.x, touch.clientY - from.y);
}
