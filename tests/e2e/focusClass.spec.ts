import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  addAttribute,
  doubleClickClass,
  openApp,
  selectClass,
  settledViewport,
} from './ontoschema';

/**
 * Double-clicking a class brings it into focus. The measurements here are taken from the
 * real rendered canvas, because the point of the feature is what it looks like on screen.
 */

/** Waits for the zoom animation to settle, then measures. */
async function measure(page: Page, className: string) {
  await settledViewport(page);
  const node = await page.locator(`[data-class-name="${className}"]`).boundingBox();
  const canvas = await page.getByTestId('schema-canvas').boundingBox();
  if (!node || !canvas) throw new Error('could not measure');

  return {
    node,
    canvas,
    areaShare: (node.width * node.height) / (canvas.width * canvas.height),
    /** How far the node's centre sits from the canvas centre, as a share of canvas size. */
    offCentreX: Math.abs(node.x + node.width / 2 - (canvas.x + canvas.width / 2)) / canvas.width,
    offCentreY: Math.abs(node.y + node.height / 2 - (canvas.y + canvas.height / 2)) / canvas.height,
  };
}

async function transform(page: Page) {
  return page.locator('.react-flow__viewport').getAttribute('style');
}

async function schemaWithTwoClasses(page: Page) {
  await openApp(page);
  await page.getByTestId('open-examples').click();
  await page.getByText('Music library', { exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.react-flow__controls-fitview').click();
  await settledViewport(page);
}

test('fills 30–40% of the canvas and centres the class', async ({ page }) => {
  await schemaWithTwoClasses(page);

  await doubleClickClass(page, 'Track');
  const after = await measure(page, 'Track');

  expect(after.areaShare).toBeGreaterThanOrEqual(0.3);
  expect(after.areaShare).toBeLessThanOrEqual(0.4);
  // Centred to within a couple of percent of the canvas in each direction.
  expect(after.offCentreX).toBeLessThan(0.03);
  expect(after.offCentreY).toBeLessThan(0.03);
});

test('works for a small class and a large one alike', async ({ page }) => {
  await schemaWithTwoClasses(page);

  // Genre carries two attributes; Track carries six, so the boxes differ in height.
  for (const className of ['Genre', 'Track']) {
    await page.locator('.react-flow__controls-fitview').click();
    await settledViewport(page);
    await doubleClickClass(page, className);
    const after = await measure(page, className);

    expect(after.areaShare, `${className} area`).toBeGreaterThanOrEqual(0.3);
    expect(after.areaShare, `${className} area`).toBeLessThanOrEqual(0.4);
    expect(after.offCentreX, `${className} x`).toBeLessThan(0.03);
  }
});

test('selects the class it focuses, so the inspector follows', async ({ page }) => {
  await schemaWithTwoClasses(page);
  await doubleClickClass(page, 'Venue');
  await expect(page.getByLabel('Class local name')).toHaveValue('Venue');
});

test('moves the viewport rather than the class', async ({ page }) => {
  await schemaWithTwoClasses(page);
  const before = await transform(page);

  await doubleClickClass(page, 'Playlist');

  expect(await settledViewport(page)).not.toBe(before);
  // Focusing is a view change; nothing about the schema may alter.
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
  const turtle = await page.evaluate(() => document.title);
  expect(turtle).toBeTruthy();
});

test('focusing a second class moves on to it', async ({ page }) => {
  await schemaWithTwoClasses(page);

  await doubleClickClass(page, 'Album');
  const first = await measure(page, 'Album');
  expect(first.areaShare).toBeGreaterThanOrEqual(0.3);

  /*
   * Zoomed in on one class, the rest of the schema is off screen — which is the point. Fit
   * the view back the way a user would before picking the next one.
   */
  await page.locator('.react-flow__controls-fitview').click();
  await settledViewport(page);

  await doubleClickClass(page, 'Concert');
  const second = await measure(page, 'Concert');
  expect(second.areaShare).toBeGreaterThanOrEqual(0.3);
  expect(second.areaShare).toBeLessThanOrEqual(0.4);
  expect(second.offCentreX).toBeLessThan(0.03);
});

test('the same class can be focused twice in a row', async ({ page }) => {
  await schemaWithTwoClasses(page);

  await doubleClickClass(page, 'Genre');
  await settledViewport(page);
  await page.locator('.react-flow__controls-fitview').click();
  await settledViewport(page);

  // The request is cleared once acted on, so the second gesture must work like the first.
  await doubleClickClass(page, 'Genre');
  const after = await measure(page, 'Genre');
  expect(after.areaShare).toBeGreaterThanOrEqual(0.3);
});

test('double-clicking the header still renames instead of zooming', async ({ page }) => {
  await schemaWithTwoClasses(page);
  const before = await transform(page);

  await page.locator('[data-class-name="Venue"] header').dblclick();

  await expect(page.getByLabel('Class name')).toBeVisible();
  await page.waitForTimeout(500);
  expect(await transform(page)).toBe(before);
});

test('a freshly drawn class can be focused too', async ({ page }) => {
  await openApp(page);
  await page.locator('[data-palette-kind="class"]').click();
  await page.locator('[data-class-node-id]').first().locator('header').dblclick();
  await page.getByLabel('Class name').fill('Car');
  await page.getByLabel('Class name').press('Enter');
  await selectClass(page, 'Car');
  await addAttribute(page, 'make', 'string');

  await doubleClickClass(page, 'Car');
  const after = await measure(page, 'Car');
  expect(after.areaShare).toBeGreaterThanOrEqual(0.3);
  expect(after.areaShare).toBeLessThanOrEqual(0.4);
});

test('works on a narrow viewport, where the canvas is the whole width', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 800 });
  await schemaWithTwoClasses(page);

  await doubleClickClass(page, 'Track');
  const after = await measure(page, 'Track');

  expect(after.areaShare).toBeGreaterThanOrEqual(0.3);
  expect(after.areaShare).toBeLessThanOrEqual(0.4);
  expect(after.offCentreX).toBeLessThan(0.03);
});
