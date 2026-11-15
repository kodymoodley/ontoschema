import { useEffect } from 'react';
import type { Node } from '@xyflow/react';
import type { Position } from '../ontologymodel';

/**
 * Classes gliding to new places, asked for from outside the canvas.
 *
 * A shuffle moves every class at once. Jumping there would leave no way to tell what went where;
 * gliding there shows it. The glide moves only what React Flow draws, and the caller commits the
 * new places to the schema once it ends, so the move is one step in the undo history rather than
 * one per frame.
 *
 * The same shape as `framing`, for the same reason: the shuffle is asked for from the toolbar,
 * outside React Flow's provider, and the schema canvas registers how to do it while it is mounted.
 */

type Glide = (to: ReadonlyMap<string, Position>) => Promise<void>;

const nothingMounted: Glide = () => Promise.resolve();
let glide: Glide = nothingMounted;

/** Long enough to follow a class with the eye, short enough not to be waited for. */
const GLIDE_MS = 450;

/** Slow out, quick through the middle, slow in: things that move by themselves start and stop. */
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** Moves the drawn classes to `to`, and resolves once they are there. Does nothing unmounted. */
export function glideClasses(to: ReadonlyMap<string, Position>): Promise<void> {
  return glide(to);
}

/** Registers the schema canvas's nodes as the thing that glides, while the canvas is mounted. */
export function useProvideGlide<N extends Node>(
  setNodes: (update: (nodes: N[]) => N[]) => void,
): void {
  useEffect(() => {
    const run: Glide = (to) =>
      new Promise((resolve) => {
        // Arriving is the point, not the journey; with reduced motion, the caller just moves them.
        if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          resolve();
          return;
        }
        let from: Map<string, Position> | null = null;
        const started = performance.now();
        const step = (now: number) => {
          const progress = Math.min(1, (now - started) / GLIDE_MS);
          const eased = easeInOut(progress);
          setNodes((nodes) => {
            const start = (from ??= new Map(nodes.map((node) => [node.id, node.position])));
            return nodes.map((node) => {
              const a = start.get(node.id);
              const b = to.get(node.id);
              if (!a || !b) return node;
              return {
                ...node,
                position: { x: a.x + (b.x - a.x) * eased, y: a.y + (b.y - a.y) * eased },
              };
            });
          });
          if (progress < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });

    glide = run;
    return () => {
      // Only if it is still ours; see `provideFraming`.
      if (glide === run) glide = nothingMounted;
    };
  }, [setNodes]);
}
