import { create } from 'zustand';
import type { EntityRef, Ontology } from '../ontologymodel';
import { createEditor } from './editing';
import { EMPTY_HISTORY } from './history';
import type { History } from './history';
import { loadWorkspace } from './persistence';
import { activeOntologyOf } from './workspace';
import type { Workspace } from './workspace';
import { createOntologyActions } from './ontologyactions';
import type { OntologyActions } from './ontologyactions';
import { createInteractionActions } from './interactionactions';
import type { CanvasView, InteractionActions, PendingConnection } from './interactionactions';
import { createWorkspaceActions } from './workspaceactions';
import type { WorkspaceActions } from './workspaceactions';

/**
 * The app-state layer: it owns *when* the ontology changes, while `ontologymodel` owns
 * *how*.
 *
 * This file is composition only. The three groups of actions are built separately so that
 * each concern can be read on its own, and the rules they share — how an edit is recorded,
 * what a workspace transition means — live in the pure `history` and `workspace` modules
 * where they can be tested without a store at all.
 */

export type { CanvasView, PendingConnection } from './interactionactions';

/** What the store holds, as opposed to what it can do. */
interface SessionState extends Workspace {
  selection: EntityRef | null;
  view: CanvasView;
  history: History;
  pendingConnection: PendingConnection | null;
}

export type ProjectStoreState = SessionState &
  OntologyActions &
  InteractionActions &
  WorkspaceActions;

export function activeOntology(state: Workspace): Ontology | undefined {
  return activeOntologyOf(state);
}

const restored = loadWorkspace();

export const useProjectStore = create<ProjectStoreState>((set, get) => {
  const editor = createEditor(set);

  return {
    projects: restored.projects,
    activeProjectId: restored.activeProjectId,
    selection: null,
    view: 'schema',
    history: EMPTY_HISTORY,
    pendingConnection: null,

    ...createOntologyActions(editor, set, get),
    ...createInteractionActions(editor, set, get),
    ...createWorkspaceActions(set, get),
  };
});
