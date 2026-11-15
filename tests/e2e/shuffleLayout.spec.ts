import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { EXAMPLES } from '../../src/examplelibrary';
import { addClass, addRelationBetween, createEmptyOntology } from '../../src/ontologymodel';
import type { Ontology } from '../../src/ontologymodel';
import { openApp, settledViewport } from './ontoschema';
import { savedPositions, seedWorkspace } from './seedWorkspace';

/**
 * Shuffling the layout: a different arrangement on every press, worked out in a worker, glided
 * into place and committed as one undo step. The unit tests hold the layouts themselves to never
 * being worse than Tidy up; this covers what only a browser can, the worker and the buttons.
 */

/** Author wrote Book contains Chapter: a chain whose direction can be read off the positions. */
function chain(): Ontology {
  let ontology = createEmptyOntology();
  const ids: string[] = [];
  for (const localName of ['Author', 'Book', 'Chapter']) {
    const added = addClass(ontology, { localName });
    ontology = added.ontology;
    ids.push(added.id);
  }
  for (const [index, localName] of ['wrote', 'contains'].entries()) {
    ontology = addRelationBetween(ontology, {
      localName,
      subjectClassId: ids[index]!,
      objectClassId: ids[index + 1]!,
    }).ontology;
  }
  return ontology;
}

/** Saved positions as numbers, for comparing which way a chain runs. */
async function coordinates(page: Page): Promise<Record<string, { x: number; y: number }>> {
  const saved = await savedPositions(page);
  return Object.fromEntries(
    Object.entries(saved).map(([name, at]) => {
      const [x = NaN, y = NaN] = at.split(',').map(Number);
      return [name, { x, y }];
    }),
  );
}

/** Which way Author, Book and Chapter run, or `null` while they are not in a line. */
async function runs(page: Page): Promise<'down' | 'across' | null> {
  const at = await coordinates(page);
  const [author, book, chapter] = [at['Author'], at['Book'], at['Chapter']];
  if (!author || !book || !chapter) return null;
  if (author.y < book.y && book.y < chapter.y) return 'down';
  if (author.x < book.x && book.x < chapter.x) return 'across';
  return null;
}

/** Every pair of class boxes on screen that sits on top of another. */
async function collisions(page: Page): Promise<string[]> {
  const boxes = await page.locator('[data-class-name]').evaluateAll((nodes) =>
    nodes.map((node) => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { name: node.getAttribute('data-class-name') ?? '', x, y, width, height };
    }),
  );
  return boxes.flatMap((a, index) =>
    boxes
      .slice(index + 1)
      .filter(
        (b) =>
          a.x < b.x + b.width &&
          b.x < a.x + a.width &&
          a.y < b.y + b.height &&
          b.y < a.y + a.height,
      )
      .map((b) => `${a.name}/${b.name}`),
  );
}

test('moves the classes somewhere new on every press, with none overlapping', async ({ page }) => {
  await seedWorkspace(page, 'Music', EXAMPLES[0]!.build());
  await openApp(page);
  const before = await savedPositions(page);

  await page.getByTestId('shuffle').click();
  await expect.poll(() => savedPositions(page)).not.toEqual(before);
  const first = await savedPositions(page);
  await settledViewport(page);
  expect(await collisions(page)).toEqual([]);

  await page.getByTestId('shuffle').click();
  await expect.poll(() => savedPositions(page)).not.toEqual(first);
  await settledViewport(page);
  expect(await collisions(page)).toEqual([]);
});

test('is one undo away', async ({ page }) => {
  await seedWorkspace(page, 'Music', EXAMPLES[0]!.build());
  await openApp(page);
  const before = await savedPositions(page);

  await page.getByTestId('shuffle').click();
  await expect.poll(() => savedPositions(page)).not.toEqual(before);

  await page.keyboard.press('Control+z');
  await expect.poll(() => savedPositions(page)).toEqual(before);
});

test('runs top to bottom until turned, and remembers the turn', async ({ page }) => {
  await seedWorkspace(page, 'Chain', chain());
  await openApp(page);

  await page.getByTestId('shuffle').click();
  await expect.poll(() => runs(page)).toBe('down');

  const turn = page.getByTestId('turn-layout');
  await expect(turn).toHaveAccessibleName('Shuffle left to right');
  await turn.click();
  await expect.poll(() => runs(page)).toBe('across');
  await expect(turn).toHaveAccessibleName('Shuffle top to bottom');

  // A preference of this browser's, like the theme, so it outlasts a reload.
  await page.reload();
  await expect(page.getByTestId('turn-layout')).toHaveAccessibleName('Shuffle top to bottom');
});

test('shuffles from the keyboard with Shift+S', async ({ page }) => {
  await seedWorkspace(page, 'Music', EXAMPLES[0]!.build());
  await openApp(page);
  const before = await savedPositions(page);

  await page.locator('.react-flow__pane').click();
  await page.keyboard.press('Shift+S');
  await expect.poll(() => savedPositions(page)).not.toEqual(before);
});

test('offers shuffling on the schema view only', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('shuffle')).toBeVisible();
  await expect(page.getByTestId('turn-layout')).toBeVisible();

  // The taxonomy view lays itself out, so there are no positions to shuffle.
  await page.getByRole('tab', { name: 'Taxonomy' }).click();
  await expect(page.getByTestId('shuffle')).toHaveCount(0);
  await expect(page.getByTestId('turn-layout')).toHaveCount(0);
});

test('leaves turning out on a phone, where the toolbar has no room for it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await expect(page.getByTestId('shuffle')).toBeVisible();
  await expect(page.getByTestId('turn-layout')).toBeHidden();
});
