import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  doubleClickClass,
  dragFromPalette,
  freePointOnClass,
  openApp,
  openExamples,
  relate,
  settled,
  settledViewport,
} from './ontoschema';
import { OWNS_DOUBLE_CLICK } from '../../src/canvas/gestures';

/**
 * Edges attach to whichever side of a class actually faces the other, and double-clicking
 * bare canvas frames the whole schema again. Measured on the rendered canvas, because both
 * features are about what the diagram looks like.
 */

// Roomy enough that two classes 500px apart both sit well inside the canvas: a node placed
// past the canvas edge is still in the DOM, so the drag would silently miss its handle.
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
});

/** Drops a class at a known spot on the canvas and names it, so the geometry is controlled. */
async function newClass(page: Page, name: string, x: number, y: number) {
  await dragFromPalette(page, 'class', { x, y });
  const node = page.locator('[data-class-node-id]').last();
  await node.locator('header [title]').dblclick();
  const input = node.getByLabel('Class name');
  await input.fill(name);
  await input.press('Enter');
  await expect(page.locator(`[data-class-name="${name}"]`)).toBeVisible();
}

/** Drags a class by its header to a point the given distance away. */
async function dragClassBy(page: Page, className: string, dx: number, dy: number) {
  const box = await page.locator(`[data-class-name="${className}"] header`).boundingBox();
  if (!box) throw new Error(`class ${className} not on canvas`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 15 });
  await page.mouse.up();

  /*
   * Wait for the node to stop moving rather than guessing how long that takes. The position and
   * the edge routing come out of the same store update, so once the node's transform has held
   * still for an interval the edges beside it have been recomputed too, which is what the
   * callers go on to measure.
   */
  await settled(
    () =>
      page
        .locator(`[data-class-name="${className}"]`)
        .evaluate((element) => element.closest('.react-flow__node')?.getAttribute('style') ?? ''),
    `${className} never stopped moving after the drag`,
  );
}

/**
 * Where an edge's line starts and ends. Both these points and the node transforms below are
 * read in flow coordinates, so the two are directly comparable whatever the zoom.
 */
async function edgeEnds(page: Page, edgeSelector: string) {
  return page.evaluate((selector) => {
    const path = document.querySelector<SVGPathElement>(`${selector} path.react-flow__edge-path`);
    if (!path) return null;
    const start = path.getPointAtLength(0);
    const end = path.getPointAtLength(path.getTotalLength());
    return { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } };
  }, edgeSelector);
}

const relationEdge = async (page: Page, name: string) => {
  const usageId = await page
    .locator(`[data-relation-name="${name}"]`)
    .first()
    .getAttribute('data-usage-id');
  const ends = await edgeEnds(page, `.react-flow__edge[data-id="${usageId}"]`);
  if (!ends) throw new Error(`no edge rendered for ${name}`);
  return ends;
};

const subclassEdge = async (page: Page) => {
  const ends = await edgeEnds(page, '.react-flow__edge[data-id^="subclass:"]');
  if (!ends) throw new Error('no subclass edge rendered');
  return ends;
};

/** How many of the schema's classes are actually within the visible canvas. */
async function onScreen(page: Page) {
  return page.locator('[data-class-node-id]').evaluateAll((nodes) => {
    const pane = document.querySelector('.react-flow')?.getBoundingClientRect();
    if (!pane) return 0;
    return nodes.filter((node) => {
      const rect = node.getBoundingClientRect();
      return (
        rect.right > pane.left &&
        rect.left < pane.right &&
        rect.bottom > pane.top &&
        rect.top < pane.bottom
      );
    }).length;
  });
}

/**
 * A point on the canvas where the app will accept a double-click. Found rather than assumed:
 * once the view has been zoomed into a class, any fixed corner may well have that class
 * sitting on it, and the gesture is deliberately declined there.
 *
 * The exclusion list is the app's own, imported rather than restated. A copy here drifted
 * from it once already, and a helper that offers a point the app refuses does not read as a
 * broken helper — it reads as a broken feature.
 */
async function barePoint(page: Page) {
  const point = await page.evaluate((ownsGesture) => {
    const pane = document.querySelector('.react-flow')?.getBoundingClientRect();
    if (!pane) return null;
    for (let y = pane.top + 12; y < pane.bottom - 12; y += 24) {
      for (let x = pane.left + 12; x < pane.right - 12; x += 24) {
        const element = document.elementFromPoint(x, y);
        if (element?.closest(ownsGesture)) continue;
        if (!element?.closest('.react-flow')) continue;
        return { x, y };
      }
    }
    return null;
  }, OWNS_DOUBLE_CLICK);
  if (!point) throw new Error('no bare canvas to double-click');
  return point;
}

/** Which side of a class a point sits on, judged against that node's own box. */
async function sideOf(page: Page, className: string, point: { x: number; y: number }) {
  return page.evaluate(
    ({ name, at }) => {
      const node = document
        .querySelector(`[data-class-name="${name}"]`)
        ?.closest<HTMLElement>('.react-flow__node');
      if (!node) return 'no such node';
      const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(node.style.transform);
      if (!match) return 'no transform';

      const x = Number(match[1]);
      const y = Number(match[2]);
      const distances = {
        left: Math.abs(at.x - x),
        right: Math.abs(at.x - (x + node.offsetWidth)),
        top: Math.abs(at.y - y),
        bottom: Math.abs(at.y - (y + node.offsetHeight)),
      };
      return Object.entries(distances).sort(([, a], [, b]) => a - b)[0]?.[0] ?? 'unknown';
    },
    { name: className, at: point },
  );
}

/**
 * The line an edge draws, taken apart into the moves it makes.
 *
 * Read from the `d` attribute rather than sampled along the path, because the question is what
 * kind of line this is, and the answer is in the commands: a curve is one long cubic, a rigid
 * line is straight runs joined by small arcs at the corners.
 */
async function pathMoves(page: Page, edgeSelector: string) {
  const d = await page.evaluate((selector) => {
    const path = document.querySelector<SVGPathElement>(`${selector} path.react-flow__edge-path`);
    return path?.getAttribute('d') ?? null;
  }, edgeSelector);
  if (!d) throw new Error(`no line drawn for ${edgeSelector}`);

  const moves = d.match(/[A-Za-z][^A-Za-z]*/g) ?? [];
  const straight: { from: Point; to: Point }[] = [];
  let at: Point = { x: 0, y: 0 };

  for (const move of moves) {
    const numbers = (move.slice(1).match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    const to = { x: numbers.at(-2) ?? 0, y: numbers.at(-1) ?? 0 };
    if (move[0] === 'L') straight.push({ from: at, to });
    at = to;
  }

  return { commands: moves.map((move) => move[0]).join(''), straight };
}

interface Point {
  x: number;
  y: number;
}

test('a relation to the right leaves the right side and arrives at the left', async ({ page }) => {
  await openApp(page);
  await newClass(page, 'Car', 60, 240);
  await newClass(page, 'Dealership', 520, 240);
  await relate(page, 'Car', 'Dealership', 'offeredBy');

  const ends = await relationEdge(page, 'offeredBy');
  expect(await sideOf(page, 'Car', ends.start)).toBe('right');
  expect(await sideOf(page, 'Dealership', ends.end)).toBe('left');
});

test('a relation downwards leaves the bottom and arrives at the top', async ({ page }) => {
  await openApp(page);
  await newClass(page, 'Car', 300, 60);
  await newClass(page, 'Engine', 300, 480);
  await relate(page, 'Car', 'Engine', 'hasEngine');

  const ends = await relationEdge(page, 'hasEngine');
  expect(await sideOf(page, 'Car', ends.start)).toBe('bottom');
  expect(await sideOf(page, 'Engine', ends.end)).toBe('top');
});

test('a relation drawn backwards leaves the left and arrives at the right', async ({ page }) => {
  await openApp(page);
  await newClass(page, 'Dealership', 520, 240);
  await newClass(page, 'Car', 60, 240);
  // Drawn from the class on the right to the one on the left: the arrow still points at Car,
  // but the line should take the short way round rather than looping back on itself.
  await relate(page, 'Dealership', 'Car', 'stocks');

  const ends = await relationEdge(page, 'stocks');
  expect(await sideOf(page, 'Dealership', ends.start)).toBe('left');
  expect(await sideOf(page, 'Car', ends.end)).toBe('right');
});

test('re-routes when a class is dragged round to the other side', async ({ page }) => {
  await openApp(page);
  await newClass(page, 'Car', 60, 240);
  await newClass(page, 'Dealership', 520, 240);
  await relate(page, 'Car', 'Dealership', 'offeredBy');

  expect(await sideOf(page, 'Car', (await relationEdge(page, 'offeredBy')).start)).toBe('right');

  // Move Dealership up and back over Car, so the two now face each other vertically.
  await dragClassBy(page, 'Dealership', -400, -200);

  const after = await relationEdge(page, 'offeredBy');
  expect(await sideOf(page, 'Car', after.start)).toBe('top');
  expect(await sideOf(page, 'Dealership', after.end)).toBe('bottom');
});

test('a relation can be drawn by hand from any side', async ({ page }) => {
  await openApp(page);
  await newClass(page, 'Car', 300, 60);
  await newClass(page, 'Engine', 300, 480);

  const from = await page
    .locator('[data-class-name="Car"] .react-flow__handle[data-handleid="source-bottom"]')
    .boundingBox();
  const to = await page
    .locator('[data-class-name="Engine"] .react-flow__handle[data-handleid="target-top"]')
    .boundingBox();
  if (!from || !to) throw new Error('cannot locate the bottom and top handles');

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();

  await expect(page.getByRole('dialog', { name: 'Which relation?' })).toBeVisible();
  await page.getByLabel('New relation name').fill('hasEngine');
  await page.getByTestId('confirm-connection').click();
  await expect(page.locator('[data-relation-name="hasEngine"]')).toBeVisible();
});

test('a subclass link stays vertical when the child is dragged above its parent', async ({
  page,
}) => {
  await openApp(page);
  await newClass(page, 'Vehicle', 300, 300);
  await newClass(page, 'Car', 300, 620);
  await page.locator('[data-class-name="Car"] header').click();
  await page.getByLabel('Superclass').selectOption({ label: 'Vehicle' });
  await expect(page.locator('.react-flow__edge[data-id^="subclass:"]')).toHaveCount(1);

  // The usual arrangement: child below, so the link leaves its top.
  expect(await sideOf(page, 'Car', (await subclassEdge(page)).start)).toBe('top');

  await dragClassBy(page, 'Car', 0, -500);

  // Still vertical — hierarchy stays legible — but flipped end for end rather than looping.
  const after = await subclassEdge(page);
  expect(await sideOf(page, 'Car', after.start)).toBe('bottom');
  expect(await sideOf(page, 'Vehicle', after.end)).toBe('top');
});

test('double-clicking bare canvas frames the whole schema again', async ({ page }) => {
  await openApp(page);
  await openExamples(page);
  await page.locator('[data-example="music"]').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Zoom right into one class, so most of the schema falls off screen.
  await doubleClickClass(page, 'Artist');
  await expect.poll(() => onScreen(page)).toBeLessThan(13);

  const bare = await barePoint(page);
  await page.mouse.dblclick(bare.x, bare.y);

  // Polled rather than slept on: the viewport animates for 400ms, and a fixed wait long
  // enough on an idle machine is not long enough on a busy one.
  await expect.poll(() => onScreen(page)).toBe(13);
});

test.describe('on a touch device', () => {
  test.use({ viewport: { width: 900, height: 700 }, hasTouch: true });

  /** A double-tap, sent as two taps in quick succession at the same point. */
  async function doubleTap(page: Page, x: number, y: number) {
    await page.touchscreen.tap(x, y);
    await page.touchscreen.tap(x, y);
  }

  test('double-tapping bare canvas frames the whole schema again', async ({ page }) => {
    await openApp(page);
    await openExamples(page);
    await page.locator('[data-example="music"]').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Double-tap a class to zoom into it — the same gesture, on the other target.
    const spot = await freePointOnClass(page, 'Artist');
    await doubleTap(page, spot.x, spot.y);
    await expect.poll(() => onScreen(page)).toBeLessThan(13);

    const bare = await barePoint(page);
    await doubleTap(page, bare.x, bare.y);
    await expect.poll(() => onScreen(page)).toBe(13);
  });

  test('leaves the view alone for taps that are not a double-tap', async ({ page }) => {
    await openApp(page);
    await openExamples(page);
    await page.locator('[data-example="music"]').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const spot = await freePointOnClass(page, 'Artist');
    await doubleTap(page, spot.x, spot.y);
    const zoomedIn = await settledViewport(page);

    const bare = await barePoint(page);
    const unchanged = async (what: string) =>
      expect(await page.locator('.react-flow__viewport').getAttribute('style'), what).toBe(
        zoomedIn,
      );

    await page.touchscreen.tap(bare.x, bare.y);
    await page.waitForTimeout(600);
    await unchanged('a single tap');

    // Two taps either side of the double-tap window are two separate taps.
    await page.touchscreen.tap(bare.x, bare.y);
    await page.waitForTimeout(600);
    await page.touchscreen.tap(bare.x, bare.y);
    await page.waitForTimeout(600);
    await unchanged('two slow taps');

    // Two taps in quick succession but a long way apart are not one gesture either.
    await page.touchscreen.tap(bare.x, bare.y);
    await page.touchscreen.tap(bare.x + 200, bare.y + 120);
    await page.waitForTimeout(600);
    await unchanged('two taps far apart');
  });
});

test('double-clicking a class still focuses it rather than fitting the view', async ({ page }) => {
  await openApp(page);
  await openExamples(page);
  await page.locator('[data-example="music"]').click();
  await page.locator('.react-flow__controls-fitview').click();
  await settledViewport(page);

  await doubleClickClass(page, 'Artist');
  await settledViewport(page);

  const node = await page.locator('[data-class-name="Artist"]').boundingBox();
  const canvas = await page.getByTestId('schema-canvas').boundingBox();
  if (!node || !canvas) throw new Error('could not measure');
  const share = (node.width * node.height) / (canvas.width * canvas.height);
  expect(share).toBeGreaterThanOrEqual(0.3);
  expect(share).toBeLessThanOrEqual(0.4);
});

test('double-clicking an edge label still opens it rather than fitting the view', async ({
  page,
}) => {
  await openApp(page);
  await newClass(page, 'Car', 60, 240);
  await newClass(page, 'Dealership', 520, 240);
  await relate(page, 'Car', 'Dealership', 'offeredBy');

  const before = await page.locator('.react-flow__viewport').getAttribute('style');
  await page.locator('[data-relation-name="offeredBy"]').dblclick();
  await page.waitForTimeout(600);

  expect(await page.locator('.react-flow__viewport').getAttribute('style')).toBe(before);
});

/**
 * A relation between two distant classes parks its label at the midpoint of the edge, which is
 * wherever the middle happens to be — often on top of an unrelated class. The label layer used to
 * be lifted above every node, so it covered that class and swallowed gestures aimed at it.
 */
test('a relation label passing over a class does not cover it', async ({ page }) => {
  await openApp(page);
  // Kept well inside the canvas: a node past its edge is still in the DOM, and the drag that
  // draws the relation would silently miss the handle.
  await newClass(page, 'Car', 40, 240);
  await newClass(page, 'Middle', 400, 240);
  await newClass(page, 'Dealership', 760, 240);
  await relate(page, 'Car', 'Dealership', 'offeredBy');

  const label = await page.locator('[data-relation-name="offeredBy"]').first().boundingBox();
  const middle = await page.locator('[data-class-name="Middle"]').boundingBox();
  if (!label || !middle) throw new Error('could not measure');

  // The case only exists when the label really does land over the class.
  const centre = { x: label.x + label.width / 2, y: label.y + label.height / 2 };
  expect(centre.x, 'label should overlap Middle horizontally').toBeGreaterThan(middle.x);
  expect(centre.x).toBeLessThan(middle.x + middle.width);
  expect(centre.y).toBeGreaterThan(middle.y);
  expect(centre.y).toBeLessThan(middle.y + middle.height);

  const covering = await page.evaluate((at) => {
    const top = document.elementFromPoint(at.x, at.y);
    return {
      insideTheClass: Boolean(top?.closest('[data-class-name="Middle"]')),
      insideTheLabel: Boolean(top?.closest('[data-relation-name]')),
      what: `${top?.tagName}.${top?.getAttribute('class') ?? ''}`.slice(0, 80),
    };
  }, centre);

  expect(covering.insideTheLabel, `on top: ${covering.what}`).toBe(false);
  expect(covering.insideTheClass, `on top: ${covering.what}`).toBe(true);
});

/**
 * Rigid right angles rather than a curve, which is how the taxonomy view draws its relations
 * and how the subclass links beside these have always been drawn. A curve through a crowded
 * schema takes the shortest way regardless of what is in the middle, and reads as one of
 * several lines going roughly the same way; a stepped line is followable.
 */
test('a relation is drawn as straight runs and right angles, never as a curve', async ({
  page,
}) => {
  await openApp(page);
  await newClass(page, 'Car', 60, 60);
  await newClass(page, 'Dealership', 560, 400);
  await relate(page, 'Car', 'Dealership', 'offeredBy');

  const usageId = await page
    .locator('[data-relation-name="offeredBy"]')
    .getAttribute('data-usage-id');
  const line = await pathMoves(page, `.react-flow__edge[data-id="${usageId}"]`);

  // A cubic is what a bezier draws, and there is no other reason for one to appear here.
  expect(line.commands, `drawn as ${line.commands}`).not.toContain('C');
  expect(line.straight.length, 'nothing straight was drawn').toBeGreaterThan(0);

  for (const [index, run] of line.straight.entries()) {
    const level = Math.abs(run.from.y - run.to.y) < 0.5;
    const upright = Math.abs(run.from.x - run.to.x) < 0.5;
    expect(
      level || upright,
      `run ${index} goes from ${run.from.x},${run.from.y} to ${run.to.x},${run.to.y}`,
    ).toBe(true);
  }
});

/* The two kinds of line differ by colour and arrowhead, not by how they are drawn. */
test('a relation and a subclass link are drawn the same way', async ({ page }) => {
  await openApp(page);
  await openExamples(page);
  await page.getByText('Music library', { exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const usageId = await page
    .locator('[data-relation-name="hasMember"]')
    .first()
    .getAttribute('data-usage-id');
  const relation = await pathMoves(page, `.react-flow__edge[data-id="${usageId}"]`);
  const subclass = await pathMoves(page, '.react-flow__edge[data-id^="subclass:"]');

  expect(new Set(relation.commands)).toEqual(new Set(subclass.commands));
});

/*
 * The reason the schema view steps between the facing sides rather than routing through lanes
 * as the taxonomy does: here the classes move, and the line has to keep up with them.
 */
test('stays rigid after the class it leaves has been dragged', async ({ page }) => {
  await openApp(page);
  await newClass(page, 'Car', 60, 60);
  await newClass(page, 'Dealership', 560, 400);
  await relate(page, 'Car', 'Dealership', 'offeredBy');

  await dragClassBy(page, 'Car', 240, 420);

  const usageId = await page
    .locator('[data-relation-name="offeredBy"]')
    .getAttribute('data-usage-id');
  const line = await pathMoves(page, `.react-flow__edge[data-id="${usageId}"]`);

  expect(line.commands).not.toContain('C');
  for (const run of line.straight) {
    const level = Math.abs(run.from.y - run.to.y) < 0.5;
    const upright = Math.abs(run.from.x - run.to.x) < 0.5;
    expect(level || upright, `${run.from.x},${run.from.y} to ${run.to.x},${run.to.y}`).toBe(true);
  }
});
