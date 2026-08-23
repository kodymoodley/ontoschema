import { useSyncExternalStore } from 'react';

/**
 * A setting that belongs to this browser rather than to any schema: the theme, which side panels
 * are folded, whether RDF terms are shown beside a form field.
 *
 * Stored apart from the workspace and for a different reason. A workspace is a document — opening
 * someone else's file replaces it. A preference is about the person at the keyboard, and opening
 * a file should not rearrange their window or repaint their screen.
 *
 * One implementation because there were three, each with its own key, its own try/catch and its
 * own idea of how a component subscribes. The next preference will copy whichever file its author
 * opened first, so there needs to be only one to copy.
 *
 * Read through `useSyncExternalStore` rather than `useState`, which is what lets two panels show
 * the same switch: the value lives here, not in whichever component mounted first.
 */

export interface Preference<T> {
  /** Subscribes a component. Re-renders every reader when the value changes. */
  use: () => T;
  get: () => T;
  set: (value: T) => void;
}

export function createPreference<T>(
  key: string,
  decode: (stored: string) => T | undefined,
  encode: (value: T) => string,
  fallback: () => T,
): Preference<T> {
  const read = (): T => {
    try {
      const stored = globalThis.localStorage?.getItem(key);
      // Private-browsing modes throw on access rather than returning null, hence the catch.
      if (stored !== null && stored !== undefined) {
        const decoded = decode(stored);
        if (decoded !== undefined) return decoded;
      }
    } catch {
      // Unreadable or hand-edited storage is not a reason to refuse to render.
    }
    return fallback();
  };

  let value = read();
  const listeners = new Set<() => void>();

  const set = (next: T) => {
    value = next;
    try {
      globalThis.localStorage?.setItem(key, encode(next));
    } catch {
      // Quota or a private window: the setting still holds for this session.
    }
    for (const listener of listeners) listener();
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return {
    use: () =>
      useSyncExternalStore(
        subscribe,
        () => value,
        // Only reached if this is ever rendered outside a browser.
        () => fallback(),
      ),
    get: () => value,
    set,
  };
}
