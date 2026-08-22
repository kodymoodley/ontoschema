/**
 * Framing the whole drawing, asked for from outside the canvas.
 *
 * Double-clicking bare canvas already does this, and the taxonomy view does it for itself
 * whenever the hierarchy changes shape. The toolbar needs the same thing on a button, and the
 * toolbar is rendered outside React Flow's provider — it cannot call `fitView` itself.
 *
 * The same shape as `viewcentre`, and for the same reason: whichever canvas is mounted
 * registers the way to do it, and nothing is registered when neither is.
 */

type FrameAll = () => void;

const nothingMounted: FrameAll = () => {};
let frame: FrameAll = nothingMounted;

/** Registers the live canvas. Returns the function to call when it unmounts. */
export function provideFraming(fit: FrameAll): () => void {
  frame = fit;
  return () => {
    // Only if it is still ours: a remount can register the new canvas before the old one
    // tidies up, and clearing unconditionally would leave nothing registered while one shows.
    if (frame === fit) frame = nothingMounted;
  };
}

/** Frames everything on the canvas that is showing. Does nothing if none is. */
export function frameAll(): void {
  frame();
}
