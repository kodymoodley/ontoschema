import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Unit tests run in Node (the domain model and serializers are pure, so they need no DOM).
 * Integration tests get a DOM because they exercise the store, which touches localStorage.
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
          name: 'integration',
          environment: 'jsdom',
          include: ['tests/integration/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/ontologymodel/**', 'src/serialization/**', 'src/projectstore/**'],
    },
  },
});
