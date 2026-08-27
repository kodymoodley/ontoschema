import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openApp, settledViewport } from './ontoschema';

/**
 * A relation from a class to itself, drawn so you can see it.
 *
 * `hasSubCategory` on Category, `hasPart` on Part, `isSubStandardOf` on Standard: a property
 * whose domain and range are the same class is ordinary, and published ontologies are full of
 * them. On the canvas they showed as an arrowhead arriving at the left edge of a box from
 * nothing at all.
 *
 * The line was there the whole time. `chooseSides` picks which pair of sides two classes face
 * each other across, and with one class it is asked to compare a point with itself: `dx` and
 * `dy` are both zero, every comparison ties, and it answered right-to-left — out of the box's
 * right edge and back into its own left edge, which is a straight line through the middle of
 * the box, painted underneath it. Only the arrowhead cleared the edge.
 *
 * This is measured rather than eyeballed: the drawn path is compared against the box it belongs
 * to, and has to reach outside it. A screenshot would have looked fine the entire time the bug
 * existed, because what was wrong was invisible by definition.
 */

const SELF_RELATION_TURTLE = `@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix ex:   <https://example.org/parts#> .

ex: a owl:Ontology .

ex:Category a owl:Class .
ex:Metric   a owl:Class .

ex:hasSubCategory a owl:ObjectProperty ; rdfs:domain ex:Category ; rdfs:range ex:Category .
ex:measuredBy     a owl:ObjectProperty ; rdfs:domain ex:Category ; rdfs:range ex:Metric .
`;

async function openSelfRelating(page: Page) {
  await openApp(page);
  await page.locator('input[aria-label="Open project file"]').setInputFiles({
    name: 'parts.ttl',
    mimeType: 'text/turtle',
    buffer: Buffer.from(SELF_RELATION_TURTLE),
  });
  await expect(page.locator('[data-class-name="Category"]')).toBeVisible();
  /*
   * The edges arrive a beat after the classes: React Flow will not place one until it has
   * measured the handles at both ends. Waiting for a class to appear is not waiting for the
   * lines between them, and measuring in that gap reads zero edges and calls it a pass.
   */
  await expect(page.locator('[data-relation-name="hasSubCategory"]')).toBeVisible();
  await expect(page.locator('[data-relation-name="measuredBy"]')).toBeVisible();
  await settledViewport(page);
}

/**
 * How much of the drawn line runs through the inside of a class box.
 *
 * Sampled along the path and mapped to screen coordinates, because a bounding box cannot answer
 * this: the broken route looped well outside the node on its way round, so "the path reaches
 * outside the box" was true both before and after the fix. What was actually wrong is that the
 * line crossed the box's middle and was painted underneath it, and the only honest measure of
 * that is how many points of the line land inside.
 */
async function insideFraction(page: Page, relationName: string, className: string) {
  return page.evaluate(
    ([name, cls]) => {
      const label = document.querySelector(`[data-relation-name="${name}"]`);
      const usage = label?.getAttribute('data-usage-id');
      const node = document.querySelector(`[data-class-name="${cls}"]`);
      if (!usage || !node) return null;
      const path = document.querySelector(
        `.react-flow__edge[data-id="${usage}"] path.react-flow__edge-path`,
      );
      if (!(path instanceof SVGGeometryElement)) return null;

      const toScreen = path.getScreenCTM();
      const owner = path.ownerSVGElement;
      if (!toScreen || !owner) return null;

      const box = node.getBoundingClientRect();
      // Inset, so the two points where the line meets the box do not count as running through it.
      const pad = 3;
      const total = path.getTotalLength();
      const samples = 120;
      let within = 0;
      for (let step = 0; step <= samples; step += 1) {
        const at = path.getPointAtLength((total * step) / samples);
        const point = owner.createSVGPoint();
        point.x = at.x;
        point.y = at.y;
        const screen = point.matrixTransform(toScreen);
        if (
          screen.x > box.x + pad &&
          screen.x < box.x + box.width - pad &&
          screen.y > box.y + pad &&
          screen.y < box.y + box.height - pad
        ) {
          within += 1;
        }
      }
      return within / (samples + 1);
    },
    [relationName, className] as const,
  );
}

/** The box the drawn line occupies, from the SVG path itself. */
async function pathBox(page: Page, relationName: string) {
  return page.evaluate((name) => {
    const label = document.querySelector(`[data-relation-name="${name}"]`);
    const usage = label?.getAttribute('data-usage-id');
    if (!usage) return null;
    const path = document.querySelector(
      `.react-flow__edge[data-id="${usage}"] path.react-flow__edge-path`,
    );
    if (!(path instanceof SVGGraphicsElement)) return null;
    const box = path.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }, relationName);
}

async function classBox(page: Page, className: string) {
  return page.locator(`[data-class-name="${className}"]`).first().boundingBox();
}

test('draws a self-relation clear of the class rather than under it', async ({ page }) => {
  await openSelfRelating(page);

  const through = await insideFraction(page, 'hasSubCategory', 'Category');
  expect(through, 'the self-relation was not drawn at all').not.toBeNull();
  if (through === null) return;

  /*
   * None of the line may run through the box. The broken route crossed it end to end at the
   * vertical middle, painted underneath the node, which is why all anyone saw was the arrowhead
   * clearing the left edge.
   */
  expect(through, 'the line is drawn through the box it belongs to').toBeLessThan(0.02);
});

/*
 * The other half of the same bug. A line with no width has nothing to see even when it is not
 * covered, so the path has to be big enough to read as a loop rather than as a mark.
 */
test('gives the loop enough size to be read as one', async ({ page }) => {
  await openSelfRelating(page);

  const line = await pathBox(page, 'hasSubCategory');
  expect(line).toBeTruthy();
  if (!line) return;

  expect(line.width).toBeGreaterThan(10);
  expect(line.height).toBeGreaterThan(10);
});

/* The ordinary case still behaves: a relation between two classes runs between them. */
test('still draws a relation between two classes across the gap', async ({ page }) => {
  await openSelfRelating(page);

  const line = await pathBox(page, 'measuredBy');
  const from = await classBox(page, 'Category');
  const to = await classBox(page, 'Metric');
  expect(line && from && to).toBeTruthy();
  if (!line || !from || !to) return;

  // It spans the space between the two boxes rather than sitting on either one.
  expect(line.width).toBeGreaterThan(20);
});

test('draws it in the taxonomy view too, with width', async ({ page }) => {
  await openSelfRelating(page);
  await page.getByRole('tab', { name: 'Taxonomy' }).click();
  await page.getByTestId('toggle-relations').click();
  await page.locator('[data-taxonomy-class="Category"]').first().click();

  await expect(page.locator('[data-relation-name="hasSubCategory"]')).toBeVisible();
  const line = await pathBox(page, 'hasSubCategory');
  expect(line).toBeTruthy();
  if (!line) return;

  /*
   * Here the loop goes out to a lane and back, so what would have been wrong is a drop drawn
   * straight back down over itself: height without width.
   */
  expect(line.width).toBeGreaterThan(10);
  expect(line.height).toBeGreaterThan(10);
});
