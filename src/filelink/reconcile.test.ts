import { describe, expect, it } from 'vitest';
import { reconcile } from './reconcile';

/**
 * The texts are labels, not documents: `reconcile` only ever compares them for equality.
 * `ours` is how this app writes the schema; `file` is the file as it was last read, which may be
 * laid out quite differently by whoever wrote it.
 */
const agreed = { baseline: 'ours', synced: 'file' } as const;

describe('reconciling a schema with its file', () => {
  it('does nothing when neither side has changed', () => {
    expect(reconcile({ ...agreed, local: 'ours', disk: 'file' })).toBe('in-sync');
  });

  /*
   * The rule that keeps `git status` clean: a file laid out differently from the way this app
   * would write it is not rewritten just because it was opened.
   */
  it('does not rewrite a file just because this app would lay it out differently', () => {
    expect(reconcile({ baseline: 'ours', synced: 'theirs', local: 'ours', disk: 'theirs' })).toBe(
      'in-sync',
    );
  });

  it('writes when the schema was edited here and the file is as it was', () => {
    expect(reconcile({ ...agreed, local: 'edited', disk: 'file' })).toBe('write');
  });

  it('reads the file back when it changed on disk and nothing was edited here', () => {
    expect(reconcile({ ...agreed, local: 'ours', disk: 'pulled' })).toBe('reload');
  });

  it('asks when both changed, differently', () => {
    expect(reconcile({ ...agreed, local: 'edited', disk: 'pulled' })).toBe('conflict');
  });

  it('calls it agreement when both changed to the same text', () => {
    expect(reconcile({ ...agreed, local: 'same', disk: 'same' })).toBe('in-sync');
  });

  it('reports a file that has gone, whatever else is true', () => {
    expect(reconcile({ ...agreed, local: 'ours', disk: null })).toBe('missing');
    expect(reconcile({ ...agreed, local: 'edited', disk: null })).toBe('missing');
  });
});
