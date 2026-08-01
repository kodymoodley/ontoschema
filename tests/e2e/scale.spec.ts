import { expect, test } from '@playwright/test';
import { buildLarge } from '../fixtures/scenarios';
import { openApp, selectClass } from './ontoschema';
import { seedWorkspace } from './seedWorkspace';
import {
  recordStorageWrites,
  startRecordingFrames,
  stopRecordingFrames,
  storageWrites,
} from './measure';

/**
 * How the editor behaves on a schema the size of real work: 200 classes, 200 attributes and
 * 199 relations. The pure model and the serializers are already covered at this size by the
 * scenario tests; nothing above them ever has been.
 *
 * The budgets are ceilings a regression would breach, not targets, and they are set from what
 * was measured rather than guessed. Each test also reports its numbers, so a change of shape
 * is visible even while a budget still passes. Where a ceiling records a cost that ought to
 * come down, it says so, and the commit that brings it down tightens it.
 *
 * Measured on this machine at 200 classes: 405ms to open, a steady 16.7ms frame through pan
 * and zoom, 67ms of main thread lost to one keystroke, and 194kB of JSON written to storage
 * per keystroke.
 */

const CLASS_COUNT = 200;

// Measured on one engine on purpose. Cross-browser correctness is covered by the other specs;
// a timing budget checked in three engines on shared CI hardware is three times the flakiness
// for no extra signal.
test.skip(({ browserName }) => browserName !== 'chromium', 'timing is measured on chromium only');

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await seedWorkspace(page, 'Large schema', buildLarge(CLASS_COUNT));
});

test('opens and renders every class', async ({ page }) => {
  const started = Date.now();
  await openApp(page);
  await expect(page.locator('[data-class-node-id]')).toHaveCount(CLASS_COUNT);
  const elapsed = Date.now() - started;

  console.log(`open: ${elapsed}ms to render ${CLASS_COUNT} classes`);
  expect(elapsed).toBeLessThan(8_000);

  // Loading went through the real persisted format, so the whole schema survived the trip.
  await expect(page.getByTestId('schema-canvas')).toBeVisible();
  await expect(page.locator('[data-class-name="Class0"]')).toBeVisible();
});

test('stays responsive while panning', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('[data-class-node-id]')).toHaveCount(CLASS_COUNT);

  const canvas = await page.getByTestId('schema-canvas').boundingBox();
  if (!canvas) throw new Error('canvas not visible');
  const from = { x: canvas.x + canvas.width * 0.7, y: canvas.y + canvas.height * 0.7 };

  await startRecordingFrames(page);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let step = 1; step <= 30; step += 1) {
    await page.mouse.move(from.x - step * 12, from.y - step * 8);
  }
  await page.mouse.up();
  const report = await stopRecordingFrames(page);

  console.log(
    `pan: ${report.frames} frames, median ${report.median.toFixed(1)}ms, ` +
      `p95 ${report.p95.toFixed(1)}ms, worst ${report.worst.toFixed(1)}ms`,
  );
  // Panning moves a CSS transform rather than re-rendering, and it shows: every frame lands
  // on the 60Hz budget. The ceiling is loose enough to survive a busy CI machine and tight
  // enough to catch a change that starts re-rendering nodes as the viewport moves.
  expect(report.frames).toBeGreaterThan(10);
  expect(report.p95).toBeLessThan(60);
});

test('stays responsive while zooming', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('[data-class-node-id]')).toHaveCount(CLASS_COUNT);

  const canvas = await page.getByTestId('schema-canvas').boundingBox();
  if (!canvas) throw new Error('canvas not visible');
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);

  await startRecordingFrames(page);
  for (let step = 0; step < 12; step += 1) await page.mouse.wheel(0, -120);
  await page.waitForTimeout(300);
  const report = await stopRecordingFrames(page);

  console.log(
    `zoom: ${report.frames} frames, median ${report.median.toFixed(1)}ms, ` +
      `p95 ${report.p95.toFixed(1)}ms, worst ${report.worst.toFixed(1)}ms`,
  );
  expect(report.frames).toBeGreaterThan(10);
  expect(report.p95).toBeLessThan(60);
});

test('a single edit does not stall the main thread', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('[data-class-node-id]')).toHaveCount(CLASS_COUNT);
  await selectClass(page, 'Class0');

  const name = page.getByLabel('Class local name');
  await name.click();

  await startRecordingFrames(page);
  await name.press('X');
  await page.waitForTimeout(400);
  const report = await stopRecordingFrames(page);

  console.log(`one keystroke: worst frame gap ${report.worst.toFixed(1)}ms`);
  await expect(page.locator('[data-class-name="Class0X"]')).toBeVisible();

  // 67ms is four dropped frames for one character, and this ceiling records that rather than
  // blessing it. Lower it once the edit path stops serialising the workspace on every stroke.
  expect(report.worst).toBeLessThan(250);
});

test('reports what a rename costs in storage writes', async ({ page }) => {
  await recordStorageWrites(page);
  await openApp(page);
  await expect(page.locator('[data-class-node-id]')).toHaveCount(CLASS_COUNT);
  await selectClass(page, 'Class0');

  const before = (await storageWrites(page)).length;
  await page.getByLabel('Class local name').click();
  await page.getByLabel('Class local name').pressSequentially('Renamed', { delay: 30 });
  await expect(page.locator('[data-class-name="Class0Renamed"]')).toBeVisible();

  const writes = (await storageWrites(page)).slice(before);
  const bytes = writes.reduce((total, write) => total + write.bytes, 0);
  console.log(
    `rename of 7 characters: ${writes.length} storage writes, ` +
      `${(bytes / 1024).toFixed(0)}kB serialised in total`,
  );

  /*
   * One write per keystroke, each serialising every project in the workspace: 194kB of JSON
   * for a single character. Recorded, not blessed — both ceilings come down when the edit
   * path is debounced and narrowed to the project that changed.
   */
  expect(writes.length).toBeGreaterThan(0);
  expect(writes.length).toBeLessThanOrEqual(10);
  expect(bytes).toBeLessThan(3 * 1024 * 1024);
});
