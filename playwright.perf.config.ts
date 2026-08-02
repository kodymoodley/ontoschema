import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/**
 * The timing suite, run on its own.
 *
 * Measuring milliseconds requires a machine that is not doing anything else, so this config
 * takes one worker and one engine. Correctness across the three engines is the other config's
 * job; nothing here asserts behaviour that browsers disagree about.
 */
export default defineConfig({
  ...base,
  testIgnore: undefined,
  testMatch: '**/scale.spec.ts',
  fullyParallel: false,
  workers: 1,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
