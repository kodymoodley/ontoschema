import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  addAttribute,
  doubleClickClass,
  dragFromPalette,
  openApp,
  openExamples,
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

  /*
   * The zoom the viewport actually settled at, and the node's size in the coordinates the app
   * places it in. Carried so a failure says why rather than only that it happened: this test has
   * failed twice on WebKit at 0.289 and 0.297 against a floor of 0.30, has never reproduced on
   * a developer machine, and the numbers below separate the two candidate explanations. A zoom
   * short of what `focusZoom` would return means the animation was measured before it finished;
   * a correct zoom over an unexpected node size means the app framed a box of the wrong height.
   */
  const zoom = Number(
    /scale\(([\d.]+)\)/.exec(
      (await page.locator('.react-flow__viewport').getAttribute('style')) ?? '',
    )?.[1] ?? NaN,
  );

  return {
    node,
    canvas,
    zoom,
    /** The node as the model holds it, with the viewport's scale taken back out. */
    unscaled: { width: node.width / zoom, height: node.height / zoom },
    areaShare: (node.width * node.height) / (canvas.width * canvas.height),
    /** How far the node's centre sits from the canvas centre, as a share of canvas size. */
    offCentreX: Math.abs(node.x + node.width / 2 - (canvas.x + canvas.width / 2)) / canvas.width,
    offCentreY: Math.abs(node.y + node.height / 2 - (canvas.y + canvas.height / 2)) / canvas.height,
  };
}

/** Everything a failed area assertion needs to be diagnosed from a CI log alone. */
function explain(className: string, m: Awaited<ReturnType<typeof measure>>): string {
  const ideal = Math.sqrt(
    (0.35 * m.canvas.width * m.canvas.height) / (m.unscaled.width * m.unscaled.height),
  );
  return (
    `${className}: area ${m.areaShare.toFixed(4)} at zoom ${m.zoom.toFixed(4)} ` +
    `(focusZoom would ask for ${ideal.toFixed(4)}); ` +
    `node ${Math.round(m.unscaled.width)}x${Math.round(m.unscaled.height)} unscaled, ` +
    `canvas ${Math.round(m.canvas.width)}x${Math.round(m.canvas.height)}`
  );
}

async function transform(page: Page) {
  return page.locator('.react-flow__viewport').getAttribute('style');
}

async function schemaWithTwoClasses(page: Page) {
  await openApp(page);
  await openExamples(page);
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

    expect(after.areaShare, explain(className, after)).toBeGreaterThanOrEqual(0.3);
    expect(after.areaShare, explain(className, after)).toBeLessThanOrEqual(0.4);
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

test('double-clicking the name renames instead of zooming', async ({ page }) => {
  await schemaWithTwoClasses(page);
  const before = await transform(page);

  await page.locator('[data-class-name="Venue"] header [title]').dblclick();

  await expect(page.getByLabel('Class name')).toBeVisible();
  await page.waitForTimeout(500);
  expect(await transform(page)).toBe(before);
});

/**
 * The rest of the header is the room this gesture never had. Every part of a class used to answer
 * a double-click with something else — the header renamed the class, each attribute row renamed
 * that property — leaving only the footer, which got smaller in proportion as the class grew.
 * Renaming belongs to the name itself now, so the strip beside it zooms like the node it sits in.
 */
test('double-clicking the header beside the name zooms rather than renaming', async ({ page }) => {
  await schemaWithTwoClasses(page);

  const header = await page.locator('[data-class-name="Venue"] header').boundingBox();
  const name = await page.locator('[data-class-name="Venue"] header [title]').boundingBox();
  if (!header || !name) throw new Error('could not measure the header');

  // Midway between the end of the name and the right edge of the header.
  const x = (name.x + name.width + header.x + header.width) / 2;
  expect(x, 'the name should not fill the header').toBeGreaterThan(name.x + name.width);

  const before = await transform(page);
  await page.mouse.dblclick(x, header.y + header.height / 2);

  await expect(page.getByLabel('Class name')).toHaveCount(0);
  await expect.poll(() => transform(page)).not.toBe(before);
});

test('a class can be focused the instant it is drawn, with nothing in it yet', async ({ page }) => {
  await openApp(page);
  await dragFromPalette(page, 'class', { x: 200, y: 200 });
  await expect(page.locator('[data-class-node-id]')).toHaveCount(1);

  /*
   * No pause, no attribute, no rename. React Flow needs a frame or two to adopt a new node
   * and measure it, and a class dropped and immediately double-clicked lands inside that
   * window — where the gesture used to be answered with nothing at all.
   */
  await doubleClickClass(page, 'NewClass');

  /*
   * The band is asserted here like everywhere else. It used to be left out: the zoom was
   * computed from the 100px a new empty class estimates rather than the 131px it renders, so
   * this one class landed near 46% while every other test held. Focus measures the rendered
   * box now, and an empty class is framed like any other.
   */
  const after = await measure(page, 'NewClass');
  expect(after.areaShare).toBeGreaterThanOrEqual(0.3);
  expect(after.areaShare).toBeLessThanOrEqual(0.4);
  expect(after.offCentreX).toBeLessThan(0.03);
  expect(after.offCentreY).toBeLessThan(0.03);
});

test('a freshly drawn class can be focused too', async ({ page }) => {
  await openApp(page);
  await page.locator('[data-palette-kind="class"]').click();
  await page.locator('[data-class-node-id]').first().locator('header [title]').dblclick();
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
