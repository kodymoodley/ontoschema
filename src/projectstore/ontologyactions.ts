import {
  addAnnotation,
  addAttributeToClass,
  addClass,
  addObjectProperty,
  attachProperty,
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
import type { Annotation, EntityRef, Position } from '../ontologymodel';
import type { XsdDatatype } from '../annotationvocabulary';
import type { Editor, SetState } from './editing';
import type { ProjectStoreState } from './store';

/**
 * Editing the ontology itself. Every action here is a thin binding of a store intent to a
 * pure mutation in `ontologymodel`; the interesting logic lives there, and the history and
 * persistence rules live in the editor.
 */

export interface OntologyActions {
  createClass(options?: { localName?: string; position?: Position }): string;
  renameClassById(id: string, localName: string): void;
  moveClassById(id: string, position: Position): void;
  deleteClassById(id: string): void;
  reparentClass(childId: string, parentId: string | null): void;

  createAttributeOn(classId: string, options?: { localName?: string; range?: XsdDatatype }): string;
  renameDatatypePropertyById(id: string, localName: string): void;
  setAttributeRange(id: string, range: XsdDatatype): void;
  deleteDatatypePropertyById(id: string): void;

  createObjectProperty(options?: { localName?: string }): string;
  renameObjectPropertyById(id: string, localName: string): void;
  deleteObjectPropertyById(id: string): void;
  reparentObjectProperty(childId: string, parentId: string | null): void;

  attachPropertyToClass(propertyId: string, classId: string, objectClassId?: string | null): string;
  detachUsageById(usageId: string): void;
  setUsageTarget(usageId: string, objectClassId: string | null): void;

  annotate(target: EntityRef, term: string, value?: string, language?: string): void;
  editAnnotation(
    target: EntityRef,
    annotationId: string,
    patch: Partial<Pick<Annotation, 'term' | 'value' | 'language'>>,
  ): void;
  deleteAnnotation(target: EntityRef, annotationId: string): void;

  setBaseIri(iri: string): void;
  setPrefix(prefix: string): void;
}

export function createOntologyActions(
  editor: Editor,
  set: SetState,
  get: () => ProjectStoreState,
): OntologyActions {
  /** Deleting whatever is selected must not leave the inspector pointing at a ghost. */
  function forgetIfSelected(id: string): void {
    if (get().selection?.id === id) set((state) => ({ ...state, selection: null }));
  }

  return {
    /* ------------------------------------------------------------ classes */

    createClass(options = {}) {
      const id = editor.editReturning((ontology) => addClass(ontology, options));
      if (id) set((state) => ({ ...state, selection: { kind: 'class', id } }));
      return id;
    },
    renameClassById(id, localName) {
      editor.edit((ontology) => renameClass(ontology, id, localName), {
        history: 'coalesce',
        coalesceKey: `rename:${id}`,
      });
    },
    moveClassById(id, position) {
      editor.edit((ontology) => moveClass(ontology, id, position), { history: 'none' });
    },
    deleteClassById(id) {
      editor.edit((ontology) => deleteClass(ontology, id));
      forgetIfSelected(id);
    },
    reparentClass(childId, parentId) {
      editor.edit((ontology) => setSuperClass(ontology, childId, parentId));
    },

    /* ------------------------------------------------ datatype properties */

    createAttributeOn(classId, options = {}) {
      return editor.editReturning((ontology) => {
        const result = addAttributeToClass(ontology, { classId, ...options });
        return { ontology: result.ontology, id: result.propertyId };
      });
    },
    renameDatatypePropertyById(id, localName) {
      editor.edit((ontology) => renameDatatypeProperty(ontology, id, localName), {
        history: 'coalesce',
        coalesceKey: `rename:${id}`,
      });
    },
    setAttributeRange(id, range) {
      editor.edit((ontology) => setDatatypePropertyRange(ontology, id, range));
    },
    deleteDatatypePropertyById(id) {
      editor.edit((ontology) => deleteDatatypeProperty(ontology, id));
      forgetIfSelected(id);
    },

    /* -------------------------------------------------- object properties */

    createObjectProperty(options = {}) {
      const id = editor.editReturning((ontology) => addObjectProperty(ontology, options));
      if (id) set((state) => ({ ...state, selection: { kind: 'objectProperty', id } }));
      return id;
    },
    renameObjectPropertyById(id, localName) {
      editor.edit((ontology) => renameObjectProperty(ontology, id, localName), {
        history: 'coalesce',
        coalesceKey: `rename:${id}`,
      });
    },
    deleteObjectPropertyById(id) {
      editor.edit((ontology) => deleteObjectProperty(ontology, id));
      forgetIfSelected(id);
    },
    reparentObjectProperty(childId, parentId) {
      editor.edit((ontology) => setSuperObjectProperty(ontology, childId, parentId));
    },

    /* ------------------------------------------------------------- usages */

    attachPropertyToClass(propertyId, classId, objectClassId = null) {
      return editor.editReturning((ontology) =>
        attachProperty(ontology, { propertyId, subjectClassId: classId, objectClassId }),
      );
    },
    detachUsageById(usageId) {
      editor.edit((ontology) => detachUsage(ontology, usageId));
    },
    setUsageTarget(usageId, objectClassId) {
      editor.edit((ontology) => setUsageEndpoints(ontology, usageId, { objectClassId }));
    },

    /* -------------------------------------------------------- annotations */

    annotate(target, term, value = '', language) {
      editor.edit((ontology) =>
        addAnnotation(ontology, target.kind, target.id, term, value, language),
      );
    },
    editAnnotation(target, annotationId, patch) {
      editor.edit(
        (ontology) => updateAnnotation(ontology, target.kind, target.id, annotationId, patch),
        { history: 'coalesce', coalesceKey: `annotation:${annotationId}` },
      );
    },
    deleteAnnotation(target, annotationId) {
      editor.edit((ontology) => removeAnnotation(ontology, target.kind, target.id, annotationId));
    },

    /* ---------------------------------------------------- ontology header */

    setBaseIri(iri) {
      editor.edit((ontology) => setOntologyIri(ontology, iri), {
        history: 'coalesce',
        coalesceKey: 'ontology:iri',
      });
    },
    setPrefix(prefix) {
      editor.edit((ontology) => setOntologyPrefix(ontology, prefix), {
        history: 'coalesce',
        coalesceKey: 'ontology:prefix',
      });
    },
  };
}
