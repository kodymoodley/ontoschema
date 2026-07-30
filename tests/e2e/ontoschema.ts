import { expect } from '@playwright/test';
import type { Download, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

/**
 * Page helpers expressed in the language of the product, so the specs read as workflows
 * rather than as selector soup. Every helper drives the real UI — no store shortcuts.
 */

export async function openApp(page: Page) {
  // Each test gets a fresh browser context, so localStorage starts empty on its own.
  // Clearing it in an init script would also wipe the workspace on reload, which is
  // exactly what the persistence test needs to survive.
  await page.goto('/');
  await expect(page.getByText('OntoSchema')).toBeVisible();
  await expect(page.getByTestId('schema-canvas')).toBeVisible();
}

/**
 * Real HTML5 drag and drop from the palette onto the canvas. The two elements must share
 * one DataTransfer, which is why this is dispatched in the page rather than via the mouse.
 */
export async function dragFromPalette(
  page: Page,
  kind: 'class' | 'attribute' | 'genericProperty',
  target: { x: number; y: number } | { onClass: string },
) {
  const source = page.locator(`[data-palette-kind="${kind}"]`);
  await expect(source).toBeVisible();

  let point: { x: number; y: number };
  if ('onClass' in target) {
    const box = await page.locator(`[data-class-name="${target.onClass}"]`).boundingBox();
    if (!box) throw new Error(`class ${target.onClass} not on canvas`);
    point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  } else {
    const canvas = await page.getByTestId('schema-canvas').boundingBox();
    if (!canvas) throw new Error('canvas not visible');
    point = { x: canvas.x + target.x, y: canvas.y + target.y };
  }

  // One DataTransfer shared by all three events, exactly as the browser does it: the
  // palette's own dragstart handler is what writes the payload into it.
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  // The drop handler lives on React Flow's root, so the event must be dispatched inside it
  // for React's delegation to reach the handler.
  const pane = page.locator('.react-flow__pane');

  await source.dispatchEvent('dragstart', { dataTransfer });
  await pane.dispatchEvent('dragover', { dataTransfer, clientX: point.x, clientY: point.y });
  await pane.dispatchEvent('drop', { dataTransfer, clientX: point.x, clientY: point.y });
  // A real drag always ends. Without this the page stays in a drag state and swallows
  // subsequent gestures such as the double-click that renames a node.
  await source.dispatchEvent('dragend', { dataTransfer });
}

/** Renames a class by double-clicking its header, as a user would on the canvas. */
export async function renameClassOnCanvas(page: Page, from: string, to: string) {
  const node = page.locator(`[data-class-name="${from}"]`);
  await node.locator('header').dblclick();
  const input = node.getByLabel('Class name');
  await input.fill(to);
  await input.press('Enter');
  await expect(page.locator(`[data-class-name="${to}"]`)).toBeVisible();
}

export async function selectClass(page: Page, localName: string) {
  await page.locator(`[data-class-name="${localName}"] header`).click();
  await expect(page.getByLabel('Class local name')).toHaveValue(localName);
}

/**
 * Draws a relation by dragging from one class's source handle to another class, which is
 * the interaction that defines rdfs:domain and rdfs:range.
 */
export async function connectClasses(page: Page, sourceName: string, targetName: string) {
  const source = page.locator(`[data-class-name="${sourceName}"]`);
  await source.hover();

  // Drag from the source class's right-hand dot to the target class's left-hand dot. The
  // drop must land on the target handle: React Flow only connects within a small radius of
  // one, so releasing over the middle of the node would do nothing.
  // `out` and `in` are the relation handles; classes also carry hidden vertical handles
  // that subclass edges attach to, so the sides must be addressed by id.
  const from = await source.locator('.react-flow__handle[data-handleid="out"]').boundingBox();
  const to = await page
    .locator(`[data-class-name="${targetName}"] .react-flow__handle[data-handleid="in"]`)
    .boundingBox();
  if (!from || !to) throw new Error('cannot locate connection handles');

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Intermediate steps let React Flow track the connection line and pick up the target.
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
}

/** Adds an attribute to the selected class through the inspector. */
export async function addAttribute(page: Page, name: string, range: string) {
  await page.getByLabel('New attribute name').fill(name);
  await page.getByLabel('New attribute range').selectOption(`xsd:${range}`);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

/** Adds an annotation to whatever is selected, with an optional language tag. */
export async function addAnnotation(page: Page, term: string, value: string, language?: string) {
  await page.getByRole('tab', { name: 'Annotations' }).click();
  await page.getByLabel('Annotation term to add').selectOption(term);
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  const row = page.locator(`[data-annotation-term="${term}"]`).last();
  await row.getByLabel(`${term} value`).fill(value);
  if (language !== undefined) await row.getByLabel(`${term} language tag`).fill(language);
}

export async function openInspectorTab(page: Page, name: string) {
  await page.getByRole('tab', { name }).click();
}

/** Clicks an export button and returns the downloaded file's contents. */
export async function downloadExport(page: Page, extension: string): Promise<string> {
  await openInspectorTab(page, 'Export');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId(`download-${extension}`).click(),
  ]);
  return readDownload(download);
}

export async function readDownload(download: Download): Promise<string> {
  const path = await download.path();
  if (!path) throw new Error('download produced no file');
  return readFile(path, 'utf8');
}
