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
  await expect(page.getByTestId('toggle-relations')).toHaveAttribute('aria-checked', 'false');
});

/*
 * The switch shows a drawing of a relation rather than the word. A drawing is not a name, so
 * the name has to be carried separately -- otherwise the one control that reveals the relation
 * layer announces itself as "Show".
 */
test('is a switch, and says what it is for even though it shows a picture', async ({ page }) => {
  await openApp(page);
  await page.getByRole('tab', { name: 'Taxonomy' }).click();

  const toggle = page.getByRole('switch', { name: 'Show relations' });
  await expect(toggle).toBeVisible();
  await expect(toggle.locator('svg[aria-hidden="true"]')).toHaveCount(1);
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

  await expect(page.getByTestId('toggle-relations')).toHaveAttribute('aria-checked', 'true');
});

/*
 * The names have to be painted over the lines, and this is checked by comparing the layers
 * rather than by asking what is under the pointer.
 *
 * That distinction is the whole point of the test. `elementFromPoint` says the label is on top,
 * because an SVG path with `pointer-events: none` is invisible to hit-testing -- and the line
 * was being painted straight through the middle of its own name the entire time it said so.
 * What went wrong was React Flow giving each edge the z-index of the nodes it joins whenever
 * those nodes have a parent, which every taxonomy class does.
 */
test('paints the relation names above the lines, not under them', async ({ page }) => {
  await taxonomyOf(page, 'Music library');
  await page.getByTestId('toggle-relations').click();
  await page.locator('[data-taxonomy-class="Track"]').first().click();
  await expect(relationEdges(page).first()).toBeVisible();

  const layers = await page.evaluate(() => {
    const labelLayer = document.querySelector('.react-flow__edgelabel-renderer');
    const zOf = (el: Element | null) => Number(getComputedStyle(el as HTMLElement).zIndex) || 0;
    return {
      labels: zOf(labelLayer),
      edges: [...document.querySelectorAll('.react-flow__edges > svg')].map(zOf),
    };
  });

  expect(layers.edges.length).toBeGreaterThan(0);
  for (const edge of layers.edges) {
    expect(edge, 'an edge layer is at or above the labels').toBeLessThan(layers.labels);
  }
});

/*
 * Switching the layer on with nothing selected draws nothing, because there is no class whose
 * relations to draw. Unexplained, that reads as a control that does not work.
 */
test('says what is missing when it is switched on with nothing selected', async ({ page }) => {
  await taxonomyOf(page, 'Music library');
  const hint = page.getByTestId('canvas-hint');
  // Nothing to say: the taxonomy explains itself, and a caption on it would be noise.
  await expect(hint).toHaveText('');

  await page.getByTestId('toggle-relations').click();
  await expect(hint).toHaveText('Select a class to see its relations.');

  /*
   * And stops saying it the moment there is something to draw, moving on to the gesture that is
   * worth knowing next. A hint that outlives the condition it describes is worse than none; one
   * that goes blank where it could teach the thing you are now in a position to use is a waste
   * of the only line of prose in the toolbar.
   */
  await page.locator('[data-taxonomy-class="Track"]').first().click();
  await expect(hint).toHaveText('Ctrl or Cmd click another class to compare them.');
  await expect.poll(() => relationEdges(page).count()).toBeGreaterThan(0);
});

/*
 * The hint appears and disappears under the toolbar's own controls. Anything it can push is a
 * control that moves while someone is reaching for it.
 */
test('the switch does not move when the hint comes and goes', async ({ page }) => {
  await taxonomyOf(page, 'Music library');
  const toggle = page.getByTestId('toggle-relations');
  const where = async () => Math.round((await toggle.boundingBox())!.x);

  const before = await where();
  await toggle.click();
  await expect(page.getByTestId('canvas-hint')).toHaveText('Select a class to see its relations.');
  expect(await where(), 'the hint appearing moved the switch').toBe(before);

  // The replacement is longer than what it replaces, which is the case that would push hardest.
  await page.locator('[data-taxonomy-class="Track"]').first().click();
  await expect(page.getByTestId('canvas-hint')).toHaveText(
    'Ctrl or Cmd click another class to compare them.',
  );
  expect(await where(), 'the hint changing moved the switch').toBe(before);
});

test('says nothing about selecting while the layer is off', async ({ page }) => {
  await taxonomyOf(page, 'Music library');
  // Off, so a class being selected or not makes no difference to what is drawn.
  await page.locator('[data-taxonomy-class="Track"]').first().click();
  await expect(page.getByText('Select a class to see its relations')).toHaveCount(0);
});

/*
 * Comparing two classes at once.
 *
 * "What does a Track touch" is half a question; the other half is what it touches that an Album
 * does not. Ctrl or Cmd adds a class to what is showing instead of replacing it, which is the
 * gesture every other list and canvas already uses for "and this one too".
 *
 * The set lives in the canvas, not in the store. The app's selection stays single because it
 * drives the inspector, which shows one entity at a time.
 */
test('adds a second class to the relations on Ctrl or Cmd click', async ({ page }) => {
  await taxonomyOf(page, 'Music library');
  await page.getByTestId('toggle-relations').click();

  await page.locator('[data-taxonomy-class="Track"]').first().click();
  await expect.poll(() => relationEdges(page).count()).toBeGreaterThan(0);
  const forTrack = await relationEdges(page).count();

  await page
    .locator('[data-taxonomy-class="Venue"]')
    .first()
    .click({ modifiers: ['ControlOrMeta'] });
  const forBoth = await relationEdges(page).count();
  expect(forBoth).toBeGreaterThan(forTrack);

  // And it is genuinely both, not merely the second one: Venue alone draws fewer than the pair.
  await page.locator('[data-taxonomy-class="Venue"]').first().click();
  await expect.poll(() => relationEdges(page).count()).toBeLessThan(forBoth);
});

test('takes a class back out when it is Ctrl clicked again', async ({ page }) => {
  await taxonomyOf(page, 'Music library');
  await page.getByTestId('toggle-relations').click();

  const track = page.locator('[data-taxonomy-class="Track"]').first();
  const venue = page.locator('[data-taxonomy-class="Venue"]').first();

  await track.click();
  const forTrack = await relationEdges(page).count();
  await venue.click({ modifiers: ['ControlOrMeta'] });
  await expect.poll(() => relationEdges(page).count()).toBeGreaterThan(forTrack);

  await venue.click({ modifiers: ['ControlOrMeta'] });
  await expect.poll(() => relationEdges(page).count()).toBe(forTrack);
});

/*
 * A plain click ends the comparison rather than continuing it. The way out of one comparison is
 * the click that starts the next, which is why this narrows to the class clicked even when that
 * class is the selected one -- the toggle-off above only applies when it is showing alone.
 */
test('narrows back to one class on a plain click', async ({ page }) => {
  await taxonomyOf(page, 'Music library');
  await page.getByTestId('toggle-relations').click();

  const track = page.locator('[data-taxonomy-class="Track"]').first();
  await track.click();
  const forTrack = await relationEdges(page).count();

  await page
    .locator('[data-taxonomy-class="Venue"]')
    .first()
    .click({ modifiers: ['ControlOrMeta'] });
  await expect.poll(() => relationEdges(page).count()).toBeGreaterThan(forTrack);

  await track.click();
  await expect.poll(() => relationEdges(page).count()).toBe(forTrack);
});

test('clears the whole comparison when the canvas is clicked', async ({ page }) => {
  await taxonomyOf(page, 'Music library');
  await page.getByTestId('toggle-relations').click();

  await page.locator('[data-taxonomy-class="Track"]').first().click();
  await page
    .locator('[data-taxonomy-class="Venue"]')
    .first()
    .click({ modifiers: ['ControlOrMeta'] });
  await expect.poll(() => relationEdges(page).count()).toBeGreaterThan(0);

  await page.locator('.react-flow__pane').click({ position: { x: 8, y: 8 } });
  await expect(relationEdges(page)).toHaveCount(0);
});

/*
 * Selecting from anywhere else starts again. The search box and the tree know nothing about the
 * comparison, and inheriting one that was set up on the canvas would show relations for classes
 * the person had stopped looking at.
 */
test('starts again when a class is chosen from the search box', async ({ page }) => {
  await taxonomyOf(page, 'Music library');
  await page.getByTestId('toggle-relations').click();

  await page.locator('[data-taxonomy-class="Track"]').first().click();
  const forTrack = await relationEdges(page).count();
  await page
    .locator('[data-taxonomy-class="Venue"]')
    .first()
    .click({ modifiers: ['ControlOrMeta'] });
  await expect.poll(() => relationEdges(page).count()).toBeGreaterThan(forTrack);

  await page.keyboard.press('Control+k');
  await page.getByLabel('Search by name or description').fill('Track');
  await page.locator('[data-result="Track"]').click();

  await expect.poll(() => relationEdges(page).count()).toBe(forTrack);
});
