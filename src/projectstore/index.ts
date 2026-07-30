import { useProjectStore, activeOntology } from './store';
import { createEmptyOntology } from '../ontologymodel';
import type { EntityRef, Ontology, Project } from '../ontologymodel';

export { useProjectStore, activeOntology } from './store';
export type { ProjectStoreState, CanvasView } from './store';
export {
  clearWorkspace,
  emptyWorkspace,
  loadWorkspace,
  projectFromFile,
  projectToFile,
  saveWorkspace,
  reviveWorkspace,
  PROJECT_FILE_VERSION,
} from './persistence';
export type { Workspace } from './persistence';

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

export function useCanvasView() {
  return useProjectStore((state) => state.view);
}
