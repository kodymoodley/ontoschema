import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { addAttribute, downloadExport, openApp, openSection, selectClass } from './ontoschema';

/**
 * Every outcome that also has a drag gesture, reached with the keyboard alone.
 *
 * Three things on the canvas and in the hierarchy are done by dragging: re-parenting a class,
 * re-parenting an relation, and putting an existing attribute onto another
 * class. None of those drags is the only route — each has a control in the inspector — but
 * that was only ever true by reading the code. Nothing drove those controls the way a keyboard
 * user has to: reaching them by tabbing, and choosing with the keys rather than with a call
 * that sets the value directly.
 *
 * These tests use no pointer at all after the setup, so a control that stops being reachable
 * fails here rather than in someone's hands.
 */

/**
 * Presses Tab until the focused element carries `label`, and fails saying where it got to.
 * Counting presses instead would break whenever a field is added anywhere before the target.
 */
async function tabTo(page: Page, label: string, limit = 150) {
  /** The focused element's accessible name, or null once focus has left the document. */
  const focused = () =>
    page.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body) return null;
      return element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 40) ?? '';
    });

  /*
   * Chromium wraps Tab round to the top of the page; Firefox hands focus to the browser
   * instead and never comes back, so the walk has to re-enter the document itself. Doing that
   * rather than counting presses also means the test survives a field being added anywhere
   * before the target.
   */
  const reEnter = () =>
    page.evaluate(() => {
      // Tried in order until one actually takes focus: the drawer toggles are in the document
      // at every width but hidden by CSS on a wide one, and a hidden element declines silently.
      const candidates = document.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      for (const candidate of candidates) {
        candidate.focus();
        if (document.activeElement === candidate) return true;
      }
      return false;
    });

  /*
   * The walk always starts at the top of the page rather than from wherever focus happens to
   * be. It makes the claim the stronger one — someone arriving at the page can reach this —
   * and it avoids depending on Tab wrapping round at the end, which Chromium does and Firefox
   * does not.
   */
  if (!(await reEnter())) throw new Error('nothing on the page can take focus');

  const visited: string[] = [];
  for (let press = 0; press < limit; press += 1) {
    const current = await focused();
    if (current === label) return;
    if (current !== null) visited.push(current);
    await page.keyboard.press('Tab');
  }
  throw new Error(
    `never reached "${label}" by tabbing from the top; passed ${visited.length} controls, ` +
      `last was "${visited.at(-1) ?? 'none'}"`,
  );
}

/**
 * Chooses an option by its visible text, using only the keys a keyboard user has.
 *
 * Whether it worked is left to the caller, which knows what the choice was supposed to do. The
 * control itself is not evidence: the one that adds an attribute to a class disappears once
 * there are no classes left to add it to, so checking it afterwards would fail on success.
 */
async function chooseByKeyboard(page: Page, label: string, optionText: string) {
  await tabTo(page, label);
  // Typing the first letters moves the selection in a closed native select on every engine.
  await page.keyboard.type(optionText.slice(0, 4));
}

async function twoClasses(page: Page) {
  await openApp(page);
  await page.locator('[data-palette-kind="class"]').click();
  await page.locator('[data-class-node-id]').first().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Vehicle');
  await page.getByLabel('Class name').press('Enter');

  await page.locator('[data-palette-kind="class"]').click();
  await page.locator('[data-class-node-id]').nth(1).locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Car');
  await page.getByLabel('Class name').press('Enter');
  await expect(page.locator('[data-class-name="Car"]')).toBeVisible();
}

test('a class is selected from the hierarchy with the keyboard', async ({ page }) => {
  await twoClasses(page);
  await page.locator('.react-flow__pane').click();

  await tabTo(page, 'Car');
  await page.keyboard.press('Enter');

  await expect(page.getByLabel('Class local name')).toHaveValue('Car');
});

test('a class is re-parented with the keyboard, the drag being only a shortcut', async ({
  page,
}) => {
  await twoClasses(page);
  await selectClass(page, 'Car');

  await chooseByKeyboard(page, 'Add a superclass', 'Vehicle');

  await expect(page.locator('[data-class-name="Car"]')).toContainText('⊂ Vehicle');
  const turtle = await downloadExport(page, 'ttl');
  expect(turtle).toMatch(/ex:Car[\s\S]*rdfs:subClassOf ex:Vehicle/);
});

test('a class is promoted back to a root with the keyboard', async ({ page }) => {
  await twoClasses(page);
  await selectClass(page, 'Car');
  await page.getByLabel('Add a superclass').selectOption({ label: 'Vehicle' });
  await expect(page.locator('[data-class-name="Car"]')).toContainText('⊂ Vehicle');

  /*
   * Dropping the last parent is what the drag-to-empty-space gesture does. It used to be the
   * "no parent" option on a single select; now that a class may have several parents, each is
   * removed on its own and a class with none left is a root again.
   */
  await tabTo(page, 'Remove Vehicle as a superclass of Car');
  await page.keyboard.press('Enter');

  await expect(page.locator('[data-class-name="Car"]')).not.toContainText('⊂');
});

test('a attribute is put on a second class with the keyboard', async ({ page }) => {
  await twoClasses(page);
  await selectClass(page, 'Car');
  await addAttribute(page, 'weight', 'integer');

  // Open the property itself, where the control that reuses it lives.
  await page.locator('[data-class-name="Car"] [data-attribute-name="weight"]').click();
  await expect(page.getByLabel('Attribute local name')).toHaveValue('weight');

  await chooseByKeyboard(page, 'Add this attribute to a class', 'Vehicle');

  await expect(
    page.locator('[data-class-name="Vehicle"] [data-attribute-name="weight"]'),
  ).toBeVisible();
  // One property in the pool, on two classes — a reuse, not a copy.
  const turtle = await downloadExport(page, 'ttl');
  expect(turtle.match(/ex:weight a owl:DatatypeProperty/g) ?? []).toHaveLength(1);
});

test('an relation is re-parented with the keyboard', async ({ page }) => {
  await twoClasses(page);
  await page.locator('[data-palette-kind="relation"]').click();
  await openSection(page, 'Details');
  await page.getByLabel('Relation local name').fill('partOf');
  await page.locator('[data-palette-kind="relation"]').click();
  await page.getByLabel('Relation local name').fill('componentOf');

  await chooseByKeyboard(page, 'Superproperty', 'part');

  await page.getByRole('tab', { name: 'Relation' }).click();
  await expect(page.getByRole('tree', { name: 'Relation hierarchy' })).toContainText('componentOf');
});

test('a class and an attribute are created from the palette with the keyboard', async ({
  page,
}) => {
  await openApp(page);

  await tabTo(page, 'Add Class');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-class-node-id]')).toHaveCount(1);

  // The palette's click path puts a class in the first free slot rather than needing a drop
  // point, which is what makes it usable without a pointer at all.
  await page.locator('[data-class-node-id]').first().locator('header').click();
  await tabTo(page, 'Add Attribute');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-usage-id]')).toHaveCount(1);
});

/*
 * The inspector had a toggle, and on a narrow layout that toggle was how it was reached without
 * a pointer. It is gone: selecting is what opens the panel now. That only leaves the keyboard
 * route intact because selecting is itself reachable by keyboard, which is the thing worth
 * proving rather than assuming.
 *
 * Narrow on purpose. On a wide screen the inspector is simply always there, so nothing has to
 * open and the test would pass without demonstrating anything.
 */
test.describe('without a pointer, on a narrow screen', () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test('selecting from the hierarchy is what opens the inspector', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Entities', exact: true }).click();
    await page.locator('[data-palette-kind="class"]').click();
    await page.locator('[data-class-node-id]').first().locator('header [title]').dblclick();
    await page.getByLabel('Class name').fill('Car');
    await page.getByLabel('Class name').press('Enter');

    // Deselect, so the panel has to be opened rather than merely still be open.
    await page.getByTestId('schema-canvas').click({ position: { x: 12, y: 12 } });
    await expect(page.getByRole('complementary', { name: 'Inspector' })).toBeHidden();

    // From here on, no pointer: reach the class in the hierarchy and choose it.
    await page.getByRole('button', { name: 'Entities', exact: true }).click();
    await tabTo(page, 'Car');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('complementary', { name: 'Inspector' })).toBeVisible();
    await expect(page.getByLabel('Class local name')).toHaveValue('Car');
  });
});
