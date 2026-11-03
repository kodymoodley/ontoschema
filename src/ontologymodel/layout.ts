import type { Position } from './types';

/**
 * Where a class sits, written as the value of its `ontoschema:position` annotation: `"40,120"`.
 *
 * Coordinates are rounded to whole pixels. Dragging produces fractions no one can see, and
 * they would otherwise rewrite the line on every touch of the canvas.
 */
export function encodePosition(position: Position): string {
  return `${Math.round(position.x)},${Math.round(position.y)}`;
}

/** Two finite numbers either side of a comma, with optional spaces around each. */
const POSITION = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

/**
 * Reads a position back, or `null` when the value is not one.
 *
 * Forgiving on purpose: a schema in git gets edited by hand and resolved through merge
 * conflicts, and a position is the least important thing in the document. Anything unreadable
 * leaves the class to be placed the way a new one is, rather than failing the import.
 */
export function decodePosition(value: string): Position | null {
  const match = POSITION.exec(value);
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

/** Positions keyed by the IRI of the class they belong to. */
export type Layout = Map<string, Position>;

/**
 * Reads the layout annotation files were saved with before each class carried its own position:
 * one JSON object on the ontology, from class IRI to `[x, y]`. Only ever read, never written.
 *
 * As forgiving as `decodePosition`, for the same reason: anything unreadable yields no positions
 * rather than a failed import.
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
