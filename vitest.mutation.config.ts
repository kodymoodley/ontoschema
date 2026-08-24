import { defineConfig } from 'vitest/config';

/**
 * The unit tier on its own, for mutation testing.
 *
 * Stryker's vitest runner takes a config file but not a project name, and running every tier
 * against every mutant would multiply an already slow job by the jsdom suites — which cover the
 * panels, not the pure layers being mutated.
 *
 * **So `NoCoverage` in the report means "no unit test", not "no test at all."** The integration
 * tier drives these same two layers through the store and is not here: it needs jsdom, and adding
 * it makes Stryker's own dry run fail before a single mutant is tried. Read a no-coverage mutant
 * as a line whose only cover is a heavier tier, and check before concluding it is untested — this
 * comment exists because that conclusion was drawn once and was wrong.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/serialization/*.test.ts', 'src/ontologymodel/*.test.ts'],
  },
});
