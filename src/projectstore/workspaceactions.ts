import { createProject } from '../ontologymodel';
import type { Ontology, Project } from '../ontologymodel';
import { EMPTY_HISTORY, redoStep, undoStep } from './history';
import { projectFromFile, saveWorkspace, workspaceFromFile, workspaceToFile } from './persistence';
import {
  activeProject,
  addProject,
  activateProject,
  removeProject,
  renameProject,
  withRestoredOntology,
  UNTITLED,
} from './workspace';
import type { SetState } from './editing';
import type { ProjectStoreState } from './store';

/**
 * Managing which ontologies exist and which one is open, plus the undo history — which is a
 * property of the current editing session and so is reset whenever the open project changes.
 */

export interface WorkspaceActions {
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;

  newProject(name?: string): string;
  /**
   * Opens a schema as a new project, leaving any existing work alone.
   *
   * Named for what it does rather than where the schema came from: an example from the
   * library and an ontology read out of a file want exactly this, and calling it
   * `openExample` at an import site would be a small lie in the one place clarity is worth
   * most — the seam where a foreign document enters the app.
   */
  openAsNewProject(name: string, ontology: Ontology): string;
  switchProject(id: string): void;
  renameProject(id: string, name: string): void;
  deleteProject(id: string): void;
  /**
   * Opens a project file written before saving became RDF.
   *
   * There is no longer an action that *writes* one: a schema is saved as RDF and a whole
   * workspace as a backup, which covers both jobs between them. Reading stays, because the
   * files people already have must keep opening. `projectToFile` in `persistence` is what
   * makes one, and only the tests for this reader need that.
   */
  importProject(fileContent: string): string | null;

  /** Every project in this browser, as one file. */
  exportWorkspaceFile(): string;
  /**
   * Replaces everything with the contents of a backup, and reports how many projects arrived.
   *
   * Replacing rather than merging, because that is what restoring a backup means: merging
   * would duplicate every project the moment someone restored their own snapshot onto the
   * browser it came from. Destructive, so the caller is expected to have asked first.
   */
  restoreWorkspace(fileContent: string): number | null;
}

export function createWorkspaceActions(
  set: SetState,
  get: () => ProjectStoreState,
): WorkspaceActions {
  /** Everything that must be forgotten when the open project changes underneath the UI. */
  const freshSession = {
    selection: null,
    pendingConnection: null,
    history: EMPTY_HISTORY,
  } as const;

  function travel(step: typeof undoStep): void {
    set((state) => {
      const open = activeProject(state);
      if (!open) return state;
      const moved = step(state.history, open.ontology);
      if (!moved) return state;

      const workspace = withRestoredOntology(state, moved.ontology);
      saveWorkspace(workspace, { immediate: true });
      return { ...state, ...workspace, selection: null, history: moved.history };
    });
  }

  function openWorkspace(next: { projects: Project[]; activeProjectId: string | null }): void {
    saveWorkspace(next, { immediate: true });
    set((state) => ({ ...state, ...next, ...freshSession }));
  }

  return {
    undo() {
      travel(undoStep);
    },
    redo() {
      travel(redoStep);
    },
    canUndo() {
      return get().history.past.length > 0;
    },
    canRedo() {
      return get().history.future.length > 0;
    },

    newProject(name = UNTITLED) {
      const project = createProject(name);
      set((state) => {
        const next = addProject(state, project);
        saveWorkspace(next, { immediate: true });
        return { ...state, ...next, ...freshSession, view: 'schema' };
      });
      return project.id;
    },
    openAsNewProject(name, ontology) {
      const project = { ...createProject(name), ontology };
      openWorkspace(addProject(get(), project));
      return project.id;
    },
    switchProject(id) {
      openWorkspace(activateProject(get(), id));
    },
    renameProject(id, name) {
      set((state) => {
        const next = renameProject(state, id, name);
        if (next === state) return state;
        saveWorkspace(next);
        return { ...state, ...next };
      });
    },
    deleteProject(id) {
      openWorkspace(removeProject(get(), id));
    },
    importProject(fileContent) {
      const imported = projectFromFile(fileContent);
      if (!imported) return null;
      // A fresh id keeps re-importing the same file from overwriting the original.
      const project: Project = { ...imported, id: createProject(imported.name).id };
      openWorkspace(addProject(get(), project));
      return project.id;
    },
    exportWorkspaceFile() {
      const { projects, activeProjectId } = get();
      return workspaceToFile({ projects, activeProjectId });
    },
    restoreWorkspace(fileContent) {
      const restored = workspaceFromFile(fileContent);
      if (!restored) return null;
      openWorkspace(restored);
      return restored.projects.length;
    },
  };
}
