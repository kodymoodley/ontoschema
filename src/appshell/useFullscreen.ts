import { useCallback, useEffect, useState } from 'react';

/**
 * Filling the screen, so the browser's own bars stop taking room from the canvas.
 *
 * On a phone the address bar costs roughly 90px of a 844px portrait screen, which is more than
 * any layout change here can win back. This gives it back on the browsers that allow it.
 *
 * `offered` is false, and the button should not be drawn at all, in two cases. Some browsers do
 * not allow it — Safari on iOS supports the Fullscreen API for video and nothing else, and no
 * amount of asking changes that; the route there is Add to Home Screen, which the manifest
 * provides. And an app already running from the home screen has no browser chrome left to hide.
 *
 * A control that is present and does nothing is worse than one that is absent, because the second
 * only fails to help while the first also misleads.
 */

const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  // `standalone` is Safari's own flag and predates the display-mode query it never implemented.
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
};

export interface Fullscreen {
  /** Whether to draw the control at all. */
  offered: boolean;
  active: boolean;
  toggle: () => void;
}

export function useFullscreen(): Fullscreen {
  const [active, setActive] = useState(false);
  const [offered, setOffered] = useState(false);

  useEffect(() => {
    setOffered(document.fullscreenEnabled && !isStandalone());

    // The browser can leave fullscreen without being asked — Escape, a gesture, a permission
    // change — so the state is read from the document rather than assumed from the last click.
    const sync = () => setActive(document.fullscreenElement !== null);
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggle = useCallback(() => {
    /*
     * Both calls reject rather than throw: entering needs a user gesture the browser agrees was
     * one, and leaving fails if something else already left. Neither is worth interrupting
     * anyone over, and the `fullscreenchange` listener above corrects the state either way.
     */
    if (document.fullscreenElement === null) {
      void document.documentElement.requestFullscreen().catch(() => undefined);
      return;
    }
    void document.exitFullscreen().catch(() => undefined);
  }, []);

  return { offered, active, toggle };
}
