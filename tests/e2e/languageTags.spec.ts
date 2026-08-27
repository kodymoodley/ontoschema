import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { downloadExport, openApp, openSection, selectClass } from './ontoschema';

/**
 * Choosing a language for a label, in a real browser.
 *
 * This is checked end to end because the previous control looked right in the markup and was
 * unusable in practice: it was a text field with a `datalist`, and a datalist filters its
 * suggestions by whatever is already in the box. New labels were created with `en` in the
 * field, so the list offered exactly one entry — the one already chosen.
 */

async function labelledClass(page: Page) {
  await openApp(page);
  await page.locator('[data-palette-kind="class"]').click();
  await selectClass(page, 'NewClass');
  // Through the form, which is where a label is written: a box called Label, and a language
  // beside it. The term list behind "Other properties" holds everything that has no such box.
  await openSection(page, 'Documentation');
  await page.getByLabel('Label', { exact: true }).fill('Car');
}

test('every language is on offer, not only the one already chosen', async ({ page }) => {
  await labelledClass(page);

  const field = page.getByLabel('Label language');
  await expect(field).toHaveValue('en');

  // The whole point: the list is complete regardless of what is currently selected.
  const options = await field.locator('option').count();
  expect(options).toBeGreaterThan(150);

  const first = await field.locator('option').first().getAttribute('value');
  expect(first, 'a tag has to be optional').toBe('');
});

test('a language is chosen and reaches the exported file', async ({ page }) => {
  await labelledClass(page);
  await page.getByLabel('Label language').selectOption('ja');

  const turtle = await downloadExport(page, 'ttl');
  expect(turtle).toContain('"Car"@ja');
});

test('the tag can be taken off, leaving a plain literal', async ({ page }) => {
  await labelledClass(page);
  await page.getByLabel('Label language').selectOption('');

  const turtle = await downloadExport(page, 'ttl');
  expect(turtle).toContain('"Car"');
  expect(turtle).not.toMatch(/"Car"@/);
});

test('languages are listed by name, not just by code', async ({ page }) => {
  await labelledClass(page);

  const dutch = page.getByLabel('Label language').locator('option[value="nl"]');
  await expect(dutch).toHaveText(/Dutch/);
});

/*
 * The language sits under the value it belongs to, not beside it.
 *
 * Beside it, the tag took a fixed column out of every documentation field at every width and the
 * box people actually type into got what was left. A language tag is short, set once and rarely
 * looked at again; prose is what these fields are for, so the width belongs to the prose.
 *
 * Geometry rather than a class name, because what is being promised is where it lands.
 */
test('puts the language under the value, with the full width left for prose', async ({ page }) => {
  await labelledClass(page);

  const value = await page.getByLabel('Label', { exact: true }).boundingBox();
  const language = await page.getByLabel('Label language').boundingBox();
  expect(value && language).toBeTruthy();
  if (!value || !language) return;

  // Below, not beside: it starts under the bottom of the box rather than alongside it.
  expect(language.y).toBeGreaterThanOrEqual(value.y + value.height - 1);
  // And it is the narrow control it now only needs to be, well short of the value above it.
  expect(language.width).toBeLessThan(value.width / 2);
});

/*
 * The whole point of the shortening: what the closed control shows is a code, so the panel is
 * not spending a hundred pixels on the word "English" beside every field.
 */
test('shows the chosen language as a bare code', async ({ page }) => {
  await labelledClass(page);

  const chosen = page.getByLabel('Label language').locator('option:checked');
  await expect(chosen).toHaveText('en');
});
