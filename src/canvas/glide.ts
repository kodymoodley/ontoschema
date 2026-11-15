import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Classes gliding to new places, asked for from outside the canvas.
 *
 * A shuffle moves every class at once. Jumping there would leave no way to tell what went where;
 * gliding there shows it.
 *
 * The move is committed at once, as one undo step, and the browser animates each class from where
 * it was drawn to where it now is: a CSS transition on the transform React Flow positions a node
 * with (`.gliding` in `canvas.module.css`). That is one render for the whole move. Moving the
 * nodes frame by frame instead re-rendered every class and line on every frame, about 150 ms each
 * at 200 classes, so the glide stuttered exactly where there is most to follow. The lines cannot
 * be transitioned, so they fade out for the move and back in once the classes have arrived.
 *
 * The same shape as `framing`, for the same reason: the shuffle is asked for from the toolbar,
 * outside React Flow's provider, and the schema canvas registers how to do it while it is mounted.
 */

type Glide = (move: () => void) => Promise<void>;

const nothingMounted: Glide = (move) => {
  move();
  return Promise.resolve();
};
let glide: Glide = nothingMounted;

/** Long enough to follow a class with the eye, short enough not to be waited for. Matches the CSS. */
const GLIDE_MS = 450;

/** Runs `move`, which places the classes, and resolves once they have glided there. */
export function glideClasses(move: () => void): Promise<void> {
  return glide(move);
}

/** Registers the schema canvas as the thing that glides, while it is mounted. */
export function useProvideGlide(surface: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const run: Glide = (move) => {
      const element = surface.current;
      // Arriving is the point, not the journey; with reduced motion, the classes just move.
      if (!element || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        return nothingMounted(move);
      }
      // Set before the move, so the transition is in force when the new positions land.
      element.dataset.gliding = 'true';
      move();
      return new Promise((resolve) => {
        window.setTimeout(() => {
          delete element.dataset.gliding;
          resolve();
        }, GLIDE_MS);
      });
    };

    glide = run;
    return () => {
      // Only if it is still ours; see `provideFraming`.
      if (glide === run) glide = nothingMounted;
    };
  }, [surface]);
}
