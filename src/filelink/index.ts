import { useStore } from 'zustand';
import { useProjectStore } from '../projectstore';
import { DOCUMENT_OPTIONS, readOntology, serialize } from '../serialization';
import { createFileLinks } from './engine';
import type { LinkStatus } from './engine';
import { watchWithObserver } from './platform';
import { indexedDbStorage } from './storage';

/**
 * A schema linked to the file it came from, kept up to date as it is edited, so a schema in a
 * git repository can be opened here, edited, and committed with no download in between.
 *
 * The only module that knows files on disk exist, the way `projectstore/persistence` is the only
 * one that knows about `localStorage`. A desktop shell, if one is ever built, replaces this.
 */

export { canLinkFiles, pickFileToOpen, pickFileToSave, writableFormat } from './platform';
export type { DocumentFormat, LinkedFileHandle, PickedFile } from './platform';
export type { LinkStatus } from './engine';

export const fileLinks = createFileLinks({
  projects: useProjectStore,
  storage: indexedDbStorage(),
  watch: watchWithObserver,
  write: (ontology, format) => serialize(ontology, format, 'schema', DOCUMENT_OPTIONS).content,
  read: async (text, format) =>
    (await readOntology(text, format === 'turtle' ? 'turtle' : 'rdfxml')).ontology,
});

let started = false;

/**
 * Picks up the links from before a reload and starts following the files. Once per page,
 * however often it is called.
 */
export function startFileLinks(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  void fileLinks.restore();

  // Where `FileSystemObserver` is missing, coming back to the tab is when a `git pull` made in
  // a terminal shows up.
  window.addEventListener('focus', () => void fileLinks.checkAll());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void fileLinks.checkAll();
    else fileLinks.flushAll();
  });
  window.addEventListener('pagehide', () => fileLinks.flushAll());
}

/** Where the given project's file stands, or `undefined` when it is not linked to one. */
export function useFileLink(projectId: string | undefined): LinkStatus | undefined {
  return useStore(fileLinks.statuses, (statuses) =>
    projectId === undefined ? undefined : statuses[projectId],
  );
}
