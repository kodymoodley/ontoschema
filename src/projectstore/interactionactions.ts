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

/** A connection the user has drawn but not yet assigned a property to. */
export interface PendingConnection {
  subjectClassId: string;
  objectClassId: string;
}

export interface InteractionActions {
  select(ref: EntityRef | null): void;
  deleteSelection(): void;
  setView(view: CanvasView): void;

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
      else if (selection.kind === 'objectProperty') get().deleteObjectPropertyById(selection.id);
      else if (selection.kind === 'datatypeProperty')
        get().deleteDatatypePropertyById(selection.id);
    },
    setView(view) {
      set((state) => ({ ...state, view }));
    },

    /*
     * Drawing an edge deliberately does not invent a property. It records the pair of
     * classes and lets the picker decide which object property this is — an existing one, or
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
        selection: { kind: 'objectProperty', id: propertyId },
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
        selection: propertyId ? { kind: 'objectProperty', id: propertyId } : null,
      }));
    },
  };
}
