import { createStore, del, entries, set } from 'idb-keyval';
import type { DocumentFormat, LinkedFileHandle } from './platform';

/**
 * What survives a reload: which file each project is linked to, and what the two last agreed on.
 *
 * In IndexedDB rather than beside the workspace in `localStorage`, because a file handle is not
 * text. IndexedDB can hold the handle itself, which is what lets Chrome's "Allow on every visit"
 * reopen the file without asking again.
 */
export interface StoredLink {
  handle: LinkedFileHandle;
  format: DocumentFormat;
  /** The file's text when this app and the file last agreed. */
  synced: string;
  /** The schema as this app would have written it at that moment. */
  baseline: string;
  /** Saving is held back until the person agrees, because it would lose what the file has. */
  paused: boolean;
}

/** Where links are kept: IndexedDB in the browser, a map in a test. */
export interface LinkStorage {
  all(): Promise<[projectId: string, link: StoredLink][]>;
  put(projectId: string, link: StoredLink): Promise<void>;
  remove(projectId: string): Promise<void>;
}

export function indexedDbStorage(): LinkStorage {
  // Created on first use, so merely importing the module opens no database.
  let store: ReturnType<typeof createStore> | null = null;
  const db = () => (store ??= createStore('ontoschema-file-links', 'links'));
  return {
    all: () => entries<string, StoredLink>(db()),
    put: (projectId, link) => set(projectId, link, db()),
    remove: (projectId) => del(projectId, db()),
  };
}

export function memoryStorage(): LinkStorage {
  const links = new Map<string, StoredLink>();
  return {
    all: async () => [...links.entries()],
    put: async (projectId, link) => {
      links.set(projectId, link);
    },
    remove: async (projectId) => {
      links.delete(projectId);
    },
  };
}
