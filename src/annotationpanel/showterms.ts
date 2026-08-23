import { useSyncExternalStore } from 'react';

/**
 * Whether the RDF term behind each named field is shown beside its label.
 *
 * Off by default, which is the point of the named fields: someone filling in a title should not
 * have to meet `dcterms:title` to do it. On, every field says which term it writes — so the
 * vocabulary is one switch away rather than hidden, and an expert can confirm what a form is
 * about to put in their file.
 *
 * Shared rather than per-panel. The schema's metadata and an entity's details are two surfaces
 * showing the same kind of thing, and a switch that had to be found twice would read as two
 * different settings. Kept beside the theme in local storage, for the same reason: it is about
 * this person, not about any schema.
 */

const STORAGE_KEY = 'ontoschema.showTerms';

function stored(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === 'true';
  } catch {
    // Unreadable storage is not a reason to refuse to render a form.
    return false;
  }
}

let showing = stored();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function toggleShowTerms(): void {
  showing = !showing;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, String(showing));
  } catch {
    // The switch still works for this session.
  }
  for (const listener of listeners) listener();
}

export function useShowTerms(): boolean {
  // The server snapshot is only reached if this is ever rendered outside a browser.
  return useSyncExternalStore(
    subscribe,
    () => showing,
    () => false,
  );
}
