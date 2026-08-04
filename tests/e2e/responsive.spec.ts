import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openApp, selectClass } from './ontoschema';

/**
 * The shell is a three-column grid, which crushes the canvas on a laptop and overflows on
 * anything narrower. These pin the two breakpoints: columns get tighter at 1280, and the
 * side panels become drawers at 1024 so the canvas keeps the full width.
 */

const WIDE = { width: 1500, height: 900 };
const LAPTOP = { width: 1200, height: 800 };
const NARROW = { width: 820, height: 800 };

const entities = (page: Page) => page.getByRole('complementary', { name: 'Palette and hierarchy' });
const inspector = (page: Page) => page.getByRole('complementary', { name: 'Inspector' });

test.describe('wide', () => {
  test.use({ viewport: WIDE });

  test('shows all three columns at once, with no drawer toggles', async ({ page }) => {
    await openApp(page);
    await expect(entities(page)).toBeVisible();
    await expect(inspector(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entities' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Inspector' })).toBeHidden();
  });
});

test.describe('laptop', () => {
  test.use({ viewport: LAPTOP });

  test('keeps all three columns and leaves the canvas usable', async ({ page }) => {
    await openApp(page);
    await expect(entities(page)).toBeVisible();
    await expect(inspector(page)).toBeVisible();

    const canvas = await page.getByTestId('schema-canvas').boundingBox();
    // The canvas is the point of the app; it must not be squeezed to a sliver.
    expect(canvas?.width ?? 0).toBeGreaterThan(500);
  });
});

test.describe('narrow', () => {
  test.use({ viewport: NARROW });

  test('gives the canvas the full width and hides the panels behind toggles', async ({ page }) => {
    await openApp(page);

    await expect(entities(page)).toBeHidden();
    await expect(inspector(page)).toBeHidden();
    await expect(page.getByRole('button', { name: 'Entities' })).toBeVisible();

    const canvas = await page.getByTestId('schema-canvas').boundingBox();
    expect(canvas?.width ?? 0).toBeGreaterThan(NARROW.width * 0.9);
  });

  test('never scrolls the page sideways', async ({ page }) => {
    await openApp(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('opens and closes the entities drawer', async ({ page }) => {
    await openApp(page);
    const toggle = page.getByRole('button', { name: 'Entities' });

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(entities(page)).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await toggle.click();
    await expect(entities(page)).toBeHidden();
  });

  test('shows one drawer at a time', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Entities' }).click();
    await expect(entities(page)).toBeVisible();

    await page.getByRole('button', { name: 'Inspector' }).click();
    await expect(inspector(page)).toBeVisible();
    await expect(entities(page)).toBeHidden();
  });

  test('creating from the palette closes the drawer over the canvas', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Entities' }).click();

    // Dragging out of an overlay onto the canvas beneath it is awkward, so the palette's
    // click path is the narrow-viewport route — and it gets out of the way afterwards.
    await page.locator('[data-palette-kind="class"]').click();

    await expect(entities(page)).toBeHidden();
    await expect(page.locator('[data-class-node-id]')).toHaveCount(1);
  });

  test('the whole editing workflow still works', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Entities' }).click();
    await page.locator('[data-palette-kind="class"]').click();

    await page.locator('[data-class-node-id]').first().locator('header').dblclick();
    await page.getByLabel('Class name').fill('Car');
    await page.getByLabel('Class name').press('Enter');

    // Adding an attribute means reaching the inspector, which is a drawer here.
    await selectClass(page, 'Car');
    await page.getByRole('button', { name: 'Inspector' }).click();
    await page.getByLabel('New attribute name').fill('price');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(page.locator('[data-class-name="Car"] [data-attribute-name]')).toHaveCount(1);
  });

  test('a closed drawer is out of the tab order', async ({ page }) => {
    await openApp(page);
    // Nothing inside a hidden drawer should be reachable by keyboard.
    const reachable = await page.evaluate(() => {
      const panel = document.querySelector('[aria-label="Palette and hierarchy"]');
      if (!panel) return true;
      return getComputedStyle(panel).visibility !== 'hidden';
    });
    expect(reachable).toBe(false);
  });
});
