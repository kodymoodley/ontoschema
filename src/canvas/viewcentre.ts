/**
 * Where the middle of the schema canvas is, in the coordinates classes are positioned in.
 *
 * The palette's create button lives in the left panel, which is rendered outside both canvases
 * and so outside React Flow's provider. It cannot ask React Flow anything. The canvas can, and
 * it registers a way to read the answer here while it is mounted.
 *
 * A function rather than a stored value, because the centre changes with every pan and zoom and
 * only matters at the instant something is created. Keeping it in the store would mean writing
 * on every frame of a drag to answer a question nobody was asking.
 *
 * Nothing is registered while the taxonomy tab is showing, and `viewCentre` returns null then.
 * Callers fall back to the grid, which is where a new class landed before any of this.
 */

type ReadCentre = () => { x: number; y: number } | null;

const nothingMounted: ReadCentre = () => null;
let read: ReadCentre = nothingMounted;

/** Registers the live canvas. Returns the function to call when it unmounts. */
export function provideViewCentre(reader: ReadCentre): () => void {
  read = reader;
  return () => {
    // Only if it is still ours: a remount can register the new canvas before the old one tidies
    // up, and clearing unconditionally would leave nothing registered while a canvas is showing.
    if (read === reader) read = nothingMounted;
  };
}

export function viewCentre(): { x: number; y: number } | null {
  return read();
}
