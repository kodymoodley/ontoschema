import { createProject } from '../ontologymodel';
import type { Ontology, Project } from '../ontologymodel';
import { EMPTY_HISTORY, redoStep, undoStep } from './history';
import { projectFromFile, projectToFile, saveWorkspace } from './persistence';
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
  /** Opens a ready-made schema as a new project, leaving any existing work alone. */
  openExample(name: string, ontology: Ontology): string;
  switchProject(id: string): void;
  renameProject(id: string, name: string): void;
  deleteProject(id: string): void;
  importProject(fileContent: string): string | null;
  exportProjectFile(id?: string): string | null;
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
      saveWorkspace(workspace);
      return { ...state, ...workspace, selection: null, history: moved.history };
    });
  }

  function openWorkspace(next: { projects: Project[]; activeProjectId: string | null }): void {
    saveWorkspace(next);
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
        saveWorkspace(next);
        return { ...state, ...next, ...freshSession, view: 'schema' };
      });
      return project.id;
    },
    openExample(name, ontology) {
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
    exportProjectFile(id) {
      const state = get();
      const project = state.projects.find(
        (candidate) => candidate.id === (id ?? state.activeProjectId),
      );
      return project ? projectToFile(project) : null;
    },
  };
}
