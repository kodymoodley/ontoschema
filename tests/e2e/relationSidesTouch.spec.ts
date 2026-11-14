import { devices, expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { chooseNewProperty, openApp, openExamples } from './ontoschema';

/**
 * Drawing a relation with a finger, on a phone.
 *
 * Nothing is ever hovered on a touch screen, which is what lit the side being aimed at with a
 * mouse; the glow has to come from the drop target itself.
 *
 * Twice: an Android-sized phone in Chromium, and an iPhone in WebKit, Safari's engine. Playwright
 * has no touch drag, so each engine is driven its own way. Chromium's touches go through the
 * DevTools Protocol, which hit-tests them as a real touch would be. WebKit speaks no such
 * protocol, so its touches are real `TouchEvent`s sent to the element the finger came down on,
 * which is where iOS sends a touch for as long as it lasts.
 */

/** The Music library example open, and Artist selected by a tap, which shows its dots. */
async function musicWithArtistSelected(page: Page) {
  await openApp(page);
  await openExamples(page);
  await page.locator('[data-example="music"]').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const artist = page.locator('[data-class-name="Artist"]');
  const header = (await artist.locator('header').boundingBox())!;
  await page.touchscreen.tap(header.x + 40, header.y + header.height / 2);
  const dot = artist.locator('.react-flow__handle[data-handleid="source-bottom"]');
  const box = (await dot.boundingBox())!;
  const target = (await page.locator('[data-class-name="SoloArtist"]').boundingBox())!;
  return {
    dot,
    from: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    // Right on SoloArtist's top dot: its side's own target still takes it.
    to: { x: target.x + target.width / 2, y: target.y + 1 },
  };
}

const topOfSoloArtist = (page: Page) =>
  page.locator('[data-class-name="SoloArtist"] .react-flow__handle[data-handleid="target-top"]');

/** The side being aimed at is lit, and seen: neither it nor its glow faded out. */
async function expectLit(page: Page) {
  const top = topOfSoloArtist(page);
  await expect(top).toHaveClass(/connectingto/);
  await expect(top).toHaveCSS('opacity', '1');
  await expect
    .poll(() => top.evaluate((zone) => getComputedStyle(zone, '::after').opacity))
    .toBe('1');
  // The inspector, opened by selecting the class, steps aside for the drag.
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toBeHidden();
}

/** Names the drawn relation, and checks it is pinned to the side it was let go on. */
async function expectPinnedOnTop(page: Page) {
  await chooseNewProperty(page, 'mentoredBy');
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toBeVisible();
  await expect(page.locator('[data-relation-name="mentoredBy"]')).toHaveAttribute(
    'data-to-side',
    'top',
  );
}

test.describe('on an Android-sized phone', () => {
  test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Driven through the DevTools Protocol.',
  );

  test('draws a relation by touch, lighting the side it will land on', async ({ page }) => {
    const { from, to } = await musicWithArtistSelected(page);

    // A dot answers to about a fingertip's width, not only to its own 9px.
    expect(
      await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-handleid'),
        { x: from.x + 12, y: from.y + 8 },
      ),
    ).toBe('source-bottom');

    const drag = await touchDrag(page, from, to);
    await expectLit(page);
    await drag.release();
    await expectPinnedOnTop(page);
  });
});

test.describe('on an iPhone', () => {
  // The device, less its engine, which a project chooses and a test file may not.
  const { defaultBrowserType: _engine, ...iPhone } = devices['iPhone 15'];
  test.use(iPhone);
  test.skip(({ browserName }) => browserName !== 'webkit', 'Safari is WebKit.');

  test('draws a relation by touch, and offers its sides readably', async ({ page }) => {
    const { dot, from, to } = await musicWithArtistSelected(page);

    const touch = (type: 'touchstart' | 'touchmove' | 'touchend', at: { x: number; y: number }) => {
      const point = { identifier: 1, clientX: at.x, clientY: at.y, pageX: at.x, pageY: at.y };
      const touches = type === 'touchend' ? [] : [point];
      return dot.dispatchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches,
        targetTouches: touches,
        changedTouches: [point],
      });
    };
    await touch('touchstart', from);
    for (let step = 1; step <= 15; step += 1) {
      await touch('touchmove', {
        x: from.x + ((to.x - from.x) * step) / 15,
        y: from.y + ((to.y - from.y) * step) / 15,
      });
    }
    await expectLit(page);
    await touch('touchend', to);
    await expectPinnedOnTop(page);

    // In a phone's narrow drawer, each side's select is wide enough to show what it holds.
    await page.getByRole('button', { name: 'Details' }).tap();
    const arrives = page.getByLabel('Side of SoloArtist the mentoredBy line arrives at');
    await expect(arrives).toHaveValue('top');
    // Room for the longest side, "Bottom", and the select's own arrow.
    await arrives.selectOption({ label: 'Bottom' });
    await expect(page.locator('[data-relation-name="mentoredBy"]')).toHaveAttribute(
      'data-to-side',
      'bottom',
    );
    expect((await arrives.boundingBox())!.width).toBeGreaterThan(100);
  });
});

async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: string, point?: { x: number; y: number }) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [point] : [] } as never);
  await send('touchStart', from);
  for (let step = 1; step <= 15; step += 1) {
    await send('touchMove', {
      x: from.x + ((to.x - from.x) * step) / 15,
      y: from.y + ((to.y - from.y) * step) / 15,
    });
  }
  return { release: () => send('touchEnd') };
}
