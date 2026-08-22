import { useEffect, useState } from 'react';

/**
 * The rendered height of an element, kept current as it changes.
 *
 * Written for one job: the side panels open as overlay drawers on a narrow screen, and they have
 * to start below the canvas toolbar rather than below the header, or they cover it. Measured at
 * 320×640 with a class selected, they covered Undo, Redo, Find and the hide-both-panels control
 * — every control on that strip except the two view tabs — and selecting is how you edit, so
 * undo was unreachable exactly while it was wanted.
 *
 * Measured rather than written down as a number. The toolbar is content-sized: it holds a
 * different set of controls in each view, its type scale steps down below 1024px, and it wraps
 * if it must. A constant would be right until the first of those changed and wrong silently
 * afterwards, since the failure is a panel overlapping a button by a few pixels.
 */
export function useMeasuredHeight() {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!element) return;

    // Fires once on observe, so the first height arrives without a separate measurement.
    const observer = new ResizeObserver(() => {
      setHeight(element.getBoundingClientRect().height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  /** `measure` is a callback ref: the element it watches comes and goes with the view. */
  return { measure: setElement, height };
}
