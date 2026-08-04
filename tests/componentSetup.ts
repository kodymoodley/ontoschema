import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { useProjectStore } from '../src/projectstore';
import { createProject } from '../src/ontologymodel';

/**
 * Component tests drive the real store, so each one needs a clean workspace. The store is a
 * module singleton — exactly as it is in the browser — so it is reset rather than mocked.
 */
beforeEach(() => {
  globalThis.localStorage?.clear();
  const project = createProject('Test project');
  useProjectStore.setState({
    projects: [project],
    activeProjectId: project.id,
    selection: null,
    view: 'schema',
    history: { past: [], future: [], lastCoalesceKey: null, lastCoalesceAt: 0 },
    pendingConnection: null,
  });
});

afterEach(() => {
  cleanup();
});
