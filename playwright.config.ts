import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;

export default defineConfig({
  testDir: './tests/e2e',
  /*
   * The timing suite is excluded here and run on its own by `playwright.perf.config.ts`.
   * These specs run eight at a time across three engines, which is the right way to check
   * behaviour and hopeless for checking milliseconds: measured under that load, a keystroke
   * that costs nothing on a quiet machine reads as 171ms.
   */
  testIgnore: '**/scale.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  /*
   * A test that fails and then passes on a retry is reported as "flaky", and by default the run
   * still counts as a success. So an intermittent failure returning would appear as one line of
   * text inside a green run, and nobody would be told about it.
   *
   * The retries stay, because a retried failure still records a trace and that is what makes it
   * possible to diagnose later. What changes is that the run now fails, so the fact reaches
   * someone. This matters here specifically: a WebKit flake was open for weeks and then stopped
   * without anyone finding the cause, so the only defence against its return is being told.
   */
  failOnFlakyTests: Boolean(process.env.CI),
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Downloads are part of what these tests assert, so they must land on disk.
    acceptDownloads: true,
  },

  /*
   * Three engines, because the app leans on things they disagree about: HTML5 drag and
   * drop, pointer capture during a connection drag, blob downloads, and `:has()`/`color-mix`
   * in the design tokens. Chromium runs everything; Firefox and WebKit run the same suite so
   * a divergence shows up here rather than in someone's browser.
   */
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  /*
   * Serves the built output, not the dev server. Testing the dev server would leave
   * anything that only breaks under minification, CSS-Modules hashing or tree-shaking free
   * to ship green — the end-to-end suite has to exercise what actually gets deployed.
   */
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
