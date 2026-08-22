import { addRelationBetween, attachProperty } from '../ontologymodel';
import type { EntityRef } from '../ontologymodel';
import type { Editor, SetState } from './editing';
import type { ProjectStoreState } from './store';

/**
 * Transient interaction state: what is selected, which canvas is showing, and a connection
 * that has been drawn but not yet given a property.
 *
 * None of this belongs in the ontology — it describes the session, not the schema — but it
 * has to live somewhere both the canvas and the panels can see, and they may not import one
 * another.
 */

export type CanvasView = 'schema' | 'taxonomy';

/**
 * Whether the taxonomy view draws the selected class's relations.
 *
 * There was a third setting, _all_, and using it settled the question: the taxonomy view reads
 * cleanly because it draws one kind of edge, and drawing every relation took that away without
 * giving anything back that the schema view does not already do better. What is left is the
 * setting that earns its place — the relations of the one class you are looking at.
 *
 * A view preference, held here rather than in the canvas so it survives switching tabs, and
 * not written to the file: it is how someone is looking at a schema, not part of the schema.
 */
export type TaxonomyRelations = 'off' | 'selected';

/** A connection the user has drawn but not yet assigned a property to. */
export interface PendingConnection {
  subjectClassId: string;
  objectClassId: string;
}

export interface InteractionActions {
  select(ref: EntityRef | null): void;
  deleteSelection(): void;
  setView(view: CanvasView): void;
  setTaxonomyRelations(relations: TaxonomyRelations): void;

  /** Ask the canvas to bring a class into focus. Cleared once it has. */
  focusClass(classId: string): void;
  clearFocus(): void;

  beginConnection(connection: PendingConnection): void;
  cancelConnection(): void;
  completeConnectionWith(propertyId: string): void;
  completeConnectionWithNewProperty(localName: string): void;
}

export function createInteractionActions(
  editor: Editor,
  set: SetState,
  get: () => ProjectStoreState,
): InteractionActions {
  return {
    select(ref) {
      set((state) => ({ ...state, selection: ref }));
    },
    deleteSelection() {
      const { selection } = get();
      if (!selection) return;
      if (selection.kind === 'class') get().deleteClassById(selection.id);
      else if (selection.kind === 'relation') get().deleteRelationById(selection.id);
      else if (selection.kind === 'attribute') get().deleteAttributeById(selection.id);
    },
    setView(view) {
      set((state) => ({ ...state, view }));
    },
    setTaxonomyRelations(taxonomyRelations) {
      set((state) => ({ ...state, taxonomyRelations }));
    },

    /*
     * The class node asks; the canvas answers. Routing it through the store is what lets a
     * node request a viewport change without classeditor/ knowing the canvas exists.
     * Selecting as well, so the inspector follows what the eye is now looking at.
     */
    focusClass(classId) {
      set((state) => ({
        ...state,
        focusRequest: classId,
        selection: { kind: 'class', id: classId },
      }));
    },
    clearFocus() {
      set((state) => (state.focusRequest === null ? state : { ...state, focusRequest: null }));
    },

    /*
     * Drawing an edge deliberately does not invent a property. It records the pair of
     * classes and lets the picker decide which relation this is — an existing one, or
     * a new one — which is what makes a property reusable across class pairs.
     */
    beginConnection(connection) {
      set((state) => ({ ...state, pendingConnection: connection }));
    },
    cancelConnection() {
      set((state) => ({ ...state, pendingConnection: null }));
    },
    completeConnectionWith(propertyId) {
      const pending = get().pendingConnection;
      if (!pending) return;
      editor.edit(
        (ontology) =>
          attachProperty(ontology, {
            propertyId,
            subjectClassId: pending.subjectClassId,
            objectClassId: pending.objectClassId,
          }).ontology,
      );
      set((state) => ({
        ...state,
        pendingConnection: null,
        selection: { kind: 'relation', id: propertyId },
      }));
    },
    completeConnectionWithNewProperty(localName) {
      const pending = get().pendingConnection;
      if (!pending) return;
      // Creating the property and using it is one undoable step, not two.
      const propertyId = editor.editReturning((ontology) => {
        const result = addRelationBetween(ontology, {
          localName,
          subjectClassId: pending.subjectClassId,
          objectClassId: pending.objectClassId,
        });
        return { ontology: result.ontology, id: result.propertyId };
      });
      set((state) => ({
        ...state,
        pendingConnection: null,
        selection: propertyId ? { kind: 'relation', id: propertyId } : null,
      }));
    },
  };
}
