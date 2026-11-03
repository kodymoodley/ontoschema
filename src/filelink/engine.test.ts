import { afterEach, describe, expect, it } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { addClass, createEmptyOntology, createProject } from '../ontologymodel';
import type { Ontology, Project } from '../ontologymodel';
import { createFileLinks } from './engine';
import type { FileLinkDeps, FileLinks } from './engine';
import type { LinkedFileHandle } from './platform';
import { memoryStorage } from './storage';
import type { LinkStorage } from './storage';

/* --------------------------------------------------------------------------------- fakes */

/**
 * The schema as text, for these tests: its class names, one per line. Real serialization is
 * tested where it lives; what matters here is only that writing is deterministic and that
 * reading undoes it.
 */
const write = (ontology: Ontology) =>
  ontology.classes.map((entity) => `${entity.localName}\n`).join('');
const read = async (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce(
      (ontology, localName) => addClass(ontology, { localName }).ontology,
      createEmptyOntology(),
    );
const withClasses = (...names: string[]) =>
  names.reduce(
    (ontology, localName) => addClass(ontology, { localName }).ontology,
    createEmptyOntology(),
  );

/** A file held in memory, written whole on `close` the way the browser swaps a file in. */
function memoryFile(name: string, initial: string, permission: PermissionState = 'granted') {
  let contents: string | null = initial;
  let state = permission;
  let writes = 0;
  let failWith: Error | null = null;
  const handle: LinkedFileHandle = {
    name,
    async getFile() {
      if (contents === null) throw new DOMException('gone', 'NotFoundError');
      return new Blob([contents]);
    },
    async createWritable() {
      if (failWith) throw failWith;
      let next = '';
      return {
        async write(data: string) {
          next += data;
        },
        async close() {
          contents = next;
          writes += 1;
        },
      };
    },
    queryPermission: async () => state,
    requestPermission: async () => {
      state = 'granted';
      return state;
    },
  };
  return {
    handle,
    contents: () => contents,
    writes: () => writes,
    /** Something other than this app changed the file: `git pull`, another editor. */
    changeOnDisk: (text: string) => {
      contents = text;
    },
    remove: () => {
      contents = null;
    },
    revokePermission: () => {
      state = 'prompt';
    },
    failWritesWith: (error: Error) => {
      failWith = error;
    },
  };
}

/** Just enough of the project store: the projects, and the action that reloads one. */
function projectStore(projects: Project[]) {
  const reloads: string[] = [];
  const store = createStore<{
    projects: Project[];
    reloadProject: (id: string, ontology: Ontology) => void;
  }>((set) => ({
    projects,
    reloadProject: (id, ontology) => {
      reloads.push(id);
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? { ...p, ontology } : p)),
      }));
    },
  }));
  return {
    api: store as unknown as FileLinkDeps['projects'],
    reloads,
    ontology: (id: string) => store.getState().projects.find((p) => p.id === id)?.ontology,
    edit: (id: string, ontology: Ontology) =>
      store.setState((state) => ({
        projects: state.projects.map((p) => (p.id === id ? { ...p, ontology } : p)),
      })),
    remove: (id: string) =>
      store.setState((state) => ({ projects: state.projects.filter((p) => p.id !== id) })),
  };
}

/** A watcher the test fires by hand, standing in for `FileSystemObserver`. */
function manualWatch() {
  const listeners = new Set<() => void>();
  return {
    watch: ((_handle, onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    }) satisfies FileLinkDeps['watch'],
    fire: () => listeners.forEach((listener) => listener()),
    count: () => listeners.size,
  };
}

/* --------------------------------------------------------------------------------- set-up */

let links: FileLinks | null = null;

afterEach(() => {
  links?.dispose();
  links = null;
});

function setUp(options: { storage?: LinkStorage; ontology?: Ontology } = {}) {
  const project = {
    ...createProject('Insurance'),
    ontology: options.ontology ?? withClasses('Car'),
  };
  const projects = projectStore([project]);
  const watcher = manualWatch();
  const storage = options.storage ?? memoryStorage();
  links = createFileLinks({
    projects: projects.api,
    storage,
    watch: watcher.watch,
    write,
    read,
    // Every edit flushes at once, so a test can await the write rather than a clock.
    delayMs: 0,
    maxDelayMs: 0,
  });
  return { links, id: project.id, projects, watcher, storage };
}

/** Waits for every file operation already queued for the project to finish. */
const settled = (links: FileLinks, id: string) => links.check(id);
const statusOf = (links: FileLinks, id: string) => links.statuses.getState()[id];

/* ---------------------------------------------------------------------------------- tests */

describe('linking a schema to its file', () => {
  it('writes nothing just for linking, so git sees no change', async () => {
    const { links, id } = setUp();
    const file = memoryFile('insurance.ttl', 'Car\n');

    await links.link(id, file.handle, { text: 'Car\n', format: 'turtle', paused: false });
    await settled(links, id);

    expect(file.writes()).toBe(0);
    expect(statusOf(links, id)).toEqual({ kind: 'saved', file: 'insurance.ttl' });
  });

  it('writes an edit to the file', async () => {
    const { links, id, projects } = setUp();
    const file = memoryFile('insurance.ttl', 'Car\n');
    await links.link(id, file.handle, { text: 'Car\n', format: 'turtle', paused: false });

    projects.edit(id, withClasses('Car', 'Policy'));
    await settled(links, id);

    expect(file.contents()).toBe('Car\nPolicy\n');
    expect(statusOf(links, id)?.kind).toBe('saved');
  });

  /*
   * A file written by another tool, or by hand, is laid out differently from the way this app
   * would write the same schema. Being opened is not a reason to rewrite it.
   */
  it('leaves a file in another layout alone until something is edited', async () => {
    const { links, id } = setUp();
    const file = memoryFile('insurance.ttl', '  Car  ');
    await links.link(id, file.handle, { text: '  Car  ', format: 'turtle', paused: false });

    await links.saveNow(id);
    file.changeOnDisk('  Car  ');
    await links.checkAll();

    expect(file.writes()).toBe(0);
    expect(file.contents()).toBe('  Car  ');
  });
});

describe('following the file on disk', () => {
  it('reads the file back when something else changed it', async () => {
    const { links, id, projects, watcher } = setUp();
    const file = memoryFile('insurance.ttl', 'Car\n');
    await links.link(id, file.handle, { text: 'Car\n', format: 'turtle', paused: false });

    file.changeOnDisk('Car\nClaim\n');
    watcher.fire();
    await settled(links, id);

    expect(projects.ontology(id)?.classes.map((entity) => entity.localName)).toEqual([
      'Car',
      'Claim',
    ]);
    expect(file.writes()).toBe(0);
  });

  it('does not write back what it has just read', async () => {
    const { links, id, watcher } = setUp();
    const file = memoryFile('insurance.ttl', 'Car\n');
    await links.link(id, file.handle, { text: 'Car\n', format: 'turtle', paused: false });

    file.changeOnDisk('Car\nClaim\n');
    watcher.fire();
    await settled(links, id);
    await settled(links, id);

    expect(file.writes()).toBe(0);
  });

  it('asks rather than choose when both the schema and the file changed', async () => {
    const { links, id, projects } = setUp();
    const file = memoryFile('insurance.ttl', 'Car\n');
    await links.link(id, file.handle, { text: 'Car\n', format: 'turtle', paused: false });

    file.changeOnDisk('Car\nClaim\n');
    projects.edit(id, withClasses('Car', 'Policy'));
    await settled(links, id);

    expect(statusOf(links, id)).toEqual({ kind: 'conflict', file: 'insurance.ttl' });
    expect(file.contents()).toBe('Car\nClaim\n');
  });

  it('writes over the file when told to keep the edits', async () => {
    const { links, id, projects } = setUp();
    const file = memoryFile('insurance.ttl', 'Car\n');
    await links.link(id, file.handle, { text: 'Car\n', format: 'turtle', paused: false });
    file.changeOnDisk('Car\nClaim\n');
    projects.edit(id, withClasses('Car', 'Policy'));
    await settled(links, id);

    await links.keepMine(id);

    expect(file.contents()).toBe('Car\nPolicy\n');
    expect(statusOf(links, id)?.kind).toBe('saved');
  });

  it('reads the file and drops the edits when told to take the file', async () => {
    const { links, id, projects } = setUp();
    const file = memoryFile('insurance.ttl', 'Car\n');
    await links.link(id, file.handle, { text: 'Car\n', format: 'turtle', paused: false });
    file.changeOnDisk('Car\nClaim\n');
    projects.edit(id, withClasses('Car', 'Policy'));
    await settled(links, id);

    await links.takeFile(id);

    expect(projects.ontology(id)?.classes.map((entity) => entity.localName)).toEqual([
      'Car',
      'Claim',
    ]);
    expect(file.contents()).toBe('Car\nClaim\n');
  });

  it('says so when the file has gone, and writes nothing', async () => {
    const { links, id, projects } = setUp();
    const file = memoryFile('insurance.ttl', 'Car\n');
    await links.link(id, file.handle, { text: 'Car\n', format: 'turtle', paused: false });

    file.remove();
    projects.edit(id, withClasses('Car', 'Policy'));
    await settled(links, id);

    expect(statusOf(links, id)).toEqual({ kind: 'missing', file: 'insurance.ttl' });
  });
});

describe('a file this app cannot represent in full', () => {
  it('saves nothing into it until the person agrees', async () => {
    const { links, id, projects } = setUp();
    const file = memoryFile('foreign.ttl', 'Car\n');
    await links.link(id, file.handle, { text: 'Car\n', format: 'turtle', paused: true });

    projects.edit(id, withClasses('Car', 'Policy'));
    await settled(links, id);

    expect(file.writes()).toBe(0);
    expect(statusOf(links, id)).toEqual({ kind: 'paused', file: 'foreign.ttl' });
  });

  it('writes the edits waiting once the person agrees', async () => {
    const { links, id, projects } = setUp();
    const file = memoryFile('foreign.ttl', 'Car\n');
    await links.link(id, file.handle, { text: 'Car\n', format: 'turtle', paused: true });
    projects.edit(id, withClasses('Car', 'Policy'));
    await settled(links, id);

    await links.resume(id);

    expect(file.contents()).toBe('Car\nPolicy\n');
  });
});

describe('permission', () => {
  it('asks to reconnect rather than fail when the browser withdrew access', async () => {
    const { links, id, projects } = setUp();
    const file = memoryFile('insurance.ttl', 'Car\n');
    await links.link(id, file.handle, { text: 'Car\n', format: 'turtle', paused: false });

    file.revokePermission();
    projects.edit(id, withClasses('Car', 'Policy'));
    await settled(links, id);

    expect(statusOf(links, id)).toEqual({ kind: 'permission', file: 'insurance.ttl' });
    expect(file.writes()).toBe(0);
  });

  it('writes what was waiting once access is given again', async () => {
    const { links, id, projects } = setUp();
    const file = memoryFile('insurance.ttl', 'Car\n');
    await links.link(id, file.handle, { text: 'Car\n', format: 'turtle', paused: false });
    file.revokePermission();
    projects.edit(id, withClasses('Car', 'Policy'));
    await settled(links, id);

    await links.reconnect(id);

    expect(file.contents()).toBe('Car\nPolicy\n');
  });
});

describe('after a reload', () => {
  it('picks the link up again and reads a change made while the tab was closed', async () => {
    const storage = memoryStorage();
    const first = setUp({ storage });
    const file = memoryFile('insurance.ttl', 'Car\n');
    await first.links.link(first.id, file.handle, {
      text: 'Car\n',
      format: 'turtle',
      paused: false,
    });
    const [[, stored] = []] = await storage.all();
    first.links.dispose();

    // A new page, with the same project restored from the browser copy and the same storage.
    file.changeOnDisk('Car\nClaim\n');
    const project = { ...createProject('Insurance'), id: first.id, ontology: withClasses('Car') };
    const projects = projectStore([project]);
    links = createFileLinks({
      projects: projects.api,
      storage,
      watch: manualWatch().watch,
      write,
      read,
      delayMs: 0,
      maxDelayMs: 0,
    });
    await links.restore();

    expect(stored?.handle).toBe(file.handle);
    expect(projects.ontology(first.id)?.classes.map((entity) => entity.localName)).toEqual([
      'Car',
      'Claim',
    ]);
  });

  it('asks to reconnect when the browser wants asking again', async () => {
    const storage = memoryStorage();
    const { id } = setUp({ storage });
    const file = memoryFile('insurance.ttl', 'Car\n', 'prompt');
    await storage.put(id, {
      handle: file.handle,
      format: 'turtle',
      synced: 'Car\n',
      baseline: 'Car\n',
      paused: false,
    });

    await links?.restore();

    expect(links && statusOf(links, id)).toEqual({ kind: 'permission', file: 'insurance.ttl' });
  });

  it('forgets a link whose project no longer exists', async () => {
    const storage = memoryStorage();
    const { links } = setUp({ storage });
    const file = memoryFile('gone.ttl', 'Car\n');
    await storage.put('deleted-project', {
      handle: file.handle,
      format: 'turtle',
      synced: 'Car\n',
      baseline: 'Car\n',
      paused: false,
    });

    await links.restore();

    expect(await storage.all()).toEqual([]);
  });
});

describe('ending a link', () => {
  it('unlinks a project when it is deleted, and stops watching its file', async () => {
    const { links, id, projects, watcher, storage } = setUp();
    const file = memoryFile('insurance.ttl', 'Car\n');
    await links.link(id, file.handle, { text: 'Car\n', format: 'turtle', paused: false });

    projects.remove(id);
    await Promise.resolve();

    expect(links.isLinked(id)).toBe(false);
    expect(watcher.count()).toBe(0);
    expect(await storage.all()).toEqual([]);
  });

  it('says why a write failed rather than failing quietly', async () => {
    const { links, id, projects } = setUp();
    const file = memoryFile('insurance.ttl', 'Car\n');
    await links.link(id, file.handle, { text: 'Car\n', format: 'turtle', paused: false });

    file.failWritesWith(new Error('disk full'));
    projects.edit(id, withClasses('Car', 'Policy'));
    await settled(links, id);

    expect(statusOf(links, id)).toEqual({
      kind: 'failed',
      file: 'insurance.ttl',
      reason: 'disk full',
    });
  });
});
