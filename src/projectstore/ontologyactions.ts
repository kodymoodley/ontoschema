import {
  addAnnotation,
  addAttributeToClass,
  addClass,
  addRelation,
  attachProperty,
  deleteClass,
  deleteAttribute,
  deleteRelation,
  detachUsage,
  moveClass,
  placeClasses,
  removeAnnotation,
  renameClass,
  renameAttribute,
  renameRelation,
  setAttributeRange,
  setOntologyIri,
  setOntologyPrefix,
  addSubClassOf,
  removeSubClassOf,
  setSuperClass,
  setSuperRelation,
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
  /**
   * Puts many classes where a computed layout says they belong.
   *
   * `remember` is what separates the two callers. Arranging by hand is an edit like any other
   * and belongs in the undo stack; arranging an import that arrived with no layout at all is
   * part of opening the file, and an undo that puts every class back in a single pile is not
   * a state anyone asked to return to.
   */
  placeClassesById(
    positions: ReadonlyMap<string, Position>,
    options?: { remember?: boolean },
  ): void;
  deleteClassById(id: string): void;
  reparentClass(childId: string, parentId: string | null): void;
  /**
   * Adds a parent alongside any the class already has, rather than replacing them. A class is
   * often two things at once -- a LeaseAgreement is a Contract and a FinancialInstrument -- and
   * the model, the exporters and the taxonomy view have always allowed it.
   */
  addSuperClass(childId: string, parentId: string): void;
  removeSuperClass(childId: string, parentId: string): void;

  createAttributeOn(classId: string, options?: { localName?: string; range?: XsdDatatype }): string;
  renameAttributeById(id: string, localName: string): void;
  setAttributeRange(id: string, range: XsdDatatype): void;
  deleteAttributeById(id: string): void;

  createRelation(options?: { localName?: string }): string;
  renameRelationById(id: string, localName: string): void;
  deleteRelationById(id: string): void;
  reparentRelation(childId: string, parentId: string | null): void;

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
    placeClassesById(positions, options) {
      if (positions.size === 0) return;
      editor.edit((ontology) => placeClasses(ontology, positions), {
        history: options?.remember === false ? 'none' : 'step',
      });
    },
    deleteClassById(id) {
      editor.edit((ontology) => deleteClass(ontology, id));
      forgetIfSelected(id);
    },
    reparentClass(childId, parentId) {
      editor.edit((ontology) => setSuperClass(ontology, childId, parentId));
    },
    addSuperClass(childId, parentId) {
      editor.edit((ontology) => addSubClassOf(ontology, childId, parentId));
    },
    removeSuperClass(childId, parentId) {
      editor.edit((ontology) => removeSubClassOf(ontology, childId, parentId));
    },

    /* ------------------------------------------------ attributes */

    createAttributeOn(classId, options = {}) {
      return editor.editReturning((ontology) => {
        const result = addAttributeToClass(ontology, { classId, ...options });
        return { ontology: result.ontology, id: result.propertyId };
      });
    },
    renameAttributeById(id, localName) {
      editor.edit((ontology) => renameAttribute(ontology, id, localName), {
        history: 'coalesce',
        coalesceKey: `rename:${id}`,
      });
    },
    setAttributeRange(id, range) {
      editor.edit((ontology) => setAttributeRange(ontology, id, range));
    },
    deleteAttributeById(id) {
      editor.edit((ontology) => deleteAttribute(ontology, id));
      forgetIfSelected(id);
    },

    /* -------------------------------------------------- relations */

    createRelation(options = {}) {
      const id = editor.editReturning((ontology) => addRelation(ontology, options));
      if (id) set((state) => ({ ...state, selection: { kind: 'relation', id } }));
      return id;
    },
    renameRelationById(id, localName) {
      editor.edit((ontology) => renameRelation(ontology, id, localName), {
        history: 'coalesce',
        coalesceKey: `rename:${id}`,
      });
    },
    deleteRelationById(id) {
      editor.edit((ontology) => deleteRelation(ontology, id));
      forgetIfSelected(id);
    },
    reparentRelation(childId, parentId) {
      editor.edit((ontology) => setSuperRelation(ontology, childId, parentId));
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
