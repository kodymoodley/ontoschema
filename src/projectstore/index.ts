import { useProjectStore, activeOntology } from './store';
import { createEmptyOntology } from '../ontologymodel';
import type { EntityRef, Ontology, Project } from '../ontologymodel';

export { UNTITLED } from './workspace';

export { createPreference } from './preference';
export { toggleShowTerms, useShowTerms } from './showterms';
export type { Preference } from './preference';

export { useProjectStore, activeOntology } from './store';
export type { ProjectStoreState, CanvasView, PendingConnection } from './store';
export type { TaxonomyRelations } from './interactionactions';
export {
  STORAGE_KEY,
  clearWorkspace,
  flushWorkspace,
  loadWorkspace,
  projectFromFile,
  projectToFile,
} from './persistence';
export type { Workspace } from './workspace';
export { DRAG_MIME, encodeDragPayload, decodeDragPayload } from './dragpayload';
export type { DragPayload } from './dragpayload';

/**
 * Read hooks. UI modules subscribe through these rather than reaching into store internals,
 * which keeps the store's shape free to change without touching every panel.
 */

const FALLBACK: Ontology = createEmptyOntology();

export function useOntology(): Ontology {
  return useProjectStore((state) => activeOntology(state) ?? FALLBACK);
}

export function useActiveProject(): Project | undefined {
  return useProjectStore((state) => state.projects.find((p) => p.id === state.activeProjectId));
}

export function useProjects(): Project[] {
  return useProjectStore((state) => state.projects);
}

export function useSelection(): EntityRef | null {
  return useProjectStore((state) => state.selection);
}

export function useTaxonomyRelations() {
  return useProjectStore((state) => state.taxonomyRelations);
}

export function useCanvasView() {
  return useProjectStore((state) => state.view);
}
