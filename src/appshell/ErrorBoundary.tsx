import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { flushWorkspace } from '../projectstore';

/**
 * Keeps a render error from blanking the whole app.
 *
 * Storage writes are batched, so at the moment of a crash the last few seconds of edits may
 * still be sitting in the queue. They are written out here before anything else: the panel
 * tells the user their work is safe, and that has to be true when it says it rather than a
 * second later.
 */
interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Before logging, before rendering: a second crash while reporting the first must not be
    // what loses the work.
    flushWorkspace();
    console.error('OntoSchema crashed while rendering', error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" className="crashPanel">
        <h1>Something went wrong</h1>
        <p>
          Your ontology is saved in this browser and has not been lost. Reloading should bring it
          back.
        </p>
        <pre>{error.message}</pre>
        <button type="button" onClick={() => window.location.reload()}>
          Reload OntoSchema
        </button>
      </div>
    );
  }
}
