import { create } from 'zustand';
import {
  addAnnotation,
  addClass,
  addDatatypeProperty,
  addObjectProperty,
  addSubClassOf,
  createProject,
  deleteClass,
  deleteDatatypeProperty,
  deleteObjectProperty,
  moveClass,
  moveDatatypeProperty,
  moveObjectProperty,
  removeAnnotation,
  removeSubClassOf,
  renameClass,
  renameDatatypeProperty,
  renameObjectProperty,
  setDatatypePropertyDomain,
  setDatatypePropertyRange,
  setObjectPropertyEndpoints,
  setOntologyIri,
  setOntologyPrefix,
  setSuperClass,
  setSuperObjectProperty,
  updateAnnotation,
} from '../ontologymodel';
import type {
  Annotation,
  EntityRef,
  ObjectPropertyKind,
  Ontology,
  Position,
  Project,
} from '../ontologymodel';
import type { XsdDatatype } from '../annotationvocabulary';
import { loadWorkspace, projectFromFile, projectToFile, saveWorkspace } from './persistence';

/**
 * The app-state layer. It owns *when* the ontology changes; `ontologymodel` owns *how*.
 * Every editing action funnels through `edit`, which is the single place that records
 * undo history, stamps `updatedAt` and persists — so no action can forget to do those.
 */

export type CanvasView = 'schema' | 'taxonomy';

const HISTORY_LIMIT = 50;

interface History {
  past: Ontology[];
  future: Ontology[];
}

export interface ProjectStoreState {
  projects: Project[];
  activeProjectId: string | null;
  selection: EntityRef | null;
  view: CanvasView;
  history: History;

  /* editing */
  createClass(options?: { localName?: string; position?: Position }): string;
  renameClassById(id: string, localName: string): void;
  moveClassById(id: string, position: Position): void;
  deleteClassById(id: string): void;
  linkSubClass(childId: string, parentId: string): void;
  unlinkSubClass(childId: string, parentId: string): void;
  reparentClass(childId: string, parentId: string | null): void;

  createDatatypeProperty(options?: {
    localName?: string;
    domainClassId?: string | null;
    range?: XsdDatatype;
    position?: Position;
  }): string;
  renameDatatypePropertyById(id: string, localName: string): void;
  setAttributeRange(id: string, range: XsdDatatype): void;
  setAttributeDomain(id: string, domainClassId: string | null): void;
  moveDatatypePropertyById(id: string, position: Position): void;
  deleteDatatypePropertyById(id: string): void;

  createObjectProperty(options?: {
    localName?: string;
    kind?: ObjectPropertyKind;
    domainClassId?: string | null;
    rangeClassId?: string | null;
    position?: Position;
  }): string;
  renameObjectPropertyById(id: string, localName: string): void;
  setRelationEndpoints(
    id: string,
    endpoints: { domainClassId?: string | null; rangeClassId?: string | null },
  ): void;
  moveObjectPropertyById(id: string, position: Position): void;
  deleteObjectPropertyById(id: string): void;
  reparentObjectProperty(childId: string, parentId: string | null): void;

  annotate(target: EntityRef, term: string, value?: string, language?: string): void;
  editAnnotation(
    target: EntityRef,
    annotationId: string,
    patch: Partial<Pick<Annotation, 'term' | 'value' | 'language'>>,
  ): void;
  deleteAnnotation(target: EntityRef, annotationId: string): void;

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
   * Applies a pure mutation to the active ontology and records it as one undoable step.
   * `capture: false` is used for continuous gestures such as dragging a node, which should
   * not fill the undo stack with a hundred intermediate positions.
   */
  function edit(
    mutate: (ontology: Ontology) => Ontology,
    options: { capture?: boolean } = {},
  ): void {
    const capture = options.capture ?? true;
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

      const history: History = capture
        ? {
            past: [...state.history.past, project.ontology].slice(-HISTORY_LIMIT),
            future: [],
          }
        : state.history;

      const updated = { ...state, projects, history };
      saveWorkspace({ projects, activeProjectId: state.activeProjectId });
      return updated;
    });
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
    history: { past: [], future: [] },

    /* ------------------------------------------------------------ classes */

    createClass(options = {}) {
      const id = editReturning((ontology) => addClass(ontology, options));
      if (id) set({ selection: { kind: 'class', id } });
      return id;
    },
    renameClassById(id, localName) {
      edit((ontology) => renameClass(ontology, id, localName));
    },
    moveClassById(id, position) {
      edit((ontology) => moveClass(ontology, id, position), { capture: false });
    },
    deleteClassById(id) {
      edit((ontology) => deleteClass(ontology, id));
      if (get().selection?.id === id) set({ selection: null });
    },
    linkSubClass(childId, parentId) {
      edit((ontology) => addSubClassOf(ontology, childId, parentId));
    },
    unlinkSubClass(childId, parentId) {
      edit((ontology) => removeSubClassOf(ontology, childId, parentId));
    },
    reparentClass(childId, parentId) {
      edit((ontology) => setSuperClass(ontology, childId, parentId));
    },

    /* ------------------------------------------------ datatype properties */

    createDatatypeProperty(options = {}) {
      const id = editReturning((ontology) => addDatatypeProperty(ontology, options));
      if (id) set({ selection: { kind: 'datatypeProperty', id } });
      return id;
    },
    renameDatatypePropertyById(id, localName) {
      edit((ontology) => renameDatatypeProperty(ontology, id, localName));
    },
    setAttributeRange(id, range) {
      edit((ontology) => setDatatypePropertyRange(ontology, id, range));
    },
    setAttributeDomain(id, domainClassId) {
      edit((ontology) => setDatatypePropertyDomain(ontology, id, domainClassId));
    },
    moveDatatypePropertyById(id, position) {
      edit((ontology) => moveDatatypeProperty(ontology, id, position), { capture: false });
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
      edit((ontology) => renameObjectProperty(ontology, id, localName));
    },
    setRelationEndpoints(id, endpoints) {
      edit((ontology) => setObjectPropertyEndpoints(ontology, id, endpoints));
    },
    moveObjectPropertyById(id, position) {
      edit((ontology) => moveObjectProperty(ontology, id, position), { capture: false });
    },
    deleteObjectPropertyById(id) {
      edit((ontology) => deleteObjectProperty(ontology, id));
      if (get().selection?.id === id) set({ selection: null });
    },
    reparentObjectProperty(childId, parentId) {
      edit((ontology) => setSuperObjectProperty(ontology, childId, parentId));
    },

    /* -------------------------------------------------------- annotations */

    annotate(target, term, value = '', language) {
      edit((ontology) => addAnnotation(ontology, target.kind, target.id, term, value, language));
    },
    editAnnotation(target, annotationId, patch) {
      edit((ontology) => updateAnnotation(ontology, target.kind, target.id, annotationId, patch));
    },
    deleteAnnotation(target, annotationId) {
      edit((ontology) => removeAnnotation(ontology, target.kind, target.id, annotationId));
    },

    /* ---------------------------------------------------- ontology header */

    setBaseIri(iri) {
      edit((ontology) => setOntologyIri(ontology, iri));
    },
    setPrefix(prefix) {
      edit((ontology) => setOntologyPrefix(ontology, prefix));
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
          history: { past: [], future: [] },
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
          history: { past: [], future: [] },
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
          history: { past: [], future: [] },
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
          history: { past: [], future: [] },
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
