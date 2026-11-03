import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { createSaveQueue } from '../projectstore';
import type { ProjectStoreState, SaveQueue } from '../projectstore';
import type { Ontology } from '../ontologymodel';
import { reconcile } from './reconcile';
import type { Reconciliation } from './reconcile';
import type { DocumentFormat, LinkedFileHandle, Unwatch, Watch } from './platform';
import type { LinkStorage, StoredLink } from './storage';

/**
 * Keeps each linked schema and its file in step: writes edits to the file, reads the file back
 * when something else changed it, and says which of those is happening.
 *
 * Built from injected parts, so the whole of it runs in a test against in-memory files: the
 * project store, somewhere to keep links, a way to watch a file, and the serializer both ways.
 */

/** Where a linked schema stands, for the header to say. */
export type LinkStatus =
  | { kind: 'saved'; file: string }
  | { kind: 'saving'; file: string }
  /** Saving would lose what the file has that this app does not model, so it waits for a yes. */
  | { kind: 'paused'; file: string }
  /** The browser needs asking again, as it does after a reload without "Allow on every visit". */
  | { kind: 'permission'; file: string }
  /** The file and the schema both changed, differently. */
  | { kind: 'conflict'; file: string }
  | { kind: 'missing'; file: string }
  | { kind: 'failed'; file: string; reason: string };

export interface FileLinkDeps {
  projects: Pick<StoreApi<ProjectStoreState>, 'getState' | 'subscribe'>;
  storage: LinkStorage;
  watch: Watch;
  /** The schema as text, exactly as a saved file holds it. */
  write: (ontology: Ontology, format: DocumentFormat) => string;
  /** Text back into a schema. */
  read: (text: string, format: DocumentFormat) => Promise<Ontology>;
  delayMs?: number;
  maxDelayMs?: number;
}

interface Link extends StoredLink {
  queue: SaveQueue<Ontology>;
  unwatch: Unwatch;
  /** Every file operation for this project, one after another, so two never overlap. */
  busy: Promise<void>;
}

export type FileLinks = ReturnType<typeof createFileLinks>;

export function createFileLinks(deps: FileLinkDeps) {
  const statuses = createStore<Record<string, LinkStatus>>(() => ({}));
  const links = new Map<string, Link>();
  let restoring: Promise<void> | null = null;

  const setStatus = (projectId: string, status: LinkStatus | null) =>
    statuses.setState((current) => {
      const next = { ...current };
      if (status) next[projectId] = status;
      else delete next[projectId];
      return next;
    }, true);

  const ontologyOf = (projectId: string) =>
    deps.projects.getState().projects.find((project) => project.id === projectId)?.ontology;

  const store = (projectId: string, link: Link) =>
    deps.storage.put(projectId, {
      handle: link.handle,
      format: link.format,
      synced: link.synced,
      baseline: link.baseline,
      paused: link.paused,
    });

  /** Runs one file operation for a project after any already under way. */
  function run(projectId: string, task: (link: Link) => Promise<void>): Promise<void> {
    const link = links.get(projectId);
    if (!link) return Promise.resolve();
    link.busy = link.busy
      .then(() => (links.get(projectId) === link ? task(link) : undefined))
      .catch((error: unknown) => {
        if (links.get(projectId) !== link) return;
        setStatus(projectId, failure(link.handle.name, error));
      });
    return link.busy;
  }

  /** Records that the schema and the file agree, as of these two texts. */
  async function agree(projectId: string, link: Link, synced: string, baseline: string) {
    link.synced = synced;
    link.baseline = baseline;
    await store(projectId, link);
    setStatus(projectId, { kind: 'saved', file: link.handle.name });
  }

  /**
   * Brings one schema and its file into step. `choice` is the person's answer to a conflict, or
   * to whether a file may lose what this app does not model; without one, the rules decide.
   */
  async function settle(projectId: string, link: Link, choice?: 'mine' | 'theirs') {
    const file = link.handle.name;
    const ontology = ontologyOf(projectId);
    if (!ontology) return;
    if (link.paused && choice === undefined) {
      setStatus(projectId, { kind: 'paused', file });
      return;
    }
    if (!(await permitted(link.handle, false))) {
      setStatus(projectId, { kind: 'permission', file });
      return;
    }

    const local = deps.write(ontology, link.format);
    const disk = await readText(link.handle);
    const verdict: Reconciliation =
      disk === null
        ? 'missing'
        : choice === 'mine'
          ? 'write'
          : choice === 'theirs'
            ? 'reload'
            : reconcile({ local, baseline: link.baseline, disk, synced: link.synced });

    switch (verdict) {
      case 'in-sync':
        await agree(projectId, link, disk ?? local, local);
        return;
      case 'write':
        setStatus(projectId, { kind: 'saving', file });
        await writeText(link.handle, local);
        await agree(projectId, link, local, local);
        return;
      case 'reload': {
        const text = disk ?? '';
        const fromDisk = await deps.read(text, link.format);
        // Agreed first, so the store change below is recognised as nothing to write back.
        await agree(projectId, link, text, deps.write(fromDisk, link.format));
        deps.projects.getState().reloadProject(projectId, fromDisk);
        return;
      }
      case 'conflict':
        setStatus(projectId, { kind: 'conflict', file });
        return;
      case 'missing':
        setStatus(projectId, { kind: 'missing', file });
        return;
    }
  }

  function register(projectId: string, stored: StoredLink): Link {
    links.get(projectId)?.unwatch();
    const link: Link = {
      ...stored,
      unwatch: () => {},
      busy: Promise.resolve(),
      queue: createSaveQueue<Ontology>(
        () => void run(projectId, (current) => settle(projectId, current)),
        deps.delayMs,
        deps.maxDelayMs,
      ),
    };
    links.set(projectId, link);
    return link;
  }

  function startWatching(projectId: string, link: Link) {
    link.unwatch();
    link.unwatch = deps.watch(link.handle, () => void check(projectId));
  }

  /** Edits to a linked schema go to its file, after the same pause the browser copy waits for. */
  const unsubscribe = deps.projects.subscribe((state, previous) => {
    for (const [projectId, link] of links) {
      const project = state.projects.find((candidate) => candidate.id === projectId);
      if (!project) {
        void unlink(projectId);
        continue;
      }
      const before = previous.projects.find((candidate) => candidate.id === projectId);
      if (project.ontology !== before?.ontology) link.queue.save(project.ontology);
    }
  });

  /** Looks at the file now: written to, read back, or reported, as the rules say. */
  function check(projectId: string): Promise<void> {
    return run(projectId, (link) => settle(projectId, link));
  }

  async function unlink(projectId: string): Promise<void> {
    const link = links.get(projectId);
    if (!link) return;
    link.unwatch();
    links.delete(projectId);
    setStatus(projectId, null);
    await deps.storage.remove(projectId);
  }

  return {
    /** Where each linked schema stands, for the header. */
    statuses,

    isLinked: (projectId: string) => links.has(projectId),

    /**
     * Links a project to the file it was just opened from or saved to. `text` is what the file
     * holds now. Nothing is written: a file changes only when its schema does.
     */
    async link(
      projectId: string,
      handle: LinkedFileHandle,
      options: { text: string; format: DocumentFormat; paused: boolean },
    ): Promise<void> {
      const ontology = ontologyOf(projectId);
      if (!ontology) return;
      const link = register(projectId, {
        handle,
        format: options.format,
        synced: options.text,
        baseline: deps.write(ontology, options.format),
        paused: options.paused,
      });
      await store(projectId, link);
      startWatching(projectId, link);
      setStatus(projectId, { kind: options.paused ? 'paused' : 'saved', file: handle.name });
    },

    /**
     * Picks up the links that were in place before a reload. A file the browser still lets this
     * app use is checked at once, so a `git pull` made while the tab was closed shows up;
     * otherwise the header asks to reconnect.
     */
    restore(): Promise<void> {
      restoring ??= (async () => {
        for (const [projectId, stored] of await deps.storage.all()) {
          if (!ontologyOf(projectId)) {
            await deps.storage.remove(projectId);
            continue;
          }
          const link = register(projectId, stored);
          if (await permitted(stored.handle, false)) {
            startWatching(projectId, link);
            await check(projectId);
          } else {
            setStatus(projectId, { kind: 'permission', file: stored.handle.name });
          }
        }
      })();
      return restoring;
    },

    /** Asks the browser for access again. Call it from a click: browsers only ask then. */
    async reconnect(projectId: string): Promise<void> {
      const link = links.get(projectId);
      if (!link || !(await permitted(link.handle, true))) return;
      startWatching(projectId, link);
      await check(projectId);
    },

    /** Writes any pending edits now, for `Ctrl`+`S`. */
    saveNow(projectId: string): Promise<void> {
      links.get(projectId)?.queue.flush();
      return check(projectId);
    },

    /** The person agreed to save into a file this app cannot represent in full. */
    resume(projectId: string): Promise<void> {
      return run(projectId, async (link) => {
        link.paused = false;
        await store(projectId, link);
        await settle(projectId, link);
      });
    },

    /** Settles a conflict by writing the schema over the file. */
    keepMine: (projectId: string) => run(projectId, (link) => settle(projectId, link, 'mine')),

    /** Settles a conflict by reading the file and dropping the edits made here. */
    takeFile: (projectId: string) => run(projectId, (link) => settle(projectId, link, 'theirs')),

    check,

    /** Checks every linked file, for when the tab comes back into view. */
    checkAll: () => Promise.all([...links.keys()].map(check)).then(() => {}),

    /** Starts every pending write now, for when the page is going away. */
    flushAll: () => {
      for (const link of links.values()) link.queue.flush();
    },

    unlink,

    dispose() {
      unsubscribe();
      for (const link of links.values()) link.unwatch();
      links.clear();
    },
  };
}

/** Whether the browser lets this app write the file, asking only when `ask` is set. */
async function permitted(handle: LinkedFileHandle, ask: boolean): Promise<boolean> {
  if (!handle.queryPermission) return true;
  const mode = { mode: 'readwrite' } as const;
  if ((await handle.queryPermission(mode)) === 'granted') return true;
  if (!ask || !handle.requestPermission) return false;
  return (await handle.requestPermission(mode)) === 'granted';
}

/** The file's text, or `null` when it is no longer there. */
async function readText(handle: LinkedFileHandle): Promise<string | null> {
  try {
    return await (await handle.getFile()).text();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return null;
    throw error;
  }
}

/** Replaces the file's contents. The browser writes to the side and swaps the file in whole. */
async function writeText(handle: LinkedFileHandle, text: string): Promise<void> {
  const writer = await handle.createWritable();
  await writer.write(text);
  await writer.close();
}

function failure(file: string, error: unknown): LinkStatus {
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return { kind: 'missing', file };
  }
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return { kind: 'permission', file };
  }
  return { kind: 'failed', file, reason: error instanceof Error ? error.message : String(error) };
}
