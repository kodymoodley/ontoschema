import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openApp, settledViewport } from './ontoschema';

/**
 * Two relations between the same two classes, drawn as two relations.
 *
 * A relation is a directed edge. Put a second one between the same pair — which every inverse
 * pair does, and published vocabularies are built out of them — and both used to meet each box
 * at the one point that side has a handle on. One edge's arrowhead landed exactly on the other's
 * tail, and what you saw was a single line with a head at each end: a picture of a symmetric
 * relationship, which is the opposite of what the model holds.
 *
 * Measured at the ends of the drawn paths, because that is where the two heads appeared to meet.
 * A screenshot cannot tell two coincident lines from one.
 */

const INVERSE_PAIR = `@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix ex:   <https://example.org/assess#> .

ex: a owl:Ontology .

ex:Credit  a owl:Class .
ex:Feature a owl:Class .

ex:assesses     a owl:ObjectProperty ; rdfs:domain ex:Credit  ; rdfs:range ex:Feature .
ex:isAssessedBy a owl:ObjectProperty ; rdfs:domain ex:Feature ; rdfs:range ex:Credit .
`;

async function openPair(page: Page) {
  await openApp(page);
  await page.locator('input[aria-label="Open project file"]').setInputFiles({
    name: 'assess.ttl',
    mimeType: 'text/turtle',
    buffer: Buffer.from(INVERSE_PAIR),
  });
  await expect(page.locator('[data-class-name="Credit"]')).toBeVisible();
  await expect(page.locator('[data-relation-name="assesses"]')).toBeVisible();
  await expect(page.locator('[data-relation-name="isAssessedBy"]')).toBeVisible();
  await settledViewport(page);
}

/** Where a relation's line starts and finishes, in screen pixels. */
async function endsOf(page: Page, relationName: string) {
  return page.evaluate((name) => {
    const label = document.querySelector(`[data-relation-name="${name}"]`);
    const usage = label?.getAttribute('data-usage-id');
    if (!usage) return null;
    const path = document.querySelector(
      `.react-flow__edge[data-id="${usage}"] path.react-flow__edge-path`,
    );
    if (!(path instanceof SVGGeometryElement)) return null;

    const matrix = path.getScreenCTM();
    const owner = path.ownerSVGElement;
    if (!matrix || !owner) return null;

    const at = (length: number) => {
      const local = path.getPointAtLength(length);
      const point = owner.createSVGPoint();
      point.x = local.x;
      point.y = local.y;
      const screen = point.matrixTransform(matrix);
      return { x: screen.x, y: screen.y };
    };
    return { tail: at(0), head: at(path.getTotalLength()) };
  }, relationName);
}

const apart = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

test('keeps an inverse pair from meeting the class at the same point', async ({ page }) => {
  await openPair(page);

  const there = await endsOf(page, 'assesses');
  const back = await endsOf(page, 'isAssessedBy');
  expect(there && back, 'both relations should be drawn').toBeTruthy();
  if (!there || !back) return;

  /*
   * `assesses` runs Credit → Feature and `isAssessedBy` runs Feature → Credit, so the head of
   * each lands on the box the other leaves from. Those are the two points that used to coincide,
   * and a head sitting on a tail is exactly what reads as an arrow at both ends.
   */
  expect(
    apart(there.head, back.tail),
    'the arrowhead of one relation is sitting on the tail of the other',
  ).toBeGreaterThan(8);
  expect(
    apart(back.head, there.tail),
    'the arrowhead of one relation is sitting on the tail of the other',
  ).toBeGreaterThan(8);
});

test('draws them as two separate lines rather than one', async ({ page }) => {
  await openPair(page);

  const there = await endsOf(page, 'assesses');
  const back = await endsOf(page, 'isAssessedBy');
  if (!there || !back) return;

  // Both ends of each are clear of both ends of the other: the lines are beside each other.
  for (const mine of [there.tail, there.head]) {
    for (const theirs of [back.tail, back.head]) {
      expect(apart(mine, theirs)).toBeGreaterThan(8);
    }
  }
});

/*
 * The half that must not change. A relation with the pair of classes to itself is the ordinary
 * case, and a fix for crowded diagrams that quietly nudges every uncrowded one is not a fix.
 */
test('leaves a lone relation exactly where it was', async ({ page }) => {
  await openApp(page);
  await page.locator('input[aria-label="Open project file"]').setInputFiles({
    name: 'one.ttl',
    mimeType: 'text/turtle',
    buffer: Buffer.from(`@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix ex:   <https://example.org/assess#> .
ex: a owl:Ontology .
ex:Credit a owl:Class .
ex:Feature a owl:Class .
ex:assesses a owl:ObjectProperty ; rdfs:domain ex:Credit ; rdfs:range ex:Feature .
`),
  });
  await expect(page.locator('[data-relation-name="assesses"]')).toBeVisible();
  await settledViewport(page);

  const line = await endsOf(page, 'assesses');
  const from = await page.locator('[data-class-name="Credit"]').first().boundingBox();
  expect(line && from).toBeTruthy();
  if (!line || !from) return;

  // It leaves from the middle of the side it leaves from, as it always has.
  expect(Math.abs(line.tail.y - (from.y + from.height / 2))).toBeLessThan(2);
});

test('separates them in the taxonomy view too', async ({ page }) => {
  await openPair(page);
  await page.getByRole('tab', { name: 'Taxonomy' }).click();
  await page.getByTestId('toggle-relations').click();
  await page.locator('[data-taxonomy-class="Credit"]').first().click();

  await expect(page.locator('[data-relation-name="assesses"]')).toBeVisible();
  const there = await endsOf(page, 'assesses');
  const back = await endsOf(page, 'isAssessedBy');
  expect(there && back).toBeTruthy();
  if (!there || !back) return;

  /*
   * Lanes already keep the horizontal runs apart here, so the lines were never one line — but
   * both dropped into the box at its centre, so the heads and tails still met.
   */
  expect(apart(there.head, back.tail)).toBeGreaterThan(8);
  expect(apart(back.head, there.tail)).toBeGreaterThan(8);
});
