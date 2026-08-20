import { entityIri, normalizeNamespaceIri } from './identifier';
import type { Ontology, Position } from './types';

/**
 * Where the classes sit, encoded for the one annotation that carries them.
 *
 * Keyed by entity IRI rather than by the internal id, because internal ids never reach a
 * file and could not be matched against one that was written elsewhere. Renaming a class
 * therefore loses its position, which is the right trade: an IRI is what the document is
 * about, and a class whose position is unknown is placed the way a new one is.
 *
 * Coordinates are rounded to whole pixels. Dragging produces fractions no one can see, and
 * they would otherwise rewrite the line on every touch of the canvas.
 */

/** A position keyed by the IRI it belongs to. */
export type Layout = Map<string, Position>;

export function encodeLayout(ontology: Ontology): string | null {
  const namespace = normalizeNamespaceIri(ontology.iri);
  const entries = ontology.classes
    .map((entity) => [entityIri(namespace, entity.localName), entity.position] as const)
    // Sorted, so that moving one class changes the numbers rather than the order.
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return null;

  const table: Record<string, [number, number]> = {};
  for (const [iri, position] of entries) {
    table[iri] = [Math.round(position.x), Math.round(position.y)];
  }
  return JSON.stringify(table);
}

/**
 * Reads the annotation back.
 *
 * Forgiving on purpose: this value may have come from a file another tool wrote, or edited
 * by hand, and a layout is the least important thing in the document. Anything unreadable
 * yields no positions rather than a failed import.
 */
export function decodeLayout(value: string): Layout {
  const layout: Layout = new Map();
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return layout;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return layout;

  for (const [iri, pair] of Object.entries(parsed as Record<string, unknown>)) {
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    const [x, y] = pair;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    layout.set(iri, { x: x as number, y: y as number });
  }
  return layout;
}
