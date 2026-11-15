import { expect, test } from '@playwright/test';
import { addAttribute, dragFromPalette, openApp, selectClass } from './ontoschema';

/**
 * A name typed that a term already has: reused where it means that term, refused where it would
 * make two terms of one name. Never the `make2` the app used to settle for.
 */

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await dragFromPalette(page, 'class', { x: 220, y: 200 });
  await dragFromPalette(page, 'class', { x: 600, y: 200 });
  await expect(page.locator('[data-class-name="NewClass2"]')).toBeVisible();
});

test('typing an existing attribute’s name on another class uses that attribute', async ({
  page,
}) => {
  await selectClass(page, 'NewClass');
  await addAttribute(page, 'make', 'string');

  await selectClass(page, 'NewClass2');
  await page.getByLabel('New attribute name').fill('make');
  await page.getByRole('button', { name: 'Use the existing attribute make on this class' }).click();

  const second = page.locator('[data-class-name="NewClass2"] [data-attribute-name="make"]');
  await expect(second).toBeVisible();
  await expect(page.locator('[data-attribute-name="make2"]')).toHaveCount(0);
  await expect(page.getByText(/↗ 1 more/)).toBeVisible();
});

test('renaming a class on the canvas to a taken name says whose it is, and changes nothing', async ({
  page,
}) => {
  const node = page.locator('[data-class-name="NewClass2"]');
  await node.locator('header [title]').dblclick();
  const field = node.getByLabel('Class name');
  await field.fill('NewClass');
  await field.press('Enter');

  await expect(node.getByText('NewClass is already a class.')).toBeVisible();
  await expect(field).toBeVisible();

  await field.press('Escape');
  await expect(page.locator('[data-class-name="NewClass2"]')).toBeVisible();
  await expect(page.locator('[data-class-name="NewClass"]')).toHaveCount(1);
});
