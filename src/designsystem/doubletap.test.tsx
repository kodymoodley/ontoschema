import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { DOUBLE_TAP_MS, TAP_SLOP_PX, useDoubleTap } from './doubletap';

/**
 * Recognising a double-tap by hand, which is necessary because the browsers disagree about
 * synthesising one. What matters is the cases that must *not* count: a drag, a pinch, and two
 * taps too far apart in time or space.
 */

function Target({ onDoubleTap }: { onDoubleTap: () => void }) {
  return (
    <button type="button" ref={useDoubleTap(onDoubleTap)}>
      tap me
    </button>
  );
}

/** One finger landing and lifting at a point, as two touch events. */
function tap(element: Element, x: number, y: number, liftAt = { x, y }) {
  fireEvent.touchStart(element, { touches: [{ clientX: x, clientY: y }] });
  fireEvent.touchEnd(element, {
    touches: [],
    changedTouches: [{ clientX: liftAt.x, clientY: liftAt.y }],
  });
}

describe('useDoubleTap', () => {
  it('fires on the second tap in the same spot', () => {
    const onDoubleTap = vi.fn();
    render(<Target onDoubleTap={onDoubleTap} />);
    const target = screen.getByRole('button');

    tap(target, 50, 50);
    expect(onDoubleTap).not.toHaveBeenCalled();

    tap(target, 50, 50);
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
  });

  it('does not fire again on a third tap, so a triple tap is not two gestures', () => {
    const onDoubleTap = vi.fn();
    render(<Target onDoubleTap={onDoubleTap} />);
    const target = screen.getByRole('button');

    tap(target, 50, 50);
    tap(target, 50, 50);
    tap(target, 50, 50);
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
  });

  it('allows a fingertip of drift between the two taps', () => {
    const onDoubleTap = vi.fn();
    render(<Target onDoubleTap={onDoubleTap} />);
    const target = screen.getByRole('button');

    tap(target, 50, 50);
    tap(target, 50 + TAP_SLOP_PX - 4, 50);
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
  });

  it('ignores two taps a long way apart', () => {
    const onDoubleTap = vi.fn();
    render(<Target onDoubleTap={onDoubleTap} />);
    const target = screen.getByRole('button');

    tap(target, 50, 50);
    tap(target, 50 + TAP_SLOP_PX * 3, 50);
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it('ignores a tap that moved, because that is a drag', () => {
    const onDoubleTap = vi.fn();
    render(<Target onDoubleTap={onDoubleTap} />);
    const target = screen.getByRole('button');

    tap(target, 50, 50);
    tap(target, 50, 50, { x: 50 + TAP_SLOP_PX * 3, y: 50 });
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it('ignores a second finger, because that is a pinch', () => {
    const onDoubleTap = vi.fn();
    render(<Target onDoubleTap={onDoubleTap} />);
    const target = screen.getByRole('button');

    tap(target, 50, 50);
    fireEvent.touchStart(target, {
      touches: [
        { clientX: 50, clientY: 50 },
        { clientX: 90, clientY: 90 },
      ],
    });
    fireEvent.touchEnd(target, {
      touches: [{ clientX: 90, clientY: 90 }],
      changedTouches: [{ clientX: 50, clientY: 50 }],
    });
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it('ignores two taps separated by longer than the double-tap window', () => {
    vi.useFakeTimers();
    try {
      const onDoubleTap = vi.fn();
      render(<Target onDoubleTap={onDoubleTap} />);
      const target = screen.getByRole('button');

      tap(target, 50, 50);
      vi.advanceTimersByTime(DOUBLE_TAP_MS + 50);
      tap(target, 50, 50);
      expect(onDoubleTap).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
