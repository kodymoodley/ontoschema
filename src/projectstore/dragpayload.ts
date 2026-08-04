/**
 * The contract for what can be dragged onto the canvas.
 *
 * Both the drag sources (the palette, the datatype property pool) and the drop target (the
 * canvas) must agree on this, but they live in sibling UI modules that are not allowed to
 * import one another. It therefore sits in the app-state layer, which is the explicit
 * shared layer both sides already depend on.
 */

export const DRAG_MIME = 'application/x-ontoschema-drag';

export type DragPayload =
  /** A new class, dropped anywhere on the canvas. */
  | { kind: 'newClass' }
  /** A new datatype property; only meaningful when dropped onto a class. */
  | { kind: 'newAttribute' }
  /** An existing datatype property from the pool, reused on the class it lands on. */
  | { kind: 'existingAttribute'; propertyId: string };

export function encodeDragPayload(payload: DragPayload): string {
  return JSON.stringify(payload);
}

export function decodeDragPayload(raw: string): DragPayload | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as { kind?: unknown; propertyId?: unknown };
    if (candidate.kind === 'newClass' || candidate.kind === 'newAttribute') {
      return { kind: candidate.kind };
    }
    if (candidate.kind === 'existingAttribute' && typeof candidate.propertyId === 'string') {
      return { kind: 'existingAttribute', propertyId: candidate.propertyId };
    }
    return null;
  } catch {
    return null;
  }
}
