import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { chooseNewProperty, dragFromPalette, openApp } from './ontoschema';

/**
 * Drawing a relation onto a class, and choosing the side its line meets it at.
 *
 * Letting go anywhere over a class connects to it. Near one of its sides, the line is pinned to
 * that side and stays there when the classes move; over its middle, the line is free and follows
 * them to whichever side faces the other class. An end can be moved to another side afterwards,
 * or freed again.
 */

/*
 * Wide enough that the inspector, which opens beside the canvas whenever something is selected,
 * leaves both classes in view. At the default width it covers the second one, and the pointer
 * meant for that class lands on the panel instead.
 */
test.use({ viewport: { width: 1600, height: 900 } });

const classBox = async (page: Page, name: string) => {
  const box = await page.locator(`[data-class-name="${name}"]`).boundingBox();
  if (!box) throw new Error(`no class ${name} on the canvas`);
  return box;
};

/** A point inside a class, as fractions of its width and height. */
async function pointIn(page: Page, name: string, across: number, down: number) {
  const box = await classBox(page, name);
  return { x: box.x + box.width * across, y: box.y + box.height * down };
}

/** Presses on a dot of a class and moves to a point, without letting go. */
async function startDrawing(page: Page, from: string, to: { x: number; y: number }) {
  await page.locator(`[data-class-name="${from}"]`).hover();
  const dot = await page
    .locator(`[data-class-name="${from}"] .react-flow__handle[data-handleid="source-right"]`)
    .boundingBox();
  if (!dot) throw new Error('no dot to draw from');
  await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
}

async function draw(page: Page, from: string, to: { x: number; y: number }, name: string) {
  await startDrawing(page, from, to);
  await page.mouse.up();
  await chooseNewProperty(page, name);
}

/** Drags a class by its header, by the distance given. */
async function moveClass(page: Page, name: string, by: { x: number; y: number }) {
  const header = await page.locator(`[data-class-name="${name}"] header`).boundingBox();
  if (!header) throw new Error(`no header on ${name}`);
  const start = { x: header.x + header.width - 12, y: header.y + header.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + by.x, start.y + by.y, { steps: 12 });
  await page.mouse.up();
}

/** Drags one end of a drawn line to a point. */
async function moveEnd(
  page: Page,
  line: Locator,
  end: 'source' | 'target',
  to: { x: number; y: number },
) {
  const usage = await line.getAttribute('data-usage-id');
  const anchor = await page
    .locator(`.react-flow__edge[data-id="${usage}"] .react-flow__edgeupdater-${end}`)
    .boundingBox();
  if (!anchor) throw new Error(`no ${end} end to grab`);
  await page.mouse.move(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

const line = (page: Page, name: string) => page.locator(`[data-relation-name="${name}"]`);

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await dragFromPalette(page, 'class', { x: 220, y: 220 });
  await dragFromPalette(page, 'class', { x: 680, y: 220 });
  await expect(page.locator('[data-class-name="NewClass2"]')).toBeVisible();
});

test('connects when let go over the middle of a class, and the line follows it', async ({
  page,
}) => {
  await draw(page, 'NewClass', await pointIn(page, 'NewClass2', 0.5, 0.55), 'owns');
  await expect(line(page, 'owns')).toHaveAttribute('data-to-side', 'left');

  // Moved round behind the first class, the free end goes to the side that now faces it.
  await moveClass(page, 'NewClass2', { x: -760, y: 0 });
  await expect(line(page, 'owns')).toHaveAttribute('data-to-side', 'right');
});

test('pins the line to the side it is let go near, wherever the class then goes', async ({
  page,
}) => {
  const box = await classBox(page, 'NewClass2');
  await draw(page, 'NewClass', { x: box.x + box.width / 2, y: box.y + 8 }, 'owns');
  await expect(line(page, 'owns')).toHaveAttribute('data-to-side', 'top');

  await moveClass(page, 'NewClass2', { x: -760, y: 0 });
  await expect(line(page, 'owns')).toHaveAttribute('data-to-side', 'top');

  // Kept with the schema, not only on screen.
  await page.reload();
  await expect(line(page, 'owns')).toHaveAttribute('data-to-side', 'top');
});

test('lights the side it will land on, and lets go of nothing over empty canvas', async ({
  page,
}) => {
  const box = await classBox(page, 'NewClass2');
  await startDrawing(page, 'NewClass', { x: box.x + box.width - 6, y: box.y + box.height / 2 });

  const right = page.locator(
    '[data-class-name="NewClass2"] .react-flow__handle[data-handleid="target-right"]',
  );
  await expect(right).toHaveClass(/connectingto/);
  await expect(page.getByTestId('connection-line')).toBeVisible();

  await page.mouse.move(box.x + box.width + 200, box.y + box.height + 200, { steps: 8 });
  await expect(right).not.toHaveClass(/connectingto/);
  await page.mouse.up();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('connection-line')).toHaveCount(0);
});

test('moves an end to another side, and frees it again over the middle', async ({ page }) => {
  await draw(page, 'NewClass', await pointIn(page, 'NewClass2', 0.5, 0.55), 'owns');

  const box = await classBox(page, 'NewClass2');
  await moveEnd(page, line(page, 'owns'), 'target', {
    x: box.x + box.width / 2,
    y: box.y + box.height - 6,
  });
  await expect(line(page, 'owns')).toHaveAttribute('data-to-side', 'bottom');

  await moveEnd(page, line(page, 'owns'), 'target', await pointIn(page, 'NewClass2', 0.5, 0.55));
  await expect(line(page, 'owns')).toHaveAttribute('data-to-side', 'left');
});

test('frees both ends when the line is double-clicked', async ({ page }) => {
  const box = await classBox(page, 'NewClass2');
  await draw(page, 'NewClass', { x: box.x + box.width / 2, y: box.y + 8 }, 'owns');
  await expect(line(page, 'owns')).toHaveAttribute('data-to-side', 'top');

  // The line leaves the first class straight out of its right side, so just beyond it is on it.
  const from = await classBox(page, 'NewClass');
  await page.mouse.dblclick(from.x + from.width + 30, from.y + from.height / 2);
  await expect(line(page, 'owns')).toHaveAttribute('data-to-side', 'left');
});

test('draws a relation from a class to itself when let go back on it', async ({ page }) => {
  await startDrawing(page, 'NewClass', await pointIn(page, 'NewClass', 0.4, 0.6));
  await page.mouse.up();

  await expect(page.getByRole('dialog', { name: 'Which relation?' })).toBeVisible();
});

/* A press on a dot that wobbles a pixel is not a drag, and must not ask for a relation. */
test('asks nothing when a dot is only pressed', async ({ page }) => {
  await page.locator('[data-class-name="NewClass"]').hover();
  const dot = await page
    .locator('[data-class-name="NewClass"] .react-flow__handle[data-handleid="source-right"]')
    .boundingBox();
  if (!dot) throw new Error('no dot');
  await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
  await page.mouse.down();
  await page.mouse.move(dot.x + dot.width / 2 + 2, dot.y + dot.height / 2 + 1);
  await page.mouse.up();

  await expect(page.getByRole('dialog')).toHaveCount(0);
});
