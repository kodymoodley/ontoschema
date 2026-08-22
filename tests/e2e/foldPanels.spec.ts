import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openApp, openExamples, selectClass } from './ontoschema';

/**
 * Folding the side panels away on a wide screen.
 *
 * The canvas is what the app is for and it gets whatever the two panels leave. These tests are
 * about giving that space back on request — and, just as much, about *not* taking it back on
 * anyone's behalf.
 */

const canvasWidth = async (page: Page) =>
  (await page.getByTestId('schema-canvas').boundingBox())!.width;

test.describe('on a wide screen', () => {
  test.use({ viewport: { width: 1440, height: 820 } });

  test('gives the canvas the space of whichever panel is folded', async ({ page }) => {
    await openApp(page);
    const bothOpen = await canvasWidth(page);

    await page.getByTestId('fold-entities').click();
    await expect.poll(() => canvasWidth(page)).toBeGreaterThan(bothOpen);
    const oneFolded = await canvasWidth(page);

    await page.getByTestId('fold-inspector').click();
    await expect.poll(() => canvasWidth(page)).toBeGreaterThan(oneFolded);
  });

  test('remembers what was folded, since it is about this browser not the schema', async ({
    page,
  }) => {
    await openApp(page);
    const bothOpen = await canvasWidth(page);
    await page.getByTestId('fold-entities').click();
    await expect(page.getByTestId('fold-entities')).toHaveAttribute('aria-label', 'Show entities');

    await page.reload();

    /*
     * The claim is that the fold survived, not that a pixel count did. The column animates, so
     * comparing exact widths across a reload compares two moments of the same transition.
     */
    await expect(page.getByTestId('fold-entities')).toHaveAttribute('aria-label', 'Show entities');
    await expect.poll(() => canvasWidth(page)).toBeGreaterThan(bothOpen);
  });

  test('says which way it will go, on the button itself', async ({ page }) => {
    await openApp(page);
    const fold = page.getByTestId('fold-entities');

    await expect(fold).toHaveAttribute('aria-label', 'Hide entities');
    await fold.click();
    await expect(fold).toHaveAttribute('aria-label', 'Show entities');
  });

  /*
   * The measured hazard, and the reason folding is manual only. An earlier version folded the
   * inspector whenever nothing was selected, which resized the canvas on every click, moved the
   * drawing under the pointer, and left the focus zoom computing against a width about to
   * change -- a focused class filled 49% of the canvas instead of the 30-40% it aims for.
   */
  test('never folds or unfolds on its own', async ({ page }) => {
    await openApp(page);
    await openExamples(page);
    await page.getByText('Music library').click();
    await expect(page.locator('[data-class-name="Album"]')).toBeVisible();

    const before = await canvasWidth(page);
    await selectClass(page, 'Album');
    expect(await canvasWidth(page)).toBe(before);

    // And folding by hand does not disturb the selection either.
    await page.getByTestId('fold-entities').click();
    await expect(page.getByLabel('Class local name')).toHaveValue('Album');
  });
});

test.describe('on a narrow screen', () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test('offers no folding, because the panels are already drawers', async ({ page }) => {
    await openApp(page);

    await expect(page.getByTestId('fold-entities')).toBeHidden();
    await expect(page.getByTestId('fold-inspector')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Entities', exact: true })).toBeVisible();
  });
});
