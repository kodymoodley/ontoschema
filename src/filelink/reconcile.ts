/**
 * What to do about a schema linked to a file, given how each side looks now.
 *
 * Two questions decide it: has the schema been edited here since the two last agreed, and has
 * the file changed on disk since then? Each is answered against its own record of the last
 * agreement, never by comparing the schema with the file directly. A file written by hand or by
 * another tool is laid out differently from the way this app would write the same schema, so
 * comparing the two would call every such file "changed" and rewrite it on sight — and the rule
 * is that nothing is written until somebody edits something.
 *
 * Pure, so every combination can be tested without a file, a browser or a clock.
 */

export interface SyncState {
  /** The schema as it would be written now. */
  local: string;
  /** The schema as it would have been written when this app and the file last agreed. */
  baseline: string;
  /** The file's text now, or `null` when the file has gone. */
  disk: string | null;
  /** The file's text when this app and the file last agreed. */
  synced: string;
}

export type Reconciliation =
  /** Nothing to do; record that the two agree. */
  | 'in-sync'
  /** Edited here only: write the schema to the file. */
  | 'write'
  /** Changed on disk only, by `git pull` or another editor: read the file back. */
  | 'reload'
  /** Both changed, differently. Not this app's to settle: ask. */
  | 'conflict'
  /** The file was moved, renamed or deleted. */
  | 'missing';

export function reconcile({ local, baseline, disk, synced }: SyncState): Reconciliation {
  if (disk === null) return 'missing';

  const editedHere = local !== baseline;
  const changedOnDisk = disk !== synced;

  // Both sides moved to the same text: a colleague made the same change, or git brought back
  // exactly what was written here. There is nothing to settle.
  if (editedHere && changedOnDisk) return disk === local ? 'in-sync' : 'conflict';
  if (editedHere) return 'write';
  if (changedOnDisk) return 'reload';
  return 'in-sync';
}
