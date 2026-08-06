import { useCallback, useEffect, useRef } from 'react';

/**
 * Recognising a double-tap, because the browsers do not agree that they should.
 *
 * A double-click is synthesised from two taps only when nothing along the way has interfered
 * with the touch events. Anything draggable does interfere, so on a touch device a gesture that
 * works with a mouse can silently do nothing. Measured on a class node: Chromium synthesises the
 * double-click, Firefox and WebKit do not.
 *
 * The listeners are attached in the capture phase, and directly rather than through React,
 * because the drag layer also stops the events propagating — a React handler further up never
 * runs, and capture is what gets in ahead of it.
 *
 * The tolerances are the platform double-tap interval and a fingertip's worth of drift.
 */

export const DOUBLE_TAP_MS = 320;
export const TAP_SLOP_PX = 24;

interface Tap {
  x: number;
  y: number;
  at: number;
}

const apart = (touch: { clientX: number; clientY: number }, from: Tap) =>
  Math.hypot(touch.clientX - from.x, touch.clientY - from.y);

/**
 * Returns touch handlers that call `onDoubleTap` on the second of two taps in the same spot.
 *
 * A tap that moved, or one finger of several, cancels rather than counting: those are a drag or
 * a pinch, and neither should be read as a double-tap.
 */
export function useDoubleTap(onDoubleTap: () => void) {
  const previous = useRef<Tap | null>(null);
  const start = useRef<Tap | null>(null);

  // Held in a ref so the listeners are attached once, not on every render the caller does.
  const fire = useRef(onDoubleTap);
  useEffect(() => {
    fire.current = onDoubleTap;
  }, [onDoubleTap]);

  return useCallback((element: HTMLElement | null) => {
    if (!element) return;

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      start.current =
        event.touches.length === 1 && touch
          ? { x: touch.clientX, y: touch.clientY, at: Date.now() }
          : null;
    };

    const onEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      const from = start.current;
      start.current = null;

      if (!touch || !from || event.touches.length > 0 || apart(touch, from) > TAP_SLOP_PX) {
        previous.current = null;
        return;
      }

      const now = Date.now();
      const second =
        previous.current !== null &&
        now - previous.current.at <= DOUBLE_TAP_MS &&
        apart(touch, previous.current) <= TAP_SLOP_PX;

      previous.current = second ? null : { x: touch.clientX, y: touch.clientY, at: now };
      if (second) fire.current();
    };

    const options = { capture: true, passive: true } as const;
    element.addEventListener('touchstart', onStart, options);
    element.addEventListener('touchend', onEnd, options);
    return () => {
      element.removeEventListener('touchstart', onStart, options);
      element.removeEventListener('touchend', onEnd, options);
    };
  }, []);
}
