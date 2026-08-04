import { create } from 'zustand';
import {
  addAnnotation,
  addAttributeToClass,
  addClass,
  addObjectProperty,
  addRelationBetween,
  attachProperty,
  createProject,
  deleteClass,
  deleteDatatypeProperty,
  deleteObjectProperty,
  detachUsage,
  moveClass,
  removeAnnotation,
  renameClass,
  renameDatatypeProperty,
  renameObjectProperty,
  setDatatypePropertyRange,
  setOntologyIri,
  setOntologyPrefix,
  setSuperClass,
  setSuperObjectProperty,
  setUsageEndpoints,
  updateAnnotation,
} from '../ontologymodel';
import type { Annotation, EntityRef, Ontology, Position, Project } from '../ontologymodel';
import type { XsdDatatype } from '../annotationvocabulary';
import { loadWorkspace, projectFromFile, projectToFile, saveWorkspace } from './persistence';

/**
 * The app-state layer. It owns *when* the ontology changes; `ontologymodel` owns *how*.
 * Every editing action funnels through `edit`, which is the single place that records
 * undo history, stamps `updatedAt` and persists — so no action can forget to do those.
 */

export type CanvasView = 'schema' | 'taxonomy';

/** A connection the user has drawn but not yet assigned a property to. */
export interface PendingConnection {
  subjectClassId: string;
  objectClassId: string;
}

const HISTORY_LIMIT = 50;

/**
 * How an edit is recorded in the undo history.
 *
 *  - `step`     one undoable entry — the default for a discrete action
 *  - `none`     not undoable on its own; used for continuous gestures such as dragging
 *  - `coalesce` merged into the previous entry when the same target is edited again in
 *               quick succession
 *
 * `coalesce` exists because fields commit as you type, so the canvas stays in step with the
 * keyboard. Recording every keystroke would push 60 entries for a one-sentence definition
 * and silently discard the whole real history past HISTORY_LIMIT.
 */
export type HistoryMode = 'step' | 'none' | 'coalesce';

/** Two edits to the same target closer together than this merge into one undo entry. */
const COALESCE_WINDOW_MS = 700;

interface History {
  past: Ontology[];
  future: Ontology[];
  /** What the last coalescing edit touched, so the next one knows whether to merge. */
  lastCoalesceKey: string | null;
  lastCoalesceAt: number;
}

const EMPTY_HISTORY: History = { past: [], future: [], lastCoalesceKey: null, lastCoalesceAt: 0 };

export interface ProjectStoreState {
  projects: Project[];
  activeProjectId: string | null;
  selection: EntityRef | null;
  view: CanvasView;
  history: History;
  pendingConnection: PendingConnection | null;

  /* classes */
  createClass(options?: { localName?: string; position?: Position }): string;
  renameClassById(id: string, localName: string): void;
  moveClassById(id: string, position: Position): void;
  deleteClassById(id: string): void;
  reparentClass(childId: string, parentId: string | null): void;

  /* datatype properties — always attached to a class */
  createAttributeOn(classId: string, options?: { localName?: string; range?: XsdDatatype }): string;
  renameDatatypePropertyById(id: string, localName: string): void;
  setAttributeRange(id: string, range: XsdDatatype): void;
  deleteDatatypePropertyById(id: string): void;

  /* object properties */
  createObjectProperty(options?: { localName?: string }): string;
  renameObjectPropertyById(id: string, localName: string): void;
  deleteObjectPropertyById(id: string): void;
  reparentObjectProperty(childId: string, parentId: string | null): void;

  /* usages */
  attachPropertyToClass(propertyId: string, classId: string, objectClassId?: string | null): string;
  detachUsageById(usageId: string): void;
  setUsageTarget(usageId: string, objectClassId: string | null): void;

  /* drawing a relation */
  beginConnection(connection: PendingConnection): void;
  cancelConnection(): void;
  completeConnectionWith(propertyId: string): void;
  completeConnectionWithNewProperty(localName: string): void;

  /* annotations */
  annotate(target: EntityRef, term: string, value?: string, language?: string): void;
  editAnnotation(
    target: EntityRef,
    annotationId: string,
    patch: Partial<Pick<Annotation, 'term' | 'value' | 'language'>>,
  ): void;
  deleteAnnotation(target: EntityRef, annotationId: string): void;

  /* ontology header */
  setBaseIri(iri: string): void;
  setPrefix(prefix: string): void;

  /* selection and view */
  select(ref: EntityRef | null): void;
  deleteSelection(): void;
  setView(view: CanvasView): void;

  /* history */
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;

  /* projects */
  newProject(name?: string): string;
  switchProject(id: string): void;
  renameProject(id: string, name: string): void;
  deleteProject(id: string): void;
  importProject(fileContent: string): string | null;
  exportProjectFile(id?: string): string | null;
}

function activeProjectOf(state: {
  projects: Project[];
  activeProjectId: string | null;
}): Project | undefined {
  return state.projects.find((project) => project.id === state.activeProjectId);
}

export function activeOntology(state: {
  projects: Project[];
  activeProjectId: string | null;
}): Ontology | undefined {
  return activeProjectOf(state)?.ontology;
}

const initial = loadWorkspace();

export const useProjectStore = create<ProjectStoreState>((set, get) => {
  /**
   * Applies a pure mutation to the active ontology and records it in the undo history
   * according to the requested `HistoryMode`.
   */
  function edit(
    mutate: (ontology: Ontology) => Ontology,
    options: { history?: HistoryMode; coalesceKey?: string } = {},
  ): void {
    const mode = options.history ?? 'step';
    set((state) => {
      const project = activeProjectOf(state);
      if (!project) return state;

      const next = mutate(project.ontology);
      if (next === project.ontology) return state;

      const projects = state.projects.map((candidate) =>
        candidate.id === project.id
          ? { ...candidate, ontology: next, updatedAt: new Date().toISOString() }
          : candidate,
      );

      saveWorkspace({ projects, activeProjectId: state.activeProjectId });
      return {
        ...state,
        projects,
        history: recordHistory(state.history, project.ontology, mode, options.coalesceKey),
      };
    });
  }

  /**
   * Decides what the edit does to the undo stack. A coalescing edit that continues the same
   * target within the window keeps the existing snapshot — so the entry still restores the
   * state from *before* the user started typing, which is what undo should return them to.
   */
  function recordHistory(
    history: History,
    before: Ontology,
    mode: HistoryMode,
    coalesceKey?: string,
  ): History {
    if (mode === 'none') return history;

    const now = Date.now();
    if (mode === 'coalesce' && coalesceKey) {
      const continues =
        history.lastCoalesceKey === coalesceKey &&
        now - history.lastCoalesceAt < COALESCE_WINDOW_MS &&
        history.past.length > 0;
      return {
        past: continues ? history.past : [...history.past, before].slice(-HISTORY_LIMIT),
        future: [],
        lastCoalesceKey: coalesceKey,
        lastCoalesceAt: now,
      };
    }

    return {
      past: [...history.past, before].slice(-HISTORY_LIMIT),
      future: [],
      lastCoalesceKey: null,
      lastCoalesceAt: 0,
    };
  }

  /** Runs a mutation that also needs to report the id of what it created. */
  function editReturning(
    mutate: (ontology: Ontology) => { ontology: Ontology; id: string },
  ): string {
    let created = '';
    edit((ontology) => {
      const result = mutate(ontology);
      created = result.id;
      return result.ontology;
    });
    return created;
  }

  function persist(projects: Project[], activeProjectId: string | null): void {
    saveWorkspace({ projects, activeProjectId });
  }

  return {
    projects: initial.projects,
    activeProjectId: initial.activeProjectId,
    selection: null,
    view: 'schema',
    history: EMPTY_HISTORY,
    pendingConnection: null,

    /* ------------------------------------------------------------ classes */

    createClass(options = {}) {
      const id = editReturning((ontology) => addClass(ontology, options));
      if (id) set({ selection: { kind: 'class', id } });
      return id;
    },
    renameClassById(id, localName) {
      edit((ontology) => renameClass(ontology, id, localName), {
        history: 'coalesce',
        coalesceKey: `rename:${id}`,
      });
    },
    moveClassById(id, position) {
      edit((ontology) => moveClass(ontology, id, position), { history: 'none' });
    },
    deleteClassById(id) {
      edit((ontology) => deleteClass(ontology, id));
      if (get().selection?.id === id) set({ selection: null });
    },
    reparentClass(childId, parentId) {
      edit((ontology) => setSuperClass(ontology, childId, parentId));
    },

    /* ------------------------------------------------ datatype properties */

    createAttributeOn(classId, options = {}) {
      let propertyId = '';
      edit((ontology) => {
        const result = addAttributeToClass(ontology, { classId, ...options });
        propertyId = result.propertyId;
        return result.ontology;
      });
      return propertyId;
    },
    renameDatatypePropertyById(id, localName) {
      edit((ontology) => renameDatatypeProperty(ontology, id, localName), {
        history: 'coalesce',
        coalesceKey: `rename:${id}`,
      });
    },
    setAttributeRange(id, range) {
      edit((ontology) => setDatatypePropertyRange(ontology, id, range));
    },
    deleteDatatypePropertyById(id) {
      edit((ontology) => deleteDatatypeProperty(ontology, id));
      if (get().selection?.id === id) set({ selection: null });
    },

    /* -------------------------------------------------- object properties */

    createObjectProperty(options = {}) {
      const id = editReturning((ontology) => addObjectProperty(ontology, options));
      if (id) set({ selection: { kind: 'objectProperty', id } });
      return id;
    },
    renameObjectPropertyById(id, localName) {
      edit((ontology) => renameObjectProperty(ontology, id, localName), {
        history: 'coalesce',
        coalesceKey: `rename:${id}`,
      });
    },
    deleteObjectPropertyById(id) {
      edit((ontology) => deleteObjectProperty(ontology, id));
      if (get().selection?.id === id) set({ selection: null });
    },
    reparentObjectProperty(childId, parentId) {
      edit((ontology) => setSuperObjectProperty(ontology, childId, parentId));
    },

    /* ------------------------------------------------------------- usages */

    attachPropertyToClass(propertyId, classId, objectClassId = null) {
      return editReturning((ontology) =>
        attachProperty(ontology, { propertyId, subjectClassId: classId, objectClassId }),
      );
    },
    detachUsageById(usageId) {
      edit((ontology) => detachUsage(ontology, usageId));
    },
    setUsageTarget(usageId, objectClassId) {
      edit((ontology) => setUsageEndpoints(ontology, usageId, { objectClassId }));
    },

    /* --------------------------------------------------- drawing relations */

    beginConnection(connection) {
      set({ pendingConnection: connection });
    },
    cancelConnection() {
      set({ pendingConnection: null });
    },
    completeConnectionWith(propertyId) {
      const pending = get().pendingConnection;
      if (!pending) return;
      edit(
        (ontology) =>
          attachProperty(ontology, {
            propertyId,
            subjectClassId: pending.subjectClassId,
            objectClassId: pending.objectClassId,
          }).ontology,
      );
      set({ pendingConnection: null, selection: { kind: 'objectProperty', id: propertyId } });
    },
    completeConnectionWithNewProperty(localName) {
      const pending = get().pendingConnection;
      if (!pending) return;
      let propertyId = '';
      edit((ontology) => {
        const result = addRelationBetween(ontology, {
          localName,
          subjectClassId: pending.subjectClassId,
          objectClassId: pending.objectClassId,
        });
        propertyId = result.propertyId;
        return result.ontology;
      });
      set({
        pendingConnection: null,
        selection: propertyId ? { kind: 'objectProperty', id: propertyId } : null,
      });
    },

    /* -------------------------------------------------------- annotations */

    annotate(target, term, value = '', language) {
      edit((ontology) => addAnnotation(ontology, target.kind, target.id, term, value, language));
    },
    editAnnotation(target, annotationId, patch) {
      edit((ontology) => updateAnnotation(ontology, target.kind, target.id, annotationId, patch), {
        history: 'coalesce',
        coalesceKey: `annotation:${annotationId}`,
      });
    },
    deleteAnnotation(target, annotationId) {
      edit((ontology) => removeAnnotation(ontology, target.kind, target.id, annotationId));
    },

    /* ---------------------------------------------------- ontology header */

    setBaseIri(iri) {
      edit((ontology) => setOntologyIri(ontology, iri), {
        history: 'coalesce',
        coalesceKey: 'ontology:iri',
      });
    },
    setPrefix(prefix) {
      edit((ontology) => setOntologyPrefix(ontology, prefix), {
        history: 'coalesce',
        coalesceKey: 'ontology:prefix',
      });
    },

    /* ------------------------------------------------------------ selection */

    select(ref) {
      set({ selection: ref });
    },
    deleteSelection() {
      const { selection } = get();
      if (!selection) return;
      if (selection.kind === 'class') get().deleteClassById(selection.id);
      else if (selection.kind === 'objectProperty') get().deleteObjectPropertyById(selection.id);
      else if (selection.kind === 'datatypeProperty')
        get().deleteDatatypePropertyById(selection.id);
    },
    setView(view) {
      set({ view });
    },

    /* -------------------------------------------------------------- history */

    undo() {
      set((state) => {
        const project = activeProjectOf(state);
        const previous = state.history.past.at(-1);
        if (!project || previous === undefined) return state;
        const projects = state.projects.map((candidate) =>
          candidate.id === project.id ? { ...candidate, ontology: previous } : candidate,
        );
        persist(projects, state.activeProjectId);
        return {
          ...state,
          projects,
          selection: null,
          history: {
            past: state.history.past.slice(0, -1),
            future: [project.ontology, ...state.history.future].slice(0, HISTORY_LIMIT),
            // Undoing ends any run of coalescing edits: the next keystroke starts a new entry.
            lastCoalesceKey: null,
            lastCoalesceAt: 0,
          },
        };
      });
    },
    redo() {
      set((state) => {
        const project = activeProjectOf(state);
        const next = state.history.future[0];
        if (!project || next === undefined) return state;
        const projects = state.projects.map((candidate) =>
          candidate.id === project.id ? { ...candidate, ontology: next } : candidate,
        );
        persist(projects, state.activeProjectId);
        return {
          ...state,
          projects,
          selection: null,
          history: {
            past: [...state.history.past, project.ontology].slice(-HISTORY_LIMIT),
            future: state.history.future.slice(1),
            lastCoalesceKey: null,
            lastCoalesceAt: 0,
          },
        };
      });
    },
    canUndo() {
      return get().history.past.length > 0;
    },
    canRedo() {
      return get().history.future.length > 0;
    },

    /* ------------------------------------------------------------- projects */

    newProject(name = 'Untitled ontology') {
      const project = createProject(name);
      set((state) => {
        const projects = [...state.projects, project];
        persist(projects, project.id);
        return {
          ...state,
          projects,
          activeProjectId: project.id,
          selection: null,
          view: 'schema',
          pendingConnection: null,
          history: EMPTY_HISTORY,
        };
      });
      return project.id;
    },
    switchProject(id) {
      set((state) => {
        if (!state.projects.some((project) => project.id === id)) return state;
        persist(state.projects, id);
        // History is per editing session on one ontology; crossing projects resets it.
        return {
          ...state,
          activeProjectId: id,
          selection: null,
          pendingConnection: null,
          history: EMPTY_HISTORY,
        };
      });
    },
    renameProject(id, name) {
      const trimmed = name.trim();
      if (!trimmed) return;
      set((state) => {
        const projects = state.projects.map((project) =>
          project.id === id
            ? { ...project, name: trimmed, updatedAt: new Date().toISOString() }
            : project,
        );
        persist(projects, state.activeProjectId);
        return { ...state, projects };
      });
    },
    deleteProject(id) {
      set((state) => {
        const remaining = state.projects.filter((project) => project.id !== id);
        // The workspace always holds at least one project, so there is always something to edit.
        const projects = remaining.length > 0 ? remaining : [createProject('Untitled ontology')];
        const activeProjectId =
          state.activeProjectId === id ? (projects[0]?.id ?? null) : state.activeProjectId;
        persist(projects, activeProjectId);
        return {
          ...state,
          projects,
          activeProjectId,
          selection: null,
          pendingConnection: null,
          history: EMPTY_HISTORY,
        };
      });
    },
    importProject(fileContent) {
      const imported = projectFromFile(fileContent);
      if (!imported) return null;
      // A fresh id keeps re-importing the same file from overwriting the original.
      const project: Project = { ...imported, id: createProject(imported.name).id };
      set((state) => {
        const projects = [...state.projects, project];
        persist(projects, project.id);
        return {
          ...state,
          projects,
          activeProjectId: project.id,
          selection: null,
          pendingConnection: null,
          history: EMPTY_HISTORY,
        };
      });
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
});
