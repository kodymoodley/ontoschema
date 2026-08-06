import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { STORAGE_KEY, clearWorkspace, useProjectStore } from '../projectstore';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * What happens to unsaved work when a render throws.
 *
 * Storage writes are batched, so an edit made a moment before a crash is still in the queue
 * when the boundary catches. The panel tells the user their ontology is safe, and this is what
 * makes that true.
 */

const store = () => useProjectStore.getState();

function Explodes(): never {
  throw new Error('rendering went wrong');
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  clearWorkspace();
  // React logs a caught error itself; the test is not interested in the noise.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('ErrorBoundary', () => {
  it('writes work that was still queued when the crash happened', () => {
    store().newProject('Crash test');
    const car = store().createClass({ localName: 'Car' });
    store().renameClassById(car, 'Automobile');

    // Nothing has reached storage yet: the write is waiting for the typing to stop.
    expect(globalThis.localStorage.getItem(STORAGE_KEY) ?? '').not.toContain('Automobile');

    render(
      <ErrorBoundary>
        <Explodes />
      </ErrorBoundary>,
    );

    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toContain('Automobile');
  });

  it('says what happened, and offers a way back', () => {
    render(
      <ErrorBoundary>
        <Explodes />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('rendering went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });

  it('leaves a working tree alone', () => {
    render(
      <ErrorBoundary>
        <p>still here</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('still here')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
