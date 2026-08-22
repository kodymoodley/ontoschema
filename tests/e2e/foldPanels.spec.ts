import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  doubleClickClass,
  openApp,
  openExamples,
  selectClass,
  settledViewport,
} from './ontoschema';

/**
 * Folding the side panels away on a wide screen.
 *
 * The canvas is what the app is for and it gets whatever the two panels leave. These tests are
 * about giving that space back on request — and, just as much, about *not* taking it back on
 * anyone's behalf.
 */

const canvasWidth = async (page: Page) =>
  (await page.getByTestId('schema-canvas').boundingBox())!.width;

/* Exactly, or it also answers to the "Hide inspector" button that folds it. */
const inspectorWidth = async (page: Page) =>
  (await page.getByLabel('Inspector', { exact: true }).boundingBox())?.width ?? 0;

/** The share of the canvas a class fills by area, which is what the focus zoom aims at. */
async function classShareOfCanvas(page: Page, className: string) {
  const canvas = (await page.getByTestId('schema-canvas').boundingBox())!;
  const node = (await page.locator(`[data-class-name="${className}"]`).boundingBox())!;
  return (node.width * node.height) / (canvas.width * canvas.height);
}

/** An example with enough classes that fitting and focusing are different pictures. */
async function openMusicLibrary(page: Page) {
  await openExamples(page);
  await page.getByText('Music library').click();
  await expect(page.locator('[data-class-name="Album"]')).toBeVisible();
}

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
    await expect(page.getByTestId('fold-entities')).toHaveAttribute('aria-label', 'Show palette');

    await page.reload();

    /*
     * The claim is that the fold survived, not that a pixel count did. The column animates, so
     * comparing exact widths across a reload compares two moments of the same transition.
     */
    await expect(page.getByTestId('fold-entities')).toHaveAttribute('aria-label', 'Show palette');
    await expect.poll(() => canvasWidth(page)).toBeGreaterThan(bothOpen);
  });

  test('says which way it will go, on the button itself', async ({ page }) => {
    await openApp(page);
    const fold = page.getByTestId('fold-entities');

    await expect(fold).toHaveAttribute('aria-label', 'Hide palette');
    await fold.click();
    await expect(fold).toHaveAttribute('aria-label', 'Show palette');
  });

  /*
   * The measured hazard, and the reason nothing folds a panel for you. An earlier version
   * folded the inspector whenever nothing was selected, which resized the canvas on every
   * click, moved the drawing under the pointer, and left the focus zoom computing against a
   * width about to change -- a focused class filled 49% of the canvas instead of the 30-40%
   * it aims for.
   */
  test('never folds a panel on its own', async ({ page }) => {
    await openApp(page);
    await openMusicLibrary(page);

    const before = await canvasWidth(page);
    await selectClass(page, 'Album');
    expect(await canvasWidth(page)).toBe(before);

    // And folding by hand does not disturb the selection either.
    await page.getByTestId('fold-entities').click();
    await expect(page.getByLabel('Class local name')).toHaveValue('Album');
  });

  /*
   * The one thing that moves a panel without being asked, and it is the rule the owner set:
   * selecting means "tell me about this" at every width. On a phone that slides the drawer in,
   * so a folded column on a desktop staying folded made the same click do two different things
   * -- and put the details somewhere nobody could see them.
   */
  test('a new selection unfolds the inspector, whatever it was selected from', async ({ page }) => {
    await openApp(page);
    await openMusicLibrary(page);
    await page.getByTestId('fold-inspector').click();
    await expect.poll(() => inspectorWidth(page)).toBe(0);

    await selectClass(page, 'Album');
    await expect.poll(() => inspectorWidth(page)).toBeGreaterThan(0);

    // And from the search dialog, which is the other way in and does not touch the canvas.
    await page.getByTestId('fold-inspector').click();
    await expect.poll(() => inspectorWidth(page)).toBe(0);
    await page.getByTestId('open-search').click();
    await page.getByLabel('Search by name or description').fill('Artist');
    await page.locator('[data-result="Artist"]').click();
    await expect.poll(() => inspectorWidth(page)).toBeGreaterThan(0);
  });

  /*
   * Otherwise the fold button is dead for as long as anything is selected: the click folds the
   * column, the selection is still there, and an effect keyed on *having* a selection rather
   * than on it changing puts it straight back.
   */
  test('can still be folded away while something is selected', async ({ page }) => {
    await openApp(page);
    await openMusicLibrary(page);
    await selectClass(page, 'Album');

    await page.getByTestId('fold-inspector').click();
    await expect.poll(() => inspectorWidth(page)).toBe(0);
    // Still selected -- it is hidden, not deselected.
    await expect(page.locator('[data-class-name="Album"]')).toBeVisible();
  });

  /*
   * The hazard again, from the direction the unfolding rule opens up: double-clicking a class
   * selects it, so with the inspector folded the canvas is 340px wider at the moment the zoom
   * is worked out than it is when the animation lands.
   */
  test('focusing a class still frames it correctly when the unfold moves the canvas', async ({
    page,
  }) => {
    await openApp(page);
    await openMusicLibrary(page);
    await page.getByTestId('fold-inspector').click();
    await expect.poll(() => inspectorWidth(page)).toBe(0);

    await doubleClickClass(page, 'Album');
    await settledViewport(page);

    const share = await classShareOfCanvas(page, 'Album');
    expect(share, `Album filled ${(share * 100).toFixed(1)}% of the canvas`).toBeGreaterThanOrEqual(
      0.3,
    );
    expect(share, `Album filled ${(share * 100).toFixed(1)}% of the canvas`).toBeLessThanOrEqual(
      0.4,
    );
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

/**
 * One control for "show me everything": both panels away, the whole drawing framed.
 *
 * The two halves are what makes it worth having as a single thing. Folding without fitting
 * leaves the drawing the size it was in a pane twice as wide; fitting without folding frames it
 * into the space the panels left over.
 */
test.describe('fitting everything on screen', () => {
  test.use({ viewport: { width: 1440, height: 820 } });

  /** The share of the canvas the drawing spans, edge to edge across every class on it. */
  async function drawingSpan(page: Page) {
    const canvas = (await page.getByTestId('schema-canvas').boundingBox())!;
    const boxes = await Promise.all(
      (await page.locator('[data-class-name]').all()).map((node) => node.boundingBox()),
    );
    const drawn = boxes.filter((box) => box !== null);
    const left = Math.min(...drawn.map((box) => box.x));
    const right = Math.max(...drawn.map((box) => box.x + box.width));
    return { span: (right - left) / canvas.width, canvas, drawn };
  }

  test('folds both panels and frames the whole schema', async ({ page }) => {
    await openApp(page);
    await openMusicLibrary(page);

    await page.getByTestId('frame-canvas').click();

    await expect(page.getByTestId('fold-entities')).toHaveAttribute('aria-label', 'Show palette');
    await expect(page.getByTestId('fold-inspector')).toHaveAttribute(
      'aria-label',
      'Show inspector',
    );
    await expect.poll(() => canvasWidth(page)).toBe(1440);
    await settledViewport(page);

    const { span, canvas, drawn } = await drawingSpan(page);
    /*
     * Wide enough to prove the fit happened against the pane the panels had just given back.
     * Fitting first and folding second leaves the drawing spanning about 4/7 of the canvas --
     * the ratio of the two widths -- which is what this number is here to catch.
     */
    expect(span, `the drawing spanned ${(span * 100).toFixed(0)}% of the canvas`).toBeGreaterThan(
      0.6,
    );

    // And all of it is on screen, which is the other half of what "fits" means.
    for (const box of drawn) {
      expect(box.x).toBeGreaterThanOrEqual(canvas.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(canvas.x + canvas.width + 1);
    }
  });

  test('answers to Shift+F, and says so on the button', async ({ page }) => {
    await openApp(page);
    await openMusicLibrary(page);

    await expect(page.getByTestId('frame-canvas')).toHaveAttribute(
      'title',
      'Fit everything on screen (Shift+F)',
    );

    await page.keyboard.press('Shift+F');
    await expect.poll(() => canvasWidth(page)).toBe(1440);
  });

  /* A capital F is a letter before it is a shortcut. */
  test('stays out of the way while a name is being typed', async ({ page }) => {
    await openApp(page);
    await openMusicLibrary(page);
    await selectClass(page, 'Album');

    const name = page.getByLabel('Class local name');
    await name.fill('');
    await name.pressSequentially('Folio');

    await expect(name).toHaveValue('Folio');
    await expect(page.getByTestId('fold-entities')).toHaveAttribute('aria-label', 'Hide palette');
  });

  test('frames the taxonomy the same way', async ({ page }) => {
    await openApp(page);
    await openMusicLibrary(page);
    await page.getByRole('tab', { name: 'Taxonomy' }).click();
    await expect(page.getByTestId('taxonomy-canvas')).toBeVisible();

    await page.getByTestId('frame-canvas').click();
    await expect
      .poll(async () =>
        Math.round((await page.getByTestId('taxonomy-canvas').boundingBox())!.width),
      )
      .toBe(1440);
    await settledViewport(page);

    const canvas = (await page.getByTestId('taxonomy-canvas').boundingBox())!;
    for (const node of await page.locator('.react-flow__node').all()) {
      const box = (await node.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(canvas.x + canvas.width + 1);
    }
  });
});
