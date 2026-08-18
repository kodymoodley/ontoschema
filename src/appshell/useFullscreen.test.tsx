import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFullscreen } from './useFullscreen';

/**
 * When the control is offered, and what it does.
 *
 * The interesting part is not the toggle but the refusal: on Safari for iOS the Fullscreen API
 * exists and declines for anything that is not a video, and an app started from the home screen
 * has no chrome left to hide. In both cases a button would be drawn and do nothing.
 */

function Probe() {
  const { offered, active, toggle } = useFullscreen();
  return (
    <button type="button" onClick={toggle} data-offered={offered} data-active={active}>
      toggle
    </button>
  );
}

const control = () => screen.getByRole('button', { name: 'toggle' });

/**
 * jsdom implements none of the Fullscreen API — not even the properties — so each capability is
 * defined rather than spied on, and removed again afterwards.
 */
const define = (target: object, property: string, value: unknown) =>
  Object.defineProperty(target, property, { value, configurable: true, writable: true });

function browserWhere(options: {
  fullscreenEnabled: boolean;
  standalone?: boolean;
  displayMode?: boolean;
  fullscreenElement?: Element | null;
}) {
  define(document, 'fullscreenEnabled', options.fullscreenEnabled);
  define(document, 'fullscreenElement', options.fullscreenElement ?? null);
  define(document, 'exitFullscreen', vi.fn().mockResolvedValue(undefined));
  define(document.documentElement, 'requestFullscreen', vi.fn().mockResolvedValue(undefined));
  Object.defineProperty(window.navigator, 'standalone', {
    value: options.standalone ?? undefined,
    configurable: true,
  });
  define(
    window,
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: options.displayMode ?? false,
      media: '(display-mode: standalone)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }),
  );
}

afterEach(() => vi.restoreAllMocks());

describe('whether the control is offered at all', () => {
  it('is offered in a browser that allows it', () => {
    browserWhere({ fullscreenEnabled: true });
    render(<Probe />);
    expect(control()).toHaveAttribute('data-offered', 'true');
  });

  it('is withheld where the browser refuses, as Safari on iOS does', () => {
    browserWhere({ fullscreenEnabled: false });
    render(<Probe />);
    expect(control()).toHaveAttribute('data-offered', 'false');
  });

  it('is withheld when already launched from the home screen', () => {
    browserWhere({ fullscreenEnabled: true, displayMode: true });
    render(<Probe />);
    expect(control()).toHaveAttribute('data-offered', 'false');
  });

  // Safari never implemented the display-mode query and reports this instead.
  it('is withheld for Safari standalone, which has no display-mode query', () => {
    browserWhere({ fullscreenEnabled: true, standalone: true });
    render(<Probe />);
    expect(control()).toHaveAttribute('data-offered', 'false');
  });
});

describe('the toggle', () => {
  it('asks to fill the screen when nothing is filling it', async () => {
    const user = userEvent.setup();
    browserWhere({ fullscreenEnabled: true });
    render(<Probe />);
    await user.click(control());
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledOnce();
  });

  /*
   * A rejected request must not surface. Entering needs a gesture the browser agrees was one, and
   * it is entitled to disagree; an unhandled rejection would reach the error boundary and take
   * down the editor over a button that did not work.
   */
  it('says nothing when the browser refuses the request', async () => {
    const user = userEvent.setup();
    browserWhere({ fullscreenEnabled: true });
    define(
      document.documentElement,
      'requestFullscreen',
      vi.fn().mockRejectedValue(new Error('not allowed')),
    );

    render(<Probe />);
    await expect(user.click(control())).resolves.toBeUndefined();
  });

  it('leaves full screen when something is filling it', async () => {
    const user = userEvent.setup();
    browserWhere({ fullscreenEnabled: true, fullscreenElement: document.documentElement });

    render(<Probe />);
    await user.click(control());
    expect(document.exitFullscreen).toHaveBeenCalledOnce();
  });
});
