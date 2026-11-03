/**
 * Batches writes of a value that changes faster than it is worth writing: the workspace to
 * `localStorage`, and a linked schema to its file.
 *
 * Persisting means serialising every project, which is expensive enough at real sizes to be
 * felt: a seven-character rename used to write 1.4MB across seven separate passes, and cost
 * four dropped frames per keystroke. Only ever one value is pending — a later save
 * supersedes an earlier one rather than queueing behind it — so a burst of edits costs a
 * single write of the final state.
 *
 * `maxDelayMs` bounds how long unsaved work can exist. Without it, typing without pause would
 * postpone the write for as long as the typing lasted, and a crash would take the lot.
 */

/** How long the edits have to stop before the write goes out. */
export const SAVE_DELAY_MS = 500;

/** However fast the edits keep coming, never leave work unwritten for longer than this. */
export const SAVE_MAX_DELAY_MS = 2_000;

export interface SaveQueue<T> {
  /** Records a value as the one to write, and schedules the write. */
  save(value: T): void;
  /** Writes whatever is outstanding, now. Does nothing if nothing is pending. */
  flush(): void;
}

export function createSaveQueue<T>(
  write: (value: T) => void,
  delayMs: number = SAVE_DELAY_MS,
  maxDelayMs: number = SAVE_MAX_DELAY_MS,
): SaveQueue<T> {
  let pending: T | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingSince = 0;

  function flush(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending === null) return;

    const value = pending;
    // Cleared before writing, so a write that throws does not leave the same value
    // pending and re-throwing on every later flush.
    pending = null;
    write(value);
  }

  function save(value: T): void {
    if (pending === null) pendingSince = Date.now();
    pending = value;

    if (Date.now() - pendingSince >= maxDelayMs) {
      flush();
      return;
    }

    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  }

  return { save, flush };
}
