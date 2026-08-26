import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openApp, settledViewport } from './ontoschema';
import { STORAGE_KEY } from '../../src/projectstore';

/**
 * Laying the schema out when nobody has.
 *
 * Positions ride in a saved file as this app's own `ontoschema:layout` annotation. A file
 * written anywhere else does not have one, so every class used to arrive at the same
 * coordinate and the canvas opened as a single illegible pile — which is what this covers, in
 * a real browser, because the pile is a thing you can only see once boxes have been measured
 * and painted.
 *
 * The same arrangement is on a button, for a canvas that has been dragged into a mess.
 */

/** A schema written by hand: no layout annotation anywhere in it. */
const FOREIGN_TURTLE = `@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix ex:   <https://example.org/library#> .

ex: a owl:Ontology .

ex:Author     a owl:Class .
ex:Book       a owl:Class .
ex:Chapter    a owl:Class .
ex:Publisher  a owl:Class .
ex:Library    a owl:Class .
ex:Reader     a owl:Class .

ex:wrote     a owl:ObjectProperty ; rdfs:domain ex:Author    ; rdfs:range ex:Book .
ex:contains  a owl:ObjectProperty ; rdfs:domain ex:Book      ; rdfs:range ex:Chapter .
ex:publishes a owl:ObjectProperty ; rdfs:domain ex:Publisher ; rdfs:range ex:Book .
ex:holds     a owl:ObjectProperty ; rdfs:domain ex:Library   ; rdfs:range ex:Book .
ex:borrows   a owl:ObjectProperty ; rdfs:domain ex:Reader    ; rdfs:range ex:Book .
`;

const CLASS_NAMES = ['Author', 'Book', 'Chapter', 'Publisher', 'Library', 'Reader'];

/** Where each class box actually is on screen, in viewport pixels. */
async function boxes(page: Page) {
  const found: { name: string; x: number; y: number; width: number; height: number }[] = [];
  for (const name of CLASS_NAMES) {
    const box = await page.locator(`[data-class-name="${name}"]`).first().boundingBox();
    if (box) found.push({ name, ...box });
  }
  return found;
}

const overlaps = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Every pair of boxes that is sitting on top of another. */
const collisions = (found: Awaited<ReturnType<typeof boxes>>) =>
  found
    .flatMap((box, index) => found.slice(index + 1).map((other) => [box, other] as const))
    .filter(([a, b]) => overlaps(a, b))
    .map(([a, b]) => `${a.name}/${b.name}`);

/**
 * Where the classes are in the model, read back out of the persisted workspace.
 *
 * Not from the screen. Arranging frames the camera on the new drawing, so a screen coordinate
 * after an arrange is a fact about the camera as much as about the layout — which is exactly
 * what the two tests below must not measure. Overlap is safe to read from the screen because
 * pan and zoom apply to every box equally; a coordinate is not.
 *
 * The workspace is written on a queue with a 500ms debounce, so a read taken straight after a
 * gesture is usually still showing the state before it. Every caller below waits for the value
 * it expects rather than for the writing to stop — waiting for it to stop is not enough at this
 * sampling rate, because two reads 100ms apart are both stale while one write is pending.
 */
async function placed(page: Page): Promise<Record<string, string>> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const workspace = JSON.parse(raw) as {
      activeProjectId: string;
      projects: {
        id: string;
        ontology: { classes: { localName: string; position: { x: number; y: number } }[] };
      }[];
    };
    const project = workspace.projects.find((one) => one.id === workspace.activeProjectId);
    const out: Record<string, string> = {};
    for (const entity of project?.ontology.classes ?? []) {
      out[entity.localName] = `${Math.round(entity.position.x)},${Math.round(entity.position.y)}`;
    }
    return out;
  }, STORAGE_KEY);
}

/**
 * The saved positions, once they are a real arrangement rather than the pile an import starts
 * as. Distinctness is the tell, and it is the property the unit tests hold the layout to.
 */
async function arranged(page: Page): Promise<Record<string, string>> {
  await expect
    .poll(
      async () => {
        const at = Object.values(await placed(page));
        return at.length > 0 && new Set(at).size === at.length;
      },
      { message: 'the saved workspace never took an arrangement' },
    )
    .toBe(true);
  return placed(page);
}

/** Drags a class by its header, the way the other canvas tests do. */
async function dragBy(page: Page, className: string, dx: number, dy: number) {
  const header = await page
    .locator(`[data-class-name="${className}"] header`)
    .first()
    .boundingBox();
  if (!header) throw new Error(`class ${className} not on canvas`);
  const x = header.x + header.width / 2;
  const y = header.y + header.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 15 });
  await page.mouse.up();
}

async function openForeignFile(page: Page) {
  await page.locator('input[aria-label="Open project file"]').setInputFiles({
    name: 'library.ttl',
    mimeType: 'text/turtle',
    buffer: Buffer.from(FOREIGN_TURTLE),
  });
}

test('lays out a file that arrives with no layout of its own', async ({ page }) => {
  await openApp(page);
  await openForeignFile(page);

  await expect(page.locator('[data-class-name="Book"]')).toBeVisible();
  const found = await boxes(page);
  expect(found).toHaveLength(CLASS_NAMES.length);

  // The bug, stated as the test that catches it: six classes, six places.
  const corners = new Set(found.map((box) => `${Math.round(box.x)},${Math.round(box.y)}`));
  expect(corners.size).toBe(CLASS_NAMES.length);
  expect(collisions(found)).toEqual([]);
});

/*
 * Ranked by the relations, which are the edges this view draws. Every class in the fixture
 * points at Book or is pointed at by it, so the arrangement should separate the two directions
 * rather than lining all six up in a row.
 */
test('ranks the classes along their relations', async ({ page }) => {
  await openApp(page);
  await openForeignFile(page);
  await expect(page.locator('[data-class-name="Chapter"]')).toBeVisible();

  const found = await boxes(page);
  const at = (name: string) => found.find((box) => box.name === name);
  const author = at('Author');
  const book = at('Book');
  const chapter = at('Chapter');
  expect(author && book && chapter).toBeTruthy();
  if (!author || !book || !chapter) return;

  // Author wrote Book contains Chapter, so they read left to right in that order.
  expect(book.x).toBeGreaterThan(author.x);
  expect(chapter.x).toBeGreaterThan(book.x);
});

test('puts a canvas that has been dragged into a mess back in order', async ({ page }) => {
  await openApp(page);
  await openForeignFile(page);
  await expect(page.locator('[data-class-name="Book"]')).toBeVisible();
  await settledViewport(page);

  // Every class onto the same spot, which is the state the button exists for.
  const target = await page.locator('[data-class-name="Book"] header').first().boundingBox();
  expect(target).toBeTruthy();
  if (!target) return;
  for (const name of ['Author', 'Chapter', 'Publisher']) {
    const header = await page.locator(`[data-class-name="${name}"] header`).first().boundingBox();
    if (!header) continue;
    await dragBy(page, name, target.x - header.x, target.y - header.y);
  }
  expect(collisions(await boxes(page)).length).toBeGreaterThan(0);

  await page.getByTestId('arrange').click();
  await settledViewport(page);

  expect(collisions(await boxes(page))).toEqual([]);
});

/*
 * Deterministic, which is what makes it a button rather than a dice roll: press it twice and
 * land in the same place. An arrangement you cannot ask for again is one you cannot get back
 * to after trying something else.
 */
test('gives the same arrangement every time it is pressed', async ({ page }) => {
  await openApp(page);
  await openForeignFile(page);
  await expect(page.locator('[data-class-name="Book"]')).toBeVisible();

  await settledViewport(page);

  // The arrangement the import produced is the reference: pressing the button must reproduce it.
  const once = await arranged(page);
  expect(Object.keys(once)).toHaveLength(CLASS_NAMES.length);

  await dragBy(page, 'Book', 180, 120);
  await expect.poll(async () => (await placed(page))['Book']).not.toBe(once['Book']);

  await page.getByTestId('arrange').click();
  await expect.poll(() => placed(page)).toEqual(once);
});

test('is one undo away, unlike the arrangement an import arrives with', async ({ page }) => {
  await openApp(page);
  await openForeignFile(page);
  await expect(page.locator('[data-class-name="Book"]')).toBeVisible();

  await settledViewport(page);
  const tidy = (await arranged(page))['Book'];
  expect(tidy).toBeDefined();

  // Move it somewhere of its own, then tidy, then take the tidy back.
  await dragBy(page, 'Book', 260, 190);
  await expect.poll(async () => (await placed(page))['Book']).not.toBe(tidy);
  const dragged = (await placed(page))['Book'];

  await page.getByTestId('arrange').click();
  await expect.poll(async () => (await placed(page))['Book']).toBe(tidy);

  /*
   * The arrangement an import arrives with is not in the history -- an undo that puts every
   * class back in one pile is not a state anyone asked to return to -- so this undo takes back
   * the button press and nothing else.
   */
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await placed(page))['Book']).toBe(dragged);
});

test('offers the button on the schema view only', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('arrange')).toBeVisible();

  // The taxonomy view lays itself out, so there are no positions to tidy.
  await page.getByRole('tab', { name: 'Taxonomy' }).click();
  await expect(page.getByTestId('arrange')).toHaveCount(0);
});
