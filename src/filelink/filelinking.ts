import type { StoreApi } from 'zustand/vanilla';
import { useProjectStore } from '../projectstore';
import { DOCUMENT_OPTIONS, readOntology, serialize } from '../serialization';
import { createFileLinks } from './engine';
import type { LinkStatus } from './engine';
import { watchWithObserver } from './platform';
import { indexedDbStorage } from './storage';

/**
 * The half of file linking that is loaded only when it is needed: the engine, IndexedDB, and the
 * file pickers. Assembled here from the real parts, against the status store the always-loaded
 * half already shows.
 */

export { pickFileToOpen, pickFileToSave } from './pickers';

export function createRuntime(statuses: StoreApi<Record<string, LinkStatus>>) {
  return createFileLinks({
    projects: useProjectStore,
    storage: indexedDbStorage(),
    watch: watchWithObserver,
    write: (ontology, format) => serialize(ontology, format, 'schema', DOCUMENT_OPTIONS).content,
    read: async (text, format) =>
      (await readOntology(text, format === 'turtle' ? 'turtle' : 'rdfxml')).ontology,
    statuses,
  });
}
