import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { FileLinks, LinkStatus } from './engine';
import type { DocumentFormat, LinkedFileHandle } from './platform';
import type { PickedFile } from './pickers';
import type * as FileLinking from './filelinking';

/**
 * A schema linked to the file it came from, kept up to date as it is edited, so a schema in a
 * git repository can be opened here, edited, and committed with no download in between.
 *
 * The only module that knows files on disk exist, the way `projectstore/persistence` is the only
 * one that knows about `localStorage`. A desktop shell, if one is ever built, replaces this.
 *
 * In two halves. This one is in the bundle everyone downloads, and holds only what the header
 * needs to show: the statuses and whether the browser can link files at all. The engine, the
 * IndexedDB store and the file pickers load the first time a file is opened or saved, or at
 * startup in a browser that has linked one before. Someone who never links a file never
 * downloads them.
 */

export { canLinkFiles, writableFormat } from './platform';
export type { DocumentFormat, LinkedFileHandle } from './platform';
export type { PickedFile } from './pickers';
export type { LinkStatus } from './engine';

const statuses = createStore<Record<string, LinkStatus>>(() => ({}));

/** Set once a file has been linked in this browser, so later visits know to load the engine. */
const LINKED_BEFORE = 'ontoschema.fileLinks.used';

let runtime: Promise<typeof FileLinking> | null = null;
let engine: FileLinks | null = null;

function load() {
  runtime ??= import('./filelinking').then((module) => {
    engine ??= module.createRuntime(statuses);
    return module;
  });
  return runtime;
}

const loaded = async (): Promise<FileLinks> => {
  await load();
  if (!engine) throw new Error('the file link engine did not start');
  return engine;
};

function remember(): void {
  try {
    globalThis.localStorage?.setItem(LINKED_BEFORE, '1');
  } catch {
    // Private browsing: links still work this session, and are picked up again only if stored.
  }
}

function linkedBefore(): boolean {
  try {
    return globalThis.localStorage?.getItem(LINKED_BEFORE) === '1';
  } catch {
    return false;
  }
}

/**
 * Every operation on linked files. Each one that needs the engine loads it first; the ones that
 * only matter once something is linked do nothing until then.
 */
export const fileLinks = {
  /** Where each linked schema stands, for the header. */
  statuses,

  isLinked: (projectId: string) => engine?.isLinked(projectId) ?? false,

  async link(
    projectId: string,
    handle: LinkedFileHandle,
    options: { text: string; format: DocumentFormat; paused: boolean },
  ): Promise<void> {
    remember();
    await (await loaded()).link(projectId, handle, options);
  },

  restore: async () => (await loaded()).restore(),
  reconnect: async (projectId: string) => (await loaded()).reconnect(projectId),
  saveNow: async (projectId: string) => engine?.saveNow(projectId),
  resume: async (projectId: string) => engine?.resume(projectId),
  rebase: async (projectId: string) => engine?.rebase(projectId),
  keepMine: async (projectId: string) => engine?.keepMine(projectId),
  takeFile: async (projectId: string) => engine?.takeFile(projectId),
  check: async (projectId: string) => engine?.check(projectId),
  checkAll: async () => engine?.checkAll(),
  flushAll: () => engine?.flushAll(),
  unlink: async (projectId: string) => engine?.unlink(projectId),
};

/**
 * Asks for a schema to open, through the picker that hands back a handle on the file. `null` when
 * the person cancelled.
 */
export const pickFileToOpen = async (): Promise<PickedFile | null> =>
  (await load()).pickFileToOpen();

/**
 * Asks where to save a schema and writes it there: the handle when the browser gave one, `null`
 * when it downloaded the file instead or the person cancelled.
 */
export const pickFileToSave = async (
  content: string,
  file: { name: string; extension: string; mimeType: string },
): Promise<LinkedFileHandle | null> => (await load()).pickFileToSave(content, file);

let started = false;

/**
 * Picks up the links from before a reload and starts following the files. Once per page, however
 * often it is called, and without loading anything in a browser that has never linked a file.
 */
export function startFileLinks(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  if (linkedBefore()) void fileLinks.restore();

  // Where `FileSystemObserver` is missing, coming back to the tab is when a `git pull` made in a
  // terminal shows up.
  window.addEventListener('focus', () => void fileLinks.checkAll());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void fileLinks.checkAll();
    else fileLinks.flushAll();
  });
  window.addEventListener('pagehide', () => fileLinks.flushAll());
}

/** Where the given project's file stands, or `undefined` when it is not linked to one. */
export function useFileLink(projectId: string | undefined): LinkStatus | undefined {
  return useStore(statuses, (all) => (projectId === undefined ? undefined : all[projectId]));
}
