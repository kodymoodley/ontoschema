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
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Anything above this is a mistake worth being told about; `npm run size` enforces the
    // real budget against the gzipped output.
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        /*
         * Split the third-party code out of the app bundle. The vendors change on their own
         * release schedule, so keeping them in separate chunks means an app-only change does
         * not invalidate a returning visitor's cache of React and the canvas engine.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          const path = id.replace(/\\/g, '/');
          // Checked before `react`, because the canvas engine is `@xyflow/react`.
          if (path.includes('@xyflow') || path.includes('dagre')) return 'canvas';
          if (path.includes('/n3/')) return 'rdf';
          /*
           * `scheduler` belongs with React rather than in a catch-all vendor chunk. Splitting
           * them produces a cycle — vendor depends on React, React depends on scheduler in
           * vendor — and Rollup emits a bundle that fails to boot. Everything else is small
           * and stays with the app.
           */
          if (/\/(react|react-dom|scheduler)\//.test(path)) return 'react';
          return undefined;
        },
      },
    },
  },
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
