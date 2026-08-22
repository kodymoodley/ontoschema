import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openApp, openExamples } from './ontoschema';

/**
 * The relation layer in the taxonomy view, driven the way someone uses it.
 *
 * The unit tests cover which edges are built. What only a browser answers is whether the
 * control is there, whether it applies to the view it belongs to, and whether the drawn edges
 * actually reach the screen.
 */

// Only the relation edges: React Flow puts a test id on every edge, subclass links included.
const relationEdges = (page: Page) => page.locator('[data-relation-name]');

async function taxonomyOf(page: Page, example: string) {
  await openApp(page);
  await openExamples(page);
  await page.getByText(example).click();
  await page.getByRole('tab', { name: 'Taxonomy' }).click();
}

test('offers the choice only where it applies', async ({ page }) => {
  await openApp(page);
  // The schema view always draws relations, so a control there would be inert.
  await expect(page.getByRole('tab', { name: 'No relations' })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Taxonomy' }).click();
  await expect(page.getByRole('tab', { name: 'No relations' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'No relations' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('draws nothing until asked, then everything', async ({ page }) => {
  await taxonomyOf(page, 'Music library');
  await expect(relationEdges(page)).toHaveCount(0);

  await page.getByRole('tab', { name: 'All' }).click();
  await expect(relationEdges(page).first()).toBeVisible();
});

test('shows only what the selected class connects to', async ({ page }) => {
  await taxonomyOf(page, 'Music library');
  await page.getByRole('tab', { name: 'All' }).click();
  /*
   * Polled rather than counted once. The edges arrive over a frame or two, and reading the
   * count the instant the tab is clicked is a race that passes alone and fails under load.
   */
  await expect.poll(() => relationEdges(page).count()).toBeGreaterThan(1);
  const all = await relationEdges(page).count();

  await page.getByRole('tab', { name: 'Selected', exact: true }).click();
  // Nothing is selected yet, so the middle setting draws nothing at all.
  await expect(relationEdges(page)).toHaveCount(0);

  await page.locator('[data-taxonomy-class="Track"]').first().click();
  await expect.poll(() => relationEdges(page).count()).toBeGreaterThan(0);
  expect(await relationEdges(page).count()).toBeLessThan(all);
});

test('remembers the setting across a trip to the schema view', async ({ page }) => {
  await taxonomyOf(page, 'Music library');
  await page.getByRole('tab', { name: 'All' }).click();

  await page.getByRole('tab', { name: 'Schema' }).click();
  await page.getByRole('tab', { name: 'Taxonomy' }).click();

  await expect(page.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
  await expect(relationEdges(page).first()).toBeVisible();
});
