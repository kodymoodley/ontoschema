import type { Ontology } from '../ontologymodel';

/**
 * The undo stack, as pure data and pure transitions.
 *
 * Kept out of the store so the rules can be reasoned about and tested without Zustand,
 * React or a DOM. The store decides *when* to record; this decides *what* recording means.
 */

export const HISTORY_LIMIT = 50;

/** Two edits to the same target closer together than this merge into one undo entry. */
export const COALESCE_WINDOW_MS = 700;

/**
 * How an edit is recorded.
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

export interface History {
  past: Ontology[];
  future: Ontology[];
  /** What the last coalescing edit touched, so the next one knows whether to merge. */
  lastCoalesceKey: string | null;
  lastCoalesceAt: number;
}

export const EMPTY_HISTORY: History = {
  past: [],
  future: [],
  lastCoalesceKey: null,
  lastCoalesceAt: 0,
};

/**
 * Folds an edit into the history. A coalescing edit that continues the same target within
 * the window keeps the existing snapshot — so the entry still restores the state from
 * *before* the user started typing, which is where undo should return them.
 *
 * `now` is injected rather than read from the clock so the behaviour is testable.
 */
export function recordHistory(
  history: History,
  before: Ontology,
  mode: HistoryMode,
  coalesceKey?: string,
  now: number = Date.now(),
): History {
  if (mode === 'none') return history;

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

export interface HistoryStep {
  history: History;
  /** The ontology to move to. */
  ontology: Ontology;
}

/** Steps back, or null when there is nothing to undo. */
export function undoStep(history: History, current: Ontology): HistoryStep | null {
  const previous = history.past.at(-1);
  if (previous === undefined) return null;
  return {
    ontology: previous,
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future].slice(0, HISTORY_LIMIT),
      // Undoing ends any run of coalescing edits: the next keystroke starts a new entry.
      lastCoalesceKey: null,
      lastCoalesceAt: 0,
    },
  };
}

/** Steps forward, or null when there is nothing to redo. */
export function redoStep(history: History, current: Ontology): HistoryStep | null {
  const next = history.future[0];
  if (next === undefined) return null;
  return {
    ontology: next,
    history: {
      past: [...history.past, current].slice(-HISTORY_LIMIT),
      future: history.future.slice(1),
      lastCoalesceKey: null,
      lastCoalesceAt: 0,
    },
  };
}
