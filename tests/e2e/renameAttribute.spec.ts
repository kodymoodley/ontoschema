import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { addAttribute, downloadExport, openApp, selectClass } from './ontoschema';

/**
 * Renaming a attribute from inside a class box, in a real browser.
 *
 * The component tests already cover the editor's rules. What needs a browser is that the
 * gesture reaches the row at all rather than the canvas underneath it, that a touch device can
 * do it, and that the new name is what actually leaves the app in an export.
 */

const row = (page: Page, name: string) => page.locator(`[data-attribute-name="${name}"]`);

// Exact, because the inspector's "New attribute name" box would otherwise match as well.
const nameField = (page: Page) => page.getByLabel('Attribute name', { exact: true });

/**
 * Below 1024px the side panels are drawers, and only one is open at a time. On a wide viewport
 * the toggles are not rendered and there is nothing to do, so this is safe either way.
 */
async function openDrawer(page: Page, name: 'Entities' | 'Inspector') {
  const toggle = page.getByRole('button', { name, exact: true });
  if ((await toggle.count()) === 0) return;
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

async function classWithAttributes(page: Page) {
  await openApp(page);
  await openDrawer(page, 'Entities');
  await page.locator('[data-palette-kind="class"]').click();
  await page.locator('[data-class-node-id]').first().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Car');
  await page.getByLabel('Class name').press('Enter');

  await selectClass(page, 'Car');
  await openDrawer(page, 'Inspector');
  await addAttribute(page, 'make', 'string');
  await addAttribute(page, 'year', 'integer');
  await expect(row(page, 'make')).toBeVisible();
}

test('double-clicking a row renames the property in place', async ({ page }) => {
  await classWithAttributes(page);

  await row(page, 'make').dblclick();
  const field = nameField(page);
  await field.fill('manufacturer');
  await field.press('Enter');

  await expect(row(page, 'manufacturer')).toBeVisible();
  await expect(row(page, 'make')).toHaveCount(0);
});

test('the canvas does not zoom while a row is being renamed', async ({ page }) => {
  await classWithAttributes(page);
  const before = await page.locator('.react-flow__viewport').getAttribute('style');

  await row(page, 'make').dblclick();
  await expect(nameField(page)).toBeVisible();
  await page.waitForTimeout(700);

  // The node answers a double-click by zooming. The row has to keep this one to itself.
  expect(await page.locator('.react-flow__viewport').getAttribute('style')).toBe(before);
});

test('Escape leaves the name as it was', async ({ page }) => {
  await classWithAttributes(page);

  await row(page, 'make').dblclick();
  const field = nameField(page);
  await field.fill('somethingElse');
  await field.press('Escape');

  await expect(row(page, 'make')).toBeVisible();
  await expect(nameField(page)).toHaveCount(0);
});

test('an emptied name is flagged rather than committed', async ({ page }) => {
  await classWithAttributes(page);

  await row(page, 'make').dblclick();
  const field = nameField(page);
  await field.fill('');

  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await field.press('Enter');
  await expect(field).toBeVisible();

  await field.fill('model');
  await field.press('Enter');
  await expect(row(page, 'model')).toBeVisible();
});

test('the rename reaches every class holding the property, and says so first', async ({ page }) => {
  await classWithAttributes(page);

  // Put the same property on a second class by dragging it out of the pool.
  await openDrawer(page, 'Entities');
  await page.locator('[data-palette-kind="class"]').click();
  const second = page.locator('[data-class-node-id]').nth(1);
  await second.locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Van');
  await page.getByLabel('Class name').press('Enter');

  await openDrawer(page, 'Entities');
  await page.getByRole('tab', { name: 'Attribute' }).click();
  const box = await page.locator('[data-class-name="Van"]').boundingBox();
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  const source = page.locator('[data-datatype-property="make"]');
  const pane = page.locator('.react-flow__pane');
  const at = { clientX: box!.x + box!.width / 2, clientY: box!.y + box!.height / 2 };
  await source.dispatchEvent('dragstart', { dataTransfer: transfer });
  await pane.dispatchEvent('dragover', { dataTransfer: transfer, ...at });
  await pane.dispatchEvent('drop', { dataTransfer: transfer, ...at });
  await source.dispatchEvent('dragend', { dataTransfer: transfer });

  await expect(page.locator('[data-class-name="Van"] [data-attribute-name="make"]')).toBeVisible();

  await page.locator('[data-class-name="Car"] [data-attribute-name="make"]').dblclick();
  await expect(page.getByText('↗ 1 more')).toBeVisible();

  const field = nameField(page);
  await field.fill('manufacturer');
  await field.press('Enter');

  // One property, so both classes follow.
  await expect(page.locator('[data-attribute-name="manufacturer"]')).toHaveCount(2);
  await expect(page.locator('[data-attribute-name="make"]')).toHaveCount(0);
});

test('the renamed property is what gets exported', async ({ page }) => {
  await classWithAttributes(page);

  await row(page, 'make').dblclick();
  const field = nameField(page);
  await field.fill('manufacturer');
  await field.press('Enter');
  await expect(row(page, 'manufacturer')).toBeVisible();

  const turtle = await downloadExport(page, 'ttl');
  expect(turtle).toContain('ex:manufacturer');
  expect(turtle).not.toContain('ex:make');
});

test.describe('on a touch device', () => {
  test.use({ viewport: { width: 900, height: 700 }, hasTouch: true });

  test('double-tapping a row opens the same editor', async ({ page }) => {
    await classWithAttributes(page);

    const box = await row(page, 'make').boundingBox();
    const point = { x: box!.x + 40, y: box!.y + box!.height / 2 };
    await page.touchscreen.tap(point.x, point.y);
    await page.touchscreen.tap(point.x, point.y);

    const field = nameField(page);
    await expect(field).toBeVisible();
    await field.fill('manufacturer');
    await field.press('Enter');
    await expect(row(page, 'manufacturer')).toBeVisible();
  });
});

test('the row keeps its shape and selects the name, as the class header does', async ({ page }) => {
  await classWithAttributes(page);
  const idle = await row(page, 'make').boundingBox();
  const label = await page
    .locator('[data-attribute-name="make"] span')
    .nth(1)
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return `${style.fontSize} ${style.fontWeight}`;
    });

  await row(page, 'make').dblclick();
  const open = await page.locator('[data-usage-id]').first().boundingBox();
  const field = await nameField(page).evaluate((element) => {
    const style = getComputedStyle(element);
    const input = element as HTMLInputElement;
    return {
      type: `${style.fontSize} ${style.fontWeight}`,
      selected: input.selectionStart === 0 && input.selectionEnd === input.value.length,
    };
  });

  // Opening the editor must not resize the row or change the type, the way the header does not.
  expect(Math.round(open!.height)).toBe(Math.round(idle!.height));
  expect(Math.round(open!.width)).toBe(Math.round(idle!.width));
  expect(field.type).toBe(label);
  // The whole name is selected, so typing replaces it and a click puts the caret instead.
  expect(field.selected).toBe(true);
});

/**
 * The row's height is the app's decision, not the resolved font's.
 *
 * The test above checks the row keeps its shape, but only under whichever font the machine
 * running it happens to have. That is how the height came to be wrong: the input was sized to
 * the label's line box as measured on one machine, which held until a machine without Inter or
 * Segoe UI rendered a shorter line and the row grew as soon as the editor opened.
 *
 * Generic families rather than font names, because a name that is not installed changes nothing
 * and the test would pass without having tried anything.
 */
test('the row keeps its height whatever font the platform resolves', async ({ page }) => {
  await classWithAttributes(page);

  const make = row(page, 'make');
  const heights: number[] = [];

  for (const family of ['sans-serif', 'serif', 'monospace', 'cursive']) {
    await page.addStyleTag({ content: `:root { --font-sans: ${family}; }` });
    // The override has to have taken effect before anything is measured. Without this the row
    // can be measured in the previous font, and the test reports agreement it never tested.
    await expect
      .poll(() => make.evaluate((element) => getComputedStyle(element).fontFamily))
      .toContain(family);

    const idle = await make.boundingBox();
    await make.dblclick();

    /*
     * Wait for the editor rather than measuring straight after the gesture, for two reasons.
     * The obvious one is that the row is measured once it has changed rather than while it is
     * changing. The other is that the row stops the double-click propagating precisely so the
     * class does not zoom, so an open editor is also proof the gesture stayed where it was
     * aimed: had it reached the node, the canvas would have zoomed and every screen measurement
     * in this loop would be against a different scale.
     */
    await expect(nameField(page)).toBeVisible();
    const open = await make.boundingBox();

    // Opening the editor must not resize the row, whatever the label is being drawn in.
    expect(Math.round(open!.height), `${family}: opening the editor`).toBe(
      Math.round(idle!.height),
    );

    // Closed before the next font is measured, or the next reading is of a row still editing.
    await nameField(page).press('Escape');
    await expect(nameField(page)).toHaveCount(0);
    heights.push(Math.round(idle!.height));
  }

  // And the height is the same one in every font, rather than each font choosing its own.
  expect(new Set(heights).size, `row heights were ${heights.join(', ')}`).toBe(1);
});
