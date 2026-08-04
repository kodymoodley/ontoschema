import { describe, expect, it } from 'vitest';
import { addClass, createEmptyOntology } from '../ontologymodel';
import type { Ontology } from '../ontologymodel';
import {
  COALESCE_WINDOW_MS,
  EMPTY_HISTORY,
  HISTORY_LIMIT,
  recordHistory,
  redoStep,
  undoStep,
} from './history';
import type { History } from './history';

/** Distinct ontologies, so the assertions can tell snapshots apart by identity. */
function ontology(localName: string): Ontology {
  return addClass(createEmptyOntology(), { localName }).ontology;
}

const record = recordHistory;

describe('recordHistory', () => {
  it('pushes one entry for a discrete step', () => {
    const history = record(EMPTY_HISTORY, ontology('A'), 'step');
    expect(history.past).toHaveLength(1);
  });

  it('records nothing for a continuous gesture', () => {
    const history = record(EMPTY_HISTORY, ontology('A'), 'none');
    expect(history).toBe(EMPTY_HISTORY);
  });

  it('clears the redo stack, because the timeline has branched', () => {
    const withFuture: History = { ...EMPTY_HISTORY, future: [ontology('F')] };
    expect(record(withFuture, ontology('A'), 'step').future).toHaveLength(0);
  });

  it('caps the stack, discarding the oldest entries', () => {
    let history = EMPTY_HISTORY;
    for (let step = 0; step < HISTORY_LIMIT + 10; step += 1) {
      history = record(history, ontology(`C${step}`), 'step');
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT);
  });
});

describe('coalescing', () => {
  const first = ontology('Car');

  it('opens a new entry for the first edit of a target', () => {
    const history = record(EMPTY_HISTORY, first, 'coalesce', 'rename:1', 1_000);
    expect(history.past).toEqual([first]);
    expect(history.lastCoalesceKey).toBe('rename:1');
  });

  it('merges a rapid follow-up into the same entry', () => {
    const opened = record(EMPTY_HISTORY, first, 'coalesce', 'rename:1', 1_000);
    const merged = record(opened, ontology('Ca'), 'coalesce', 'rename:1', 1_100);

    expect(merged.past).toHaveLength(1);
    // Crucially the snapshot is still the state from before typing began.
    expect(merged.past[0]).toBe(first);
  });

  it('opens a new entry once the window has passed', () => {
    const opened = record(EMPTY_HISTORY, first, 'coalesce', 'rename:1', 1_000);
    const later = record(
      opened,
      ontology('Ca'),
      'coalesce',
      'rename:1',
      1_000 + COALESCE_WINDOW_MS,
    );
    expect(later.past).toHaveLength(2);
  });

  it('opens a new entry when the target changes', () => {
    const opened = record(EMPTY_HISTORY, first, 'coalesce', 'rename:1', 1_000);
    const other = record(opened, ontology('Truck'), 'coalesce', 'rename:2', 1_050);
    expect(other.past).toHaveLength(2);
  });

  it('does not merge into a discrete step recorded just before it', () => {
    const stepped = record(EMPTY_HISTORY, first, 'step');
    const typed = record(stepped, ontology('Ca'), 'coalesce', 'rename:1', 1_000);
    expect(typed.past).toHaveLength(2);
  });

  it('never merges into an empty stack', () => {
    const primed: History = {
      ...EMPTY_HISTORY,
      lastCoalesceKey: 'rename:1',
      lastCoalesceAt: 1_000,
    };
    expect(record(primed, first, 'coalesce', 'rename:1', 1_050).past).toHaveLength(1);
  });
});

describe('undoStep and redoStep', () => {
  const before = ontology('Car');
  const after = ontology('Automobile');

  it('returns null when there is nothing to move to', () => {
    expect(undoStep(EMPTY_HISTORY, after)).toBeNull();
    expect(redoStep(EMPTY_HISTORY, after)).toBeNull();
  });

  it('steps back onto the previous snapshot and banks the current one', () => {
    const history = record(EMPTY_HISTORY, before, 'step');
    const moved = undoStep(history, after);

    expect(moved?.ontology).toBe(before);
    expect(moved?.history.past).toHaveLength(0);
    expect(moved?.history.future).toEqual([after]);
  });

  it('round-trips back to where it started', () => {
    const history = record(EMPTY_HISTORY, before, 'step');
    const undone = undoStep(history, after);
    const redone = redoStep(undone?.history as History, undone?.ontology as Ontology);

    expect(redone?.ontology).toBe(after);
    expect(redone?.history.past).toEqual([before]);
    expect(redone?.history.future).toHaveLength(0);
  });

  it('ends any run of coalescing edits, so typing afterwards starts a new entry', () => {
    const typed = record(EMPTY_HISTORY, before, 'coalesce', 'rename:1', 1_000);
    const moved = undoStep(typed, after);
    expect(moved?.history.lastCoalesceKey).toBeNull();
  });
});
