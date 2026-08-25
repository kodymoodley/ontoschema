import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openApp, openExamples, settledViewport } from './ontoschema';

/**
 * Finding something in a schema too big to scan.
 *
 * The examples are the right corpus for this: the Music library has thirteen classes and their
 * definitions, which is where the taxonomy tree stops being a way to find anything.
 */

async function musicLibrary(page: Page) {
  await openApp(page);
  await openExamples(page);
  await page.getByText('Music library').click();
  await expect(page.locator('[data-class-name="Album"]')).toBeVisible();
}

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Find an entity' });

test('opens on Ctrl+K, finds a class, and lands on it with its details showing', async ({
  page,
}) => {
  await musicLibrary(page);
  await page.keyboard.press('Control+k');
  await expect(dialog(page)).toBeVisible();

  await page.getByLabel('Search by name or description').fill('venue');
  await expect(page.locator('[data-result]').first()).toContainText('Venue');
  await page.locator('[data-result="Venue"]').click();

  // Choosing closes the dialog and selects the entity, and selecting is what opens the inspector.
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByLabel('Class local name')).toHaveValue('Venue');
});

/*
 * Finding a thing takes you to it. Selecting alone leaves the canvas wherever it was, which on a
 * schema big enough to need searching means the thing you just found is off screen.
 */
test('brings the class it found into focus on the canvas', async ({ page }) => {
  await musicLibrary(page);
  await page.locator('.react-flow__controls-fitview').click();
  const before = await settledViewport(page);

  await page.keyboard.press('Control+k');
  await page.getByLabel('Search by name or description').fill('Venue');
  await page.locator('[data-result="Venue"]').click();

  await expect(dialog(page)).toBeHidden();
  const after = await settledViewport(page);
  expect(after, 'the viewport never moved').not.toBe(before);

  // The same framing a double-click gives: the class centred and filling a third of the canvas.
  const canvas = (await page.getByTestId('schema-canvas').boundingBox())!;
  const node = (await page.locator('[data-class-name="Venue"]').boundingBox())!;
  const share = (node.width * node.height) / (canvas.width * canvas.height);
  expect(share, `Venue filled ${(share * 100).toFixed(0)}% of the canvas`).toBeGreaterThan(0.25);
});

/*
 * A relation has no box of its own -- it is an edge -- so the canvas goes to a class that
 * carries it, while the relation itself stays selected and in the inspector.
 */
test('goes to a class that carries the relation it found', async ({ page }) => {
  await musicLibrary(page);
  await page.locator('.react-flow__controls-fitview').click();
  const before = await settledViewport(page);

  await page.keyboard.press('Control+k');
  await page.getByLabel('Search by name or description').fill('performedBy');
  await page.locator('[data-result="performedBy"]').click();

  const after = await settledViewport(page);
  expect(after, 'the viewport never moved').not.toBe(before);
  // Still the relation being inspected, not the class it was reached through.
  await expect(page.getByLabel('Relation local name')).toHaveValue('performedBy');
});

test('is reachable without knowing the shortcut', async ({ page }) => {
  await musicLibrary(page);
  await page.getByTestId('open-search').click();
  await expect(dialog(page)).toBeVisible();
});

test('finds a relation by half its name, and says what kind it is', async ({ page }) => {
  await musicLibrary(page);
  await page.getByTestId('open-search').click();
  await page.getByLabel('Search by name or description').fill('performed');

  /*
   * The example has `performedBy` and `performedOn`, one a relation and one an attribute, and
   * both match `performed` exactly as well. Which wins the tie is arbitrary and not worth
   * asserting; that both are found and each says what it is, is the point.
   */
  await expect(page.locator('[data-result="performedBy"]')).toContainText('Relation');
  await expect(page.locator('[data-result="performedOn"]')).toContainText('Attribute');
});

test('says so when nothing matches, rather than showing an empty list', async ({ page }) => {
  await musicLibrary(page);
  await page.getByTestId('open-search').click();
  await page.getByLabel('Search by name or description').fill('aardvark');

  await expect(dialog(page)).toContainText('Nothing matches');
  await expect(page.locator('[data-result]')).toHaveCount(0);
});

/*
 * Ctrl+K is the one global shortcut that fires while typing. A name field is exactly where you
 * notice you have lost track of something, and having to click away first would defeat it.
 */
test('opens even while a field has the keyboard', async ({ page }) => {
  // One class of our own rather than an example: this is about the shortcut, and the example's
  // nodes overlap each other on some engines, which has nothing to do with what is being tested.
  await openApp(page);
  await page.locator('[data-palette-kind="class"]').click();
  await page.getByLabel('Class local name').click();

  await page.keyboard.press('Control+k');
  await expect(dialog(page)).toBeVisible();
});
