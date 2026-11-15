import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openApp, openExamples } from './ontoschema';

/**
 * Putting a relation's lines away from the entities panel, and getting them back from the status
 * bar. What only a browser shows: the eye fading in where the pointer is and nowhere else, the
 * lines leaving the canvas, and the choice outliving a reload.
 */

async function openMusic(page: Page) {
  await openApp(page);
  await openExamples(page);
  await page.locator('[data-example="music"]').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Relation' }).click();
}

const row = (page: Page, name: string) => page.locator(`[data-tree-item="${name}"]`);
const eyeOf = (page: Page, name: string) => row(page, name).locator('button[aria-pressed]');
const line = (page: Page, name: string) => page.locator(`[data-relation-name="${name}"]`);
const showAll = (page: Page) => page.getByRole('button', { name: /^Show the \d+ hidden relation/ });

test('hides a relation’s lines from its row, and the status bar brings them back', async ({
  page,
}) => {
  await openMusic(page);
  await expect(line(page, 'influencedBy')).toHaveCount(1);
  // Not drawn away from the pointer: the rows are as clean as before.
  await expect(eyeOf(page, 'influencedBy')).toHaveCSS('opacity', '0');

  await row(page, 'influencedBy').hover();
  await expect(eyeOf(page, 'influencedBy')).toHaveCSS('opacity', '1');
  await eyeOf(page, 'influencedBy').click();

  await expect(line(page, 'influencedBy')).toHaveCount(0);
  await expect(showAll(page)).toHaveText('1 hidden');

  // Remembered in this browser, so a reload keeps it put away.
  await page.reload();
  await expect(line(page, 'influencedBy')).toHaveCount(0);

  await showAll(page).click();
  await expect(line(page, 'influencedBy')).toHaveCount(1);
  await expect(showAll(page)).toHaveCount(0);
});

test('shows the eye of the row focused from the keyboard', async ({ page }) => {
  await openMusic(page);

  await row(page, 'influencedBy').focus();
  await page.keyboard.press('Tab');
  await expect(eyeOf(page, 'influencedBy')).toBeFocused();
  await expect(eyeOf(page, 'influencedBy')).toHaveCSS('opacity', '1');

  await page.keyboard.press('Enter');
  await expect(eyeOf(page, 'influencedBy')).toHaveAttribute('aria-pressed', 'true');
  await expect(line(page, 'influencedBy')).toHaveCount(0);
});

test.describe('on a touch screen', () => {
  test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
  test.skip(({ browserName }) => browserName === 'firefox', 'Firefox does not emulate a phone.');

  test('shows the eye on the selected row, since nothing can be hovered', async ({ page }) => {
    await openApp(page);
    await openExamples(page);
    await page.locator('[data-example="music"]').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Entities', exact: true }).tap();
    await page.getByRole('tab', { name: 'Relation' }).tap();

    await expect(eyeOf(page, 'influencedBy')).toHaveCSS('opacity', '0');
    await row(page, 'influencedBy').tap();
    await expect(eyeOf(page, 'influencedBy')).toHaveCSS('opacity', '1');
  });
});
