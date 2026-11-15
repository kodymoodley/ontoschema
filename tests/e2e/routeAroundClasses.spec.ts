import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { addClass, addRelationBetween, createEmptyOntology } from '../../src/ontologymodel';
import { openApp, settledViewport } from './ontoschema';
import { seedWorkspace } from './seedWorkspace';

/**
 * A relation's line goes around the classes it does not belong to.
 *
 * It used to step straight from one class to the other, and where a third class stood in the way
 * the line ran behind it and came out the other side, which reads as a line that ends there. The
 * routing is worked out in a worker by libavoid, so only a browser shows whether it arrives and
 * is drawn: these sample the line as drawn and look for any part of it inside the class between.
 */

/** Author on the left, Book on the right, and Shelf squarely on the straight line between them. */
function blocked() {
  let ontology = createEmptyOntology();
  const add = (localName: string, x: number, y: number) => {
    const added = addClass(ontology, { localName, position: { x, y } });
    ontology = added.ontology;
    return added.id;
  };
  const author = add('Author', 0, 0);
  const book = add('Book', 800, 0);
  add('Shelf', 400, -10);
  return addRelationBetween(ontology, {
    localName: 'wrote',
    subjectClassId: author,
    objectClassId: book,
  }).ontology;
}

/** How many points along the `wrote` line, sampled every few pixels, fall inside a class. */
async function pointsInside(page: Page, className: string): Promise<number> {
  return page.evaluate((name) => {
    const usage = document
      .querySelector('[data-relation-name="wrote"]')
      ?.getAttribute('data-usage-id');
    const path = document.querySelector(
      `.react-flow__edge[data-id="${usage}"] path.react-flow__edge-path`,
    );
    const box = document.querySelector(`[data-class-name="${name}"]`)?.getBoundingClientRect();
    if (!(path instanceof SVGGeometryElement) || !box) return -1;
    const matrix = path.getScreenCTM();
    const owner = path.ownerSVGElement;
    if (!matrix || !owner) return -1;

    let inside = 0;
    const total = path.getTotalLength();
    for (let length = 0; length <= total; length += 4) {
      const local = path.getPointAtLength(length);
      const point = owner.createSVGPoint();
      point.x = local.x;
      point.y = local.y;
      const { x, y } = point.matrixTransform(matrix);
      // A pixel in from the border, so a line running along it is not counted as inside.
      if (x > box.left + 1 && x < box.right - 1 && y > box.top + 1 && y < box.bottom - 1) {
        inside += 1;
      }
    }
    return inside;
  }, className);
}

/** Whether the `wrote` line is drawn as one straight horizontal run, sampled as drawn. */
async function straight(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const usage = document
      .querySelector('[data-relation-name="wrote"]')
      ?.getAttribute('data-usage-id');
    const path = document.querySelector(
      `.react-flow__edge[data-id="${usage}"] path.react-flow__edge-path`,
    );
    if (!(path instanceof SVGGeometryElement)) return false;
    const total = path.getTotalLength();
    const first = path.getPointAtLength(0).y;
    for (let length = 0; length <= total; length += 4) {
      if (Math.abs(path.getPointAtLength(length).y - first) > 0.5) return false;
    }
    return true;
  });
}

async function dragClassBy(page: Page, className: string, dx: number, dy: number) {
  const header = await page.locator(`[data-class-name="${className}"] header`).boundingBox();
  if (!header) throw new Error(`class ${className} not on canvas`);
  const x = header.x + header.width / 2;
  const y = header.y + header.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 15 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await seedWorkspace(page, 'Library', blocked());
  await openApp(page);
  await expect(page.locator('[data-relation-name="wrote"]')).toBeVisible();
  await settledViewport(page);
});

test('takes a line around a class standing in its way', async ({ page }) => {
  await expect.poll(() => pointsInside(page, 'Shelf')).toBe(0);
  // Still a line between the two classes it joins: it starts at one and ends at the other.
  expect(await pointsInside(page, 'Author')).toBe(0);
  expect(await pointsInside(page, 'Book')).toBe(0);
});

test('goes around a class dragged into the way, and straight once it is gone', async ({ page }) => {
  await expect.poll(() => pointsInside(page, 'Shelf')).toBe(0);
  expect(await straight(page)).toBe(false);

  // Off the line: it has nothing to go around, so it runs straight through where Shelf was.
  await dragClassBy(page, 'Shelf', 0, 300);
  await expect.poll(() => straight(page)).toBe(true);

  // And back into the way.
  await dragClassBy(page, 'Shelf', 0, -300);
  await expect.poll(() => pointsInside(page, 'Shelf')).toBe(0);
  expect(await straight(page)).toBe(false);
});
