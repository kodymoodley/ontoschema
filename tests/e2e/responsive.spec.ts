import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { chooseProjectAction, openApp, selectClass, settled } from './ontoschema';

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

/**
 * Opens the entities drawer and waits for it to finish sliding.
 *
 * The drawer moves on a 180ms transform, so a box measured straight after the click is of a panel
 * still on its way in — which reads as a drawer a tenth of its real width.
 */
async function openedDrawer(page: Page) {
  await page.getByRole('button', { name: 'Entities', exact: true }).click();
  const drawer = page.locator('[aria-label="Palette and hierarchy"]');
  await settled(
    () => drawer.evaluate((element) => element.getBoundingClientRect().x),
    'the entities drawer never stopped moving',
  );
  const box = await drawer.boundingBox();
  if (!box) throw new Error('no drawer');
  return box;
}

test.describe('wide', () => {
  test.use({ viewport: WIDE });

  test('shows all three columns at once, with no drawer toggles', async ({ page }) => {
    await openApp(page);
    await expect(entities(page)).toBeVisible();
    await expect(inspector(page)).toBeVisible();
    /*
     * Exact, because the wide layout has a *fold* button named "Hide palette" and Playwright
     * matches an accessible name by substring unless told otherwise. Two different controls, and
     * they never appear together -- this one is the narrow layout's drawer toggle.
     */
    await expect(page.getByRole('button', { name: 'Entities', exact: true })).toBeHidden();
    // There is no Inspector drawer toggle at any width: selecting something is what opens it.
    await expect(page.getByRole('button', { name: 'Inspector', exact: true })).toHaveCount(0);
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
    await expect(page.getByRole('button', { name: 'Entities', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Inspector', exact: true })).toHaveCount(0);

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
    const toggle = page.getByRole('button', { name: 'Entities', exact: true });

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(entities(page)).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await toggle.click();
    await expect(entities(page)).toBeHidden();
  });

  /*
   * The rule, and it is the same rule at every width: the inspector is open exactly when
   * something is selected. Here that means the drawer slides in by itself, which is why the
   * button that used to do it is gone.
   */
  test('opens the inspector by selecting, and closes it by deselecting', async ({ page }) => {
    await openApp(page);
    // The palette lives in the entities drawer here, and creating from it closes that drawer.
    await page.getByRole('button', { name: 'Entities', exact: true }).click();
    await page.locator('[data-palette-kind="class"]').click();

    /*
     * Creating a class selects it, so the panel is already open. Put it away first, or this
     * would assert that something stayed open rather than that selecting opened it.
     */
    await page.getByTestId('schema-canvas').click({ position: { x: 12, y: 12 } });
    await expect(inspector(page)).toBeHidden();

    await selectClass(page, 'NewClass');
    await expect(inspector(page)).toBeVisible();

    await page.getByTestId('schema-canvas').click({ position: { x: 12, y: 12 } });
    await expect(inspector(page)).toBeHidden();
  });

  test('shows one drawer at a time', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Entities', exact: true }).click();
    await page.locator('[data-palette-kind="class"]').click();
    await page.getByRole('button', { name: 'Entities', exact: true }).click();
    await expect(entities(page)).toBeVisible();

    // Selecting opens the inspector, and the entities drawer gets out of its way.
    await selectClass(page, 'NewClass');
    await expect(inspector(page)).toBeVisible();
    await expect(entities(page)).toBeHidden();
  });

  test('creating from the palette closes the drawer over the canvas', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Entities', exact: true }).click();

    // Dragging out of an overlay onto the canvas beneath it is awkward, so the palette's
    // click path is the narrow-viewport route — and it gets out of the way afterwards.
    await page.locator('[data-palette-kind="class"]').click();

    await expect(entities(page)).toBeHidden();
    await expect(page.locator('[data-class-node-id]')).toHaveCount(1);
  });

  test('the whole editing workflow still works', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Entities', exact: true }).click();
    await page.locator('[data-palette-kind="class"]').click();

    await page.locator('[data-class-node-id]').first().locator('header [title]').dblclick();
    await page.getByLabel('Class name').fill('Car');
    await page.getByLabel('Class name').press('Enter');

    // Adding an attribute means reaching the inspector, which selecting the class opens.
    await selectClass(page, 'Car');
    await page.getByLabel('New attribute name').fill('price');
    await page.getByRole('button', { name: 'Add attribute to this class' }).click();

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

  /*
   * The drawer is half the width it once was, so the canvas stays visible beside it and a newly
   * created attribute is not hidden behind the panel that created it. Anything inside has to fit
   * that width: a tab strip wider than its container does not scroll or clip visibly, it paints
   * outside and looks like it ends, leaving the last tab present, clickable and invisible.
   */
  test('leaves the canvas visible beside it', async ({ page }) => {
    await openApp(page);
    const drawer = await openedDrawer(page);
    expect(drawer.width / NARROW.width, 'share of the screen covered').toBeLessThan(0.5);
  });

  /*
   * One row, and nothing cut off. Sized to their labels the three tabs came within a pixel or
   * two of the room available, so they share it instead: whatever the labels say, there is one
   * row of three.
   */
  test('fits the entity tabs on one row without clipping a label', async ({ page }) => {
    await openApp(page);
    await openedDrawer(page);

    const tabs = await page.evaluate(() => {
      const strip = document.querySelector('[aria-label="Ontology entities"]');
      const buttons = [...(strip?.querySelectorAll('button') ?? [])] as HTMLElement[];
      return {
        rows: new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().top))).size,
        clipped: buttons.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent),
      };
    });

    expect(tabs.rows, 'the tabs should not wrap').toBe(1);
    expect(tabs.clipped, 'no label should be cut off').toEqual([]);
  });

  test('keeps every entity tab inside itself', async ({ page }) => {
    await openApp(page);
    const drawer = await openedDrawer(page);

    for (const name of ['Class', 'Relation', 'Attribute']) {
      const tab = await page.getByRole('tab', { name, exact: true }).boundingBox();
      if (!tab) throw new Error(`no ${name} tab`);
      expect(tab.x + tab.width, `${name} runs past the drawer`).toBeLessThanOrEqual(
        drawer.x + drawer.width,
      );
    }
  });

  /*
   * The drawer scrolls as one. On a desktop the palette is a fixed block and the tree scrolls in
   * what is left; in a drawer that leaves the tree a sliver, and the taxonomy below the fold
   * cannot be reached at all.
   */
  test('scrolls to reach the taxonomy below the fold', async ({ page }) => {
    /*
     * A phone rather than this block's 820x800, which is tall enough that the question does not
     * arise. The height is what matters here, and a real phone has less of it than this: the
     * browser's own address bar takes about 90px that a headless viewport does not model.
     */
    await page.setViewportSize({ width: 390, height: 640 });
    await openApp(page);
    await chooseProjectAction(page, 'open-examples');
    await page.getByText('Music library', { exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await openedDrawer(page);

    const drawer = page.locator('[aria-label="Palette and hierarchy"]');
    const overflowing = await drawer.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
    expect(overflowing, 'a schema of this size should not fit the drawer').toBe(true);

    await drawer.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    expect(await drawer.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });

  /*
   * Reaching past a drawer to the canvas says plainly enough that the drawer is no longer wanted.
   * Having to find the toggle again to dismiss it is the sort of small tax that makes an interface
   * feel stubborn.
   */
  test('closes when the canvas is touched', async ({ page }) => {
    await openApp(page);
    await openedDrawer(page);

    const canvas = await page.getByTestId('schema-canvas').boundingBox();
    if (!canvas) throw new Error('no canvas');
    await page.mouse.click(canvas.x + canvas.width - 40, canvas.y + canvas.height / 2);

    await expect(page.locator('[aria-label="Palette and hierarchy"]')).toBeHidden();
  });

  /* Icon-only on this layout, so the name has to come from somewhere other than the label. */
  test('names the entities button even though it shows an icon', async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole('button', { name: 'Entities', exact: true })).toBeVisible();
  });
});

/**
 * The inspector on a phone, measured at the narrowest screen anyone still ships: 320px, where
 * the panel is a 160px drawer and every row in it has to earn its width.
 *
 * The defect these pin was not the type scale, which `tokens.css` already steps down below
 * 1024px. It was that a row could not shrink: the name in an attribute row is a button, a
 * button does not shrink below its longest word, and a column flex container is as wide as its
 * widest child — so `durationSeconds` laid the whole panel out at 207px against a 159px pane
 * and pushed the remove button of every row out through the edge.
 */
test.describe('on a phone', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  const inspectorSize = (page: Page) =>
    inspector(page).evaluate((root) => ({
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
    }));

  async function musicLibrary(page: Page) {
    await openApp(page);
    await chooseProjectAction(page, 'open-examples');
    await page.getByText('Music library', { exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }

  /** Selects by name through the search dialog: at this width the canvas is behind the drawer. */
  async function find(page: Page, name: string) {
    await page.keyboard.press('Control+k');
    await page.getByLabel('Search by name or description').fill(name);
    await page.locator(`[data-result="${name}"]`).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }

  test('fits a class, a relation and an attribute without scrolling sideways', async ({ page }) => {
    await musicLibrary(page);

    for (const name of ['Track', 'performedBy', 'trackTitle']) {
      await find(page, name);
      await expect.poll(async () => (await inspectorSize(page)).clientWidth).toBeGreaterThan(0);
      const { scrollWidth, clientWidth } = await inspectorSize(page);
      expect(
        scrollWidth,
        `${name} made the inspector ${scrollWidth}px wide in ${clientWidth}px`,
      ).toBeLessThanOrEqual(clientWidth);
    }
  });

  /*
   * The name is what the row is for. Fitting name, datatype and remove button on one line is
   * possible once the name can shrink, and it cut `trackTitle` down to `trac…` to make room for
   * `xsd:string` in full — so the row wraps instead.
   */
  test('shows an attribute row name in full', async ({ page }) => {
    await musicLibrary(page);
    await find(page, 'Track');

    const name = page.getByRole('button', { name: 'durationSeconds', exact: true });
    const cut = await name.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
    expect(cut, 'the name was truncated').toBe(false);
  });

  /*
   * A name longer than the drawer itself. Wrapping the row handles ordinary names, because a
   * name on a line of its own has 128px to sit in; this is the case that still needs the name
   * to be able to trail off, and it is not a contrived one -- `registrationAuthorityId` is the
   * sort of thing this tool is for.
   */
  test('survives an attribute whose name is longer than the panel', async ({ page }) => {
    await musicLibrary(page);
    await find(page, 'Track');

    await page.getByLabel('New attribute name').fill('registrationAuthorityIdentifier');
    await page.getByRole('button', { name: 'Add attribute to this class' }).click();
    await expect(
      inspector(page).getByText('registrationAuthority', { exact: false }),
    ).toBeVisible();

    const { scrollWidth, clientWidth } = await inspectorSize(page);
    expect(scrollWidth, `the long name made the panel ${scrollWidth}px wide`).toBeLessThanOrEqual(
      clientWidth,
    );
  });

  /*
   * The drawers open below the canvas toolbar, not below the header. When they opened below the
   * header they lay over the strip: at this width, with a class selected, Undo, Redo, Find and
   * the hide-both-panels control were all covered and only the two view tabs answered a tap.
   * Selecting is how you edit, so undo was unreachable exactly when it was wanted.
   *
   * Hit-testing rather than geometry, because that is the actual question -- whether a tap on
   * the button reaches the button.
   */
  test('leaves every control on the canvas toolbar reachable', async ({ page }) => {
    await musicLibrary(page);
    await find(page, 'Track');
    await expect(inspector(page)).toBeVisible();

    const covered = await page.evaluate(() => {
      const bar = document.querySelector('[class*="canvasToolbar"]');
      const blocked: string[] = [];
      for (const control of Array.from(bar?.querySelectorAll('button, [role="switch"]') ?? [])) {
        const rect = control.getBoundingClientRect();
        if (rect.width === 0) continue;
        const at = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        if (at === control || control.contains(at)) continue;
        blocked.push(control.getAttribute('aria-label') ?? control.textContent?.trim() ?? '?');
      }
      return blocked;
    });

    expect(covered, `covered by the drawer: ${covered.join(', ')}`).toEqual([]);
  });

  /*
   * The same gesture and the same result as on a desktop. It used to change its own label here
   * and leave the drawer where it was: the inspector is a drawer at this width rather than a
   * column, and it opened on selection alone with nothing consulting the fold.
   */
  test('hides both panels and brings them back, as it does on a desktop', async ({ page }) => {
    await musicLibrary(page);
    await find(page, 'Track');
    await page.getByRole('button', { name: 'Entities', exact: true }).click();
    await expect(entities(page)).toBeVisible();

    const both = page.getByTestId('fold-both');
    await both.click();
    await expect(inspector(page)).toBeHidden();
    await expect(entities(page)).toBeHidden();
    await expect(both).toHaveAttribute('aria-label', 'Show both panels');

    await both.click();
    await expect(inspector(page)).toBeVisible();
    await expect(entities(page)).toBeVisible();
    await expect(both).toHaveAttribute('aria-label', 'Hide both panels');
    /*
     * Putting the panels away was not deselecting. Asserted here rather than while they were
     * away: a panel hidden with `visibility` leaves the accessibility tree, so there is nothing
     * to read the field from until it comes back.
     */
    await expect(page.getByLabel('Class local name')).toHaveValue('Track');
  });

  /* Selecting opens the inspector at every width, and that has to survive being put away. */
  test('opens the inspector again on the next selection', async ({ page }) => {
    await musicLibrary(page);
    await find(page, 'Track');
    await page.getByTestId('fold-both').click();
    await expect(inspector(page)).toBeHidden();

    await find(page, 'Album');
    await expect(inspector(page)).toBeVisible();
  });

  /* The panel's title is the thing being edited, and it was showing as `performe…`. */
  test('shows the name of what is being edited in full', async ({ page }) => {
    await musicLibrary(page);
    await find(page, 'performedBy');

    const title = inspector(page).getByText('performedBy', { exact: true }).first();
    const cut = await title.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
    expect(cut, 'the panel title was truncated').toBe(false);
  });

  /* Four columns in a 160px drawer left the object select showing no class name at all. */
  test('leaves the relation pairing readable', async ({ page }) => {
    await musicLibrary(page);
    await find(page, 'performedBy');

    const range = page.getByLabel('Range of performedBy on Track');
    const box = (await range.boundingBox())!;
    expect(box.width, `the range select was ${Math.round(box.width)}px wide`).toBeGreaterThan(80);
  });
});

/* What changes for a phone must not follow the app back onto a desktop. */
test.describe('rows on a wide screen', () => {
  test.use({ viewport: WIDE });

  test('keeps an attribute row on one line', async ({ page }) => {
    await openApp(page);
    await chooseProjectAction(page, 'open-examples');
    await page.getByText('Music library', { exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await selectClass(page, 'Track');

    const row = page.locator('li', {
      has: page.getByRole('button', { name: 'durationSeconds', exact: true }),
    });
    /*
     * Middles, not tops. The name and the datatype are set at different sizes and the row centres
     * them, so their tops differ by a couple of pixels even when they share a line.
     */
    const middles = await row.evaluate((element) => {
      const name = element.querySelector('button')!.getBoundingClientRect();
      const meta = element.querySelector('span')!.getBoundingClientRect();
      return [name.y + name.height / 2, meta.y + meta.height / 2];
    });

    expect(Math.abs(middles[0]! - middles[1]!), 'the datatype dropped below the name').toBeLessThan(
      4,
    );
  });
});
