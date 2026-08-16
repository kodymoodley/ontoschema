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
  // The brand wordmark is hidden on narrow viewports, so the header is identified by role.
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByTestId('schema-canvas')).toBeVisible();
}

/**
 * Real HTML5 drag and drop from the palette onto the canvas. The two elements must share
 * one DataTransfer, which is why this is dispatched in the page rather than via the mouse.
 */
export async function dragFromPalette(
  page: Page,
  kind: 'class' | 'attribute',
  target: { x: number; y: number } | { onClass: string },
) {
  await dragOntoCanvas(page, page.locator(`[data-palette-kind="${kind}"]`), target);
}

/** Drags an existing datatype property out of the pool and onto a class, to reuse it. */
export async function dragPropertyOntoClass(page: Page, propertyName: string, className: string) {
  await page.getByRole('tab', { name: 'Data props' }).click();
  await dragOntoCanvas(page, page.locator(`[data-datatype-property="${propertyName}"]`), {
    onClass: className,
  });
}

async function dragOntoCanvas(
  page: Page,
  source: ReturnType<Page['locator']>,
  target: { x: number; y: number } | { onClass: string },
) {
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
  await node.locator('header [title]').dblclick();
  const input = node.getByLabel('Class name');
  await input.fill(to);
  await input.press('Enter');
  await expect(page.locator(`[data-class-name="${to}"]`)).toBeVisible();
}

/**
 * A point on a class where a double-click reaches the class itself.
 *
 * Three things on a node answer the gesture before it gets there: the header renames the class,
 * an attribute row renames that property, and a relation label parked over the node belongs to
 * the edge. Labels sit above the nodes so they stay clickable, so where they land depends on the
 * whole layout and has to be found rather than assumed.
 */
export async function freePointOnClass(page: Page, className: string) {
  const found = await page.evaluate((name) => {
    const node = document.querySelector<HTMLElement>(`[data-class-name="${name}"]`);
    if (!node) return { point: null, covering: 'not on the canvas' };

    /** True when a double-click here would reach the class rather than something on top of it. */
    const reachesTheClass = (x: number, y: number) => {
      const top = document.elementFromPoint(x, y);
      return node.contains(top) && top?.closest('[data-usage-id]') === null;
    };

    /*
     * The middle of a part that owns no gesture of its own, rather than a point on a grid.
     * A grid lands on the boundary between two attribute rows sooner or later, and which of
     * them the browser reports there comes down to sub-pixel rounding — Chromium and WebKit
     * disagreed, and the scan picked a row that then opened its rename instead of focusing.
     */
    for (const part of node.querySelectorAll('footer, p')) {
      const rect = part.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) continue;

      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      if (reachesTheClass(x, y)) return { point: { x, y }, covering: '' };
    }

    // Every part was covered, most likely by a relation label. Fall back to hunting for a gap.
    const box = node.getBoundingClientRect();
    const header = node.querySelector('header')?.getBoundingClientRect();
    let covering = 'nothing scanned';
    for (let y = (header?.bottom ?? box.top) + 4; y < box.bottom - 2; y += 4) {
      for (let x = box.left + 6; x < box.right - 6; x += 8) {
        if (reachesTheClass(x, y)) return { point: { x, y }, covering: '' };
        const top = document.elementFromPoint(x, y);
        covering = node.contains(top)
          ? 'an attribute row'
          : `${top?.tagName}.${top?.getAttribute('class') ?? ''}`;
      }
    }
    return { point: null, covering };
  }, className);

  if (!found.point) throw new Error(`cannot reach ${className}: ${found.covering}`);
  return found.point;
}

/**
 * Double-clicks a class where the gesture lands on the class itself, bringing it into focus,
 * and returns once the viewport has actually begun to move.
 *
 * Waiting for the motion to start is what makes the settle check that follows deterministic.
 * Otherwise "has not started yet" and "has finished" look identical: two readings taken
 * before a slow machine got round to the first frame are equal, and the pre-gesture transform
 * gets reported as the settled one. Every measurement downstream is then taken of a viewport
 * that has not moved.
 */
export async function doubleClickClass(page: Page, className: string) {
  const viewport = page.locator('.react-flow__viewport');
  const before = await viewport.getAttribute('style');

  const { x, y } = await freePointOnClass(page, className);
  await page.mouse.dblclick(x, y);

  await expect
    .poll(() => viewport.getAttribute('style'), {
      message: `focusing ${className} did not move the viewport`,
    })
    .not.toBe(before);
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
  // Each side carries a source and a target handle, so they are addressed by id.
  const from = await source
    .locator('.react-flow__handle[data-handleid="source-right"]')
    .boundingBox();
  const to = await page
    .locator(`[data-class-name="${targetName}"] .react-flow__handle[data-handleid="target-left"]`)
    .boundingBox();
  if (!from || !to) throw new Error('cannot locate connection handles');

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Intermediate steps let React Flow track the connection line and pick up the target.
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();

  // Drawing an edge asks which object property it is.
  await expect(page.getByRole('dialog', { name: 'Which object property?' })).toBeVisible();
}

/**
 * Completes the connection picker. Passing a name creates a new property; passing an
 * existing property's label reuses it.
 */
export async function chooseNewProperty(page: Page, localName: string) {
  await page.getByLabel('New object property name').fill(localName);
  await page.getByTestId('confirm-connection').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

export async function chooseExistingProperty(page: Page, propertyName: string) {
  const picker = page.getByLabel('Object property to use');
  // Options read "hasPart (unused)" / "offeredBy (used 2×)", so match on the name and
  // select by value rather than trying to reproduce the whole label.
  const value = await picker.evaluate(
    (element, name) =>
      [...(element as HTMLSelectElement).options].find((option) =>
        option.textContent?.trim().startsWith(name),
      )?.value ?? '',
    propertyName,
  );
  if (!value) throw new Error(`no object property named ${propertyName} in the picker`);

  await picker.selectOption(value);
  await page.getByTestId('confirm-connection').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Draws a relation and names it in one step — the common path in these specs. */
export async function relate(
  page: Page,
  sourceName: string,
  targetName: string,
  propertyName: string,
) {
  await connectClasses(page, sourceName, targetName);
  await chooseNewProperty(page, propertyName);
}

/** Adds an attribute to the selected class through the inspector. */
export async function addAttribute(page: Page, name: string, range: string) {
  await page.getByLabel('New attribute name').fill(name);
  await page.getByLabel('New attribute range').selectOption(`xsd:${range}`);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByLabel('New attribute name')).toHaveValue('');
}

/** Creates an object property in the pool, without using it anywhere. */
export async function createRelation(page: Page, localName: string) {
  await page.locator('[data-palette-kind="relation"]').click();
  await page.getByLabel('Object property local name').fill(localName);
}

/** Adds an annotation to whatever is selected, with an optional language tag. */
export async function addAnnotation(page: Page, term: string, value: string, language?: string) {
  await page.getByRole('tab', { name: 'Annotations' }).click();
  await page.getByLabel('Annotation term to add').selectOption(term);
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  const row = page.locator(`[data-annotation-term="${term}"]`).last();
  await row.getByLabel(`${term} value`).fill(value);
  // Chosen from a list, not typed: the tag has to be a real ISO 639-1 code, and a select is what
  // makes that true at the point of entry.
  if (language !== undefined) await row.getByLabel(`${term} language tag`).selectOption(language);
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

/** Long enough for a gesture to reach the viewport, and the gap between settle readings. */
const ANIMATION_START_MS = 150;
const ANIMATION_SAMPLE_MS = 100;

/**
 * Waits until something reads the same twice in a row, then returns it.
 *
 * This is what to use instead of guessing a duration. A fixed wait is either too long, and the
 * suite pays for it on every run, or too short on a loaded machine, and the test fails for a
 * reason that has nothing to do with the code.
 *
 * The seed is `undefined`, which no reading can equal, so the first comparison always fails and
 * two readings are guaranteed to be a full interval apart. `expect.poll` runs its predicate once
 * immediately, so seeding it with a real reading would compare two values taken in the same frame
 * and call a moving thing settled.
 */
export async function settled<T>(read: () => Promise<T>, message: string): Promise<T> {
  let previous: T | undefined;
  await expect
    .poll(
      async () => {
        const current = await read();
        const same = current === previous;
        previous = current;
        return same;
      },
      { message, intervals: Array.from({ length: 12 }, () => ANIMATION_SAMPLE_MS) },
    )
    .toBe(true);
  return read();
}

/**
 * The canvas viewport transform, once it has stopped moving.
 *
 * Focusing and fitting both animate for 400ms. Sleeping for a fixed period long enough to
 * cover that on an idle machine is not long enough on a loaded one, and a transform read
 * mid-animation looks like the gesture half worked. Two identical readings a poll apart mean
 * it has settled.
 */
export async function settledViewport(page: Page): Promise<string | null> {
  const read = () => page.locator('.react-flow__viewport').getAttribute('style');

  // A gesture takes a moment to reach the viewport at all. Without this pause the first two
  // readings are taken before anything has moved, and the pre-animation transform is reported
  // as the settled one.
  await page.waitForTimeout(ANIMATION_START_MS);
  await settled(read, 'the canvas viewport never stopped moving');

  return read();
}
