import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Framing again when the pane changes size right after being framed.
 *
 * Every way of moving the camera here works from the size of the pane at the moment it is asked:
 * zooming to one class, fitting the whole drawing. And several of the gestures that ask for it
 * also change that size. Selecting a class borrows the inspector's column back if it was folded
 * away; deselecting hands it over; the toolbar's control folds both panels and fits in one press.
 * In each case the camera is worked out against a pane a few hundred pixels away from the one the
 * drawing ends up in — a focused class filling 49% of the canvas instead of 35%, or a fitted
 * schema hanging 50px out of the right-hand edge.
 *
 * Correcting from the resize rather than trying to be measured after it. Waiting was tried twice
 * and neither attempt was sound: React flushes pending passive effects before it renders an
 * update made from one, so the DOM has not moved yet when an effect measures; and a timer long
 * enough for the columns to settle in one browser is not long enough in another — Chromium
 * changes the width in a single step, WebKit animates it. A resize observer is told, however
 * late, by whatever caused it.
 *
 * Bounded to the moment after a framing, so dragging the window narrower an hour later does not
 * yank the viewport back to whatever was last framed.
 */

/**
 * A way to move the camera, over the given number of milliseconds. Returning `false` says the
 * move could not be made — the canvas has not measured the node yet — and leaves nothing armed,
 * since there is no framing to correct.
 */
export type Framing = (duration: number) => boolean | void;

/**
 * How long after framing a change of pane size is still treated as part of the same gesture.
 * Long enough to cover a panel folding and its transition, short enough that an unrelated
 * resize later is nobody's business but the person doing the resizing.
 */
const CORRECTION_WINDOW_MS = 600;

/** Short: a nudge to a view already on its way to roughly the right place. */
const CORRECTION_MS = 150;

/**
 * Returns the way to run a framing so that it can be corrected. Give it the framing and how long
 * it should take; it runs it, and re-runs it if the pane resizes in the moment afterwards.
 */
export function useFramingCorrection(surface: RefObject<HTMLElement | null>) {
  const framed = useRef<{ run: Framing; at: number } | null>(null);

  useEffect(() => {
    const element = surface.current;
    if (!element) return;

    const observer = new ResizeObserver(() => {
      const recent = framed.current;
      if (!recent || performance.now() - recent.at > CORRECTION_WINDOW_MS) return;
      recent.run(CORRECTION_MS);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [surface]);

  return useCallback((run: Framing, duration: number) => {
    if (run(duration) === false) return false;
    framed.current = { run, at: performance.now() };
    return true;
  }, []);
}
