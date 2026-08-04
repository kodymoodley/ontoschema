import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Unit tests run in Node (the domain model and serializers are pure, so they need no DOM).
 * Component tests render real React against the real store — the tier that catches focus,
 * keyboard and re-render defects, which neither a pure unit test nor an end-to-end test
 * reaches economically. Integration tests get a DOM because the store touches localStorage.
 * End-to-end tests are Playwright's job and live outside vitest entirely.
 */
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./tests/componentSetup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'jsdom',
          include: ['tests/integration/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/**/index.ts'],
      /*
       * A ratchet, not an aspiration: these sit just under what the suite achieves today, so
       * CI fails on a regression rather than failing on day one and being switched off. Raise
       * them when coverage rises; never lower them.
       *
       * The global figure is held down by the React Flow canvases and the app shell, which
       * are covered by the Playwright tier instead — rendering a real canvas in jsdom proves
       * very little. The pure layers are held far higher, where there is no such excuse.
       */
      thresholds: {
        lines: 66,
        functions: 69,
        branches: 55,
        statements: 64,
        'src/ontologymodel/**': { lines: 92, functions: 88, branches: 76, statements: 88 },
        'src/serialization/**': { lines: 88, functions: 88, branches: 78, statements: 86 },
        'src/projectstore/**': { lines: 83, functions: 88, branches: 62, statements: 78 },
      },
    },
  },
});
