import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

/**
 * Keeps a render error from blanking the whole app.
 *
 * The ontology itself is safe — it is persisted on every edit — so the useful thing to do
 * is say so plainly and offer a reload, rather than leaving the user staring at a white
 * page wondering whether they have lost their work.
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
