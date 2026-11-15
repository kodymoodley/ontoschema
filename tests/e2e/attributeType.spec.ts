import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { addAttributeToClass, addClass, createEmptyOntology } from '../../src/ontologymodel';
import { openApp, settledViewport } from './ontoschema';
import { savedPositions, seedWorkspace } from './seedWorkspace';

/**
 * Changing an attribute's type on the class box itself.
 *
 * The type is a list laid invisibly over the type's name, in a row whose name is a button of its
 * own. What only a browser can show is that the row's other gestures survive that: a press on the
 * type does not drag the class, a double-click on it neither zooms nor renames, and the name and
 * the class still rename as they did.
 */

/** A Car with a make and a year, somewhere in the middle of the canvas. */
function car() {
  let ontology = createEmptyOntology();
  const added = addClass(ontology, { localName: 'Car', position: { x: 200, y: 160 } });
  ontology = addAttributeToClass(added.ontology, {
    classId: added.id,
    localName: 'make',
  }).ontology;
  ontology = addAttributeToClass(ontology, {
    classId: added.id,
    localName: 'year',
    range: 'integer',
  }).ontology;
  return ontology;
}

const typeOf = (page: Page, attribute: string) =>
  page.getByRole('combobox', { name: `Type of ${attribute}` });
const carBox = (page: Page) => page.locator('[data-class-name="Car"]');
const nameOf = (page: Page, attribute: string) =>
  carBox(page)
    .locator(`[data-attribute-name="${attribute}"]`)
    .getByText(attribute, { exact: true });

/*
 * Whether the class moved is read from where the schema says it is, not from the screen: the
 * canvas frames a newly opened schema a moment after it appears, and a screen position measured
 * across that would blame the gesture for the camera.
 */
async function stayedPut(page: Page, before: Record<string, string>) {
  // Saving waits half a second after the last change; give a drag time to have been saved.
  await page.waitForTimeout(800);
  expect(await savedPositions(page)).toEqual(before);
}

/** The canvas zoom, which a double-click on a class would change and framing on opening does not. */
const zoom = async (page: Page) =>
  (await page.locator('.react-flow__viewport').getAttribute('style'))?.match(/scale(([^)]+))/)?.[1];

test.beforeEach(async ({ page }) => {
  await seedWorkspace(page, 'Cars', car());
  await openApp(page);
  await expect(carBox(page)).toBeVisible();
  await settledViewport(page);
});

test('changes a type on the class box, and the inspector agrees', async ({ page }) => {
  await typeOf(page, 'year').selectOption('gYear');
  await expect(carBox(page).locator('[data-attribute-name="year"]')).toContainText('gYear');

  await nameOf(page, 'year').click();
  await expect(page.getByLabel('Attribute range')).toHaveValue('gYear');

  await page.keyboard.press('Control+z');
  await expect(carBox(page).locator('[data-attribute-name="year"]')).toContainText('integer');
});

test('a press on the type does not drag the class', async ({ page }) => {
  const before = await savedPositions(page);
  const type = (await typeOf(page, 'make').boundingBox())!;

  await page.mouse.move(type.x + type.width / 2, type.y + type.height / 2);
  await page.mouse.down();
  await page.mouse.move(type.x + 150, type.y + 120, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.press('Escape');

  await stayedPut(page, before);
});

test('a double-click on the type neither zooms nor renames', async ({ page }) => {
  const before = await zoom(page);

  await typeOf(page, 'make').dblclick();
  await page.keyboard.press('Escape');

  await settledViewport(page);
  expect(await zoom(page)).toBe(before);
  await expect(page.getByLabel('Attribute name')).toHaveCount(0);
});

test('still renames the attribute by its name, and the class by its header', async ({ page }) => {
  await nameOf(page, 'make').dblclick();
  await expect(page.getByLabel('Attribute name')).toHaveValue('make');
  await page.keyboard.press('Escape');

  await carBox(page).locator('header').getByText('Car').dblclick();
  await expect(page.getByLabel('Class name')).toHaveValue('Car');
});

test('is the next stop after the name from the keyboard', async ({ page }) => {
  await carBox(page).locator('[data-attribute-name="make"] button').focus();
  await page.keyboard.press('Tab');
  await expect(typeOf(page, 'make')).toBeFocused();
});

test.describe('on a touch screen', () => {
  test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
  test.skip(({ browserName }) => browserName === 'firefox', 'Firefox does not emulate a phone.');

  test('a tap reaches the type rather than the class', async ({ page }) => {
    const before = await savedPositions(page);

    await typeOf(page, 'make').tap();

    // The class did not take the touch for a drag, which would also have kept the list shut.
    await expect(typeOf(page, 'make')).toBeFocused();
    await stayedPut(page, before);
    await typeOf(page, 'make').selectOption('token');
    await expect(carBox(page).locator('[data-attribute-name="make"]')).toContainText('token');
  });
});
