import { defineConfig } from 'vitest/config';

/**
 * The unit tier on its own, for mutation testing.
 *
 * Stryker's vitest runner takes a config file but not a project name, and running every tier
 * against every mutant would multiply an already slow job by the jsdom suites — which cover the
 * panels, not the pure layers being mutated.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/serialization/*.test.ts', 'src/ontologymodel/*.test.ts'],
  },
});
