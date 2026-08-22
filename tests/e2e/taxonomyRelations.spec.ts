import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openApp, openExamples } from './ontoschema';

/**
 * The relation layer in the taxonomy view.
 *
 * One setting, not three: the view draws the selected class's relations, or none. Drawing every
 * relation was tried and dropped — it cost the legibility that makes this view worth having and
 * gave back nothing the schema view does not do better.
 */

// Only the relation edges: React Flow puts a test id on every edge, subclass links included.
const relationEdges = (page: Page) => page.locator('[data-relation-name]');

async function taxonomyOf(page: Page, example: string) {
  await openApp(page);
  await openExamples(page);
  await page.getByText(example).click();
  await page.getByRole('tab', { name: 'Taxonomy' }).click();
}

test('offers the toggle only where it applies, and starts off', async ({ page }) => {
  await openApp(page);
  // The schema view always draws relations, so a toggle there would be inert.
  await expect(page.getByTestId('toggle-relations')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Taxonomy' }).click();
  await expect(page.getByTestId('toggle-relations')).toHaveAttribute('aria-pressed', 'false');
});

test("draws the selected class's relations, and nobody else's", async ({ page }) => {
  await taxonomyOf(page, 'Music library');
  await page.getByTestId('toggle-relations').click();

  // On, but nothing selected, so there is nothing whose relations to draw.
  await expect(relationEdges(page)).toHaveCount(0);

  await page.locator('[data-taxonomy-class="Track"]').first().click();
  await expect.poll(() => relationEdges(page).count()).toBeGreaterThan(0);
  const forTrack = await relationEdges(page).count();

  await page.locator('[data-taxonomy-class="Venue"]').first().click();
  await expect.poll(() => relationEdges(page).count()).not.toBe(forTrack);
});

/*
 * The click that revealed them is the obvious one to put them away with. Hunting for empty
 * canvas instead is the sort of small tax that makes an interface feel stubborn.
 */
test('hides them again when the same class is clicked twice', async ({ page }) => {
  await taxonomyOf(page, 'Music library');
  await page.getByTestId('toggle-relations').click();

  const track = page.locator('[data-taxonomy-class="Track"]').first();
  await track.click();
  await expect.poll(() => relationEdges(page).count()).toBeGreaterThan(0);

  await track.click();
  await expect(relationEdges(page)).toHaveCount(0);
});

test('remembers the setting across a trip to the schema view', async ({ page }) => {
  await taxonomyOf(page, 'Music library');
  await page.getByTestId('toggle-relations').click();

  await page.getByRole('tab', { name: 'Schema' }).click();
  await page.getByRole('tab', { name: 'Taxonomy' }).click();

  await expect(page.getByTestId('toggle-relations')).toHaveAttribute('aria-pressed', 'true');
});

/*
 * The names have to clear the module boxes the edges cross. They sat under every node, which is
 * right for a class and wrong for a container: a box that hides the names of the edges crossing
 * it tells you less than empty canvas would.
 */
test('shows the relation names over the module boxes they cross', async ({ page }) => {
  await taxonomyOf(page, 'Music library');
  await page.getByTestId('toggle-relations').click();
  await page.locator('[data-taxonomy-class="Track"]').first().click();

  const label = relationEdges(page).first();
  await expect(label).toBeVisible();

  const box = await label.boundingBox();
  const topmost = await page.evaluate(
    ([x, y]) =>
      document.elementFromPoint(x as number, y as number)?.closest('[data-relation-name]') !== null,
    [box!.x + box!.width / 2, box!.y + box!.height / 2],
  );
  expect(topmost).toBe(true);
});
