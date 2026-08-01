import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSaveQueue } from './savequeue';
import type { Workspace } from './workspace';

/**
 * The batching that stops every keystroke serialising the whole workspace. What matters is
 * that a burst costs one write of the *final* state, that nothing is left unwritten
 * indefinitely, and that a flush is always safe to call.
 */

/** Workspaces are opaque here — the queue never looks inside one — so a label is enough. */
const workspace = (label: string) => ({ projects: [], activeProjectId: label }) as Workspace;
const labels = (calls: Workspace[]) => calls.map((entry) => entry.activeProjectId);

describe('createSaveQueue', () => {
  let written: Workspace[];
  let write: (value: Workspace) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    written = [];
    write = (value) => written.push(value);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes nothing until the edits stop', () => {
    const queue = createSaveQueue(write, 500, 2_000);
    queue.save(workspace('a'));

    vi.advanceTimersByTime(499);
    expect(written).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(labels(written)).toEqual(['a']);
  });

  it('collapses a burst into one write of the final state', () => {
    const queue = createSaveQueue(write, 500, 2_000);
    for (const label of ['a', 'b', 'c', 'd']) {
      queue.save(workspace(label));
      vi.advanceTimersByTime(50);
    }

    vi.advanceTimersByTime(500);
    expect(labels(written)).toEqual(['d']);
  });

  it('writes anyway when edits never pause, and keeps doing so', () => {
    const queue = createSaveQueue(write, 500, 2_000);

    // A keystroke every 100ms for six seconds: the delay never elapses on its own.
    for (let tick = 0; tick < 60; tick += 1) {
      queue.save(workspace(`tick${tick}`));
      vi.advanceTimersByTime(100);
    }

    // Roughly one write per max-delay window, rather than none at all or one per keystroke.
    expect(written.length).toBeGreaterThanOrEqual(2);
    expect(written.length).toBeLessThanOrEqual(5);
  });

  it('flushes on demand, and cancels the write it had scheduled', () => {
    const queue = createSaveQueue(write, 500, 2_000);
    queue.save(workspace('a'));
    queue.flush();

    expect(labels(written)).toEqual(['a']);

    // The scheduled timer must not fire a second, duplicate write.
    vi.advanceTimersByTime(1_000);
    expect(labels(written)).toEqual(['a']);
  });

  it('does nothing when flushed with nothing pending', () => {
    const queue = createSaveQueue(write, 500, 2_000);
    queue.flush();
    queue.flush();
    expect(written).toEqual([]);
  });

  it('schedules again after a flush', () => {
    const queue = createSaveQueue(write, 500, 2_000);
    queue.save(workspace('a'));
    queue.flush();

    queue.save(workspace('b'));
    vi.advanceTimersByTime(500);
    expect(labels(written)).toEqual(['a', 'b']);
  });

  it('drops a failed write rather than re-throwing on every later flush', () => {
    const queue = createSaveQueue(() => {
      throw new Error('quota exceeded');
    }, 500);

    queue.save(workspace('a'));
    expect(() => queue.flush()).toThrow('quota exceeded');
    // Nothing is pending now, so the next flush is quiet.
    expect(() => queue.flush()).not.toThrow();
  });

  it('keeps two queues independent', () => {
    const otherWrites: Workspace[] = [];
    const first = createSaveQueue(write, 500, 2_000);
    const second = createSaveQueue((value) => otherWrites.push(value), 500, 2_000);

    first.save(workspace('a'));
    second.save(workspace('b'));
    vi.advanceTimersByTime(500);

    expect(labels(written)).toEqual(['a']);
    expect(labels(otherWrites)).toEqual(['b']);
  });
});
