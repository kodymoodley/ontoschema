import type { Ontology } from '../ontologymodel';
import { recordHistory } from './history';
import type { HistoryMode } from './history';
import { saveWorkspace } from './persistence';
import { activeProject, withOntology } from './workspace';
import type { ProjectStoreState } from './store';

/**
 * The one path by which the ontology changes.
 *
 * Funnelling every edit through here is what stops an action forgetting to record undo
 * history, stamp the project as touched, or persist — the three things that must happen on
 * every change and that were previously repeated at each call site.
 */

export type SetState = (
  updater: (state: ProjectStoreState) => ProjectStoreState | Partial<ProjectStoreState>,
) => void;

export interface EditOptions {
  history?: HistoryMode;
  coalesceKey?: string;
}

export interface Editor {
  /** Applies a pure mutation to the open ontology. */
  edit(mutate: (ontology: Ontology) => Ontology, options?: EditOptions): void;
  /** As `edit`, for mutations that also report the id of what they created. */
  editReturning(
    mutate: (ontology: Ontology) => { ontology: Ontology; id: string },
    options?: EditOptions,
  ): string;
}

export function createEditor(set: SetState): Editor {
  function edit(mutate: (ontology: Ontology) => Ontology, options: EditOptions = {}): void {
    set((state) => {
      const open = activeProject(state);
      if (!open) return state;

      const next = mutate(open.ontology);
      // Mutations return the same reference when they decline, so nothing is recorded for
      // a rejected edit — an attempted cycle does not become an empty undo step.
      if (next === open.ontology) return state;

      const workspace = withOntology(state, next);
      saveWorkspace(workspace);
      return {
        ...state,
        ...workspace,
        history: recordHistory(
          state.history,
          open.ontology,
          options.history ?? 'step',
          options.coalesceKey,
        ),
      };
    });
  }

  function editReturning(
    mutate: (ontology: Ontology) => { ontology: Ontology; id: string },
    options: EditOptions = {},
  ): string {
    // Zustand applies the updater synchronously, so the id is available on return.
    let created = '';
    edit((ontology) => {
      const result = mutate(ontology);
      created = result.id;
      return result.ontology;
    }, options);
    return created;
  }

  return { edit, editReturning };
}
