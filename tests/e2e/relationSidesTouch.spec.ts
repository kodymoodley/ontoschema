import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { chooseNewProperty, openApp, openExamples } from './ontoschema';

/**
 * Drawing a relation with a finger, on a phone.
 *
 * Nothing is ever hovered on a touch screen, which is what lit the side being aimed at with a
 * mouse; the glow has to come from the drop target itself. Playwright has no touch drag, so the
 * touches are sent through the Chrome DevTools Protocol, which only Chromium speaks.
 */

test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
test.skip(({ browserName }) => browserName !== 'chromium', 'Touch drags go through Chromium.');

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

test('draws a relation by touch, lighting the side it will land on', async ({ page }) => {
  await openApp(page);
  await openExamples(page);
  await page.locator('[data-example="music"]').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // A tap selects the class, which is what shows its dots on a touch screen.
  const artist = page.locator('[data-class-name="Artist"]');
  const header = (await artist.locator('header').boundingBox())!;
  await page.touchscreen.tap(header.x + 40, header.y + header.height / 2);
  const dot = (await artist
    .locator('.react-flow__handle[data-handleid="source-bottom"]')
    .boundingBox())!;
  const target = (await page.locator('[data-class-name="SoloArtist"]').boundingBox())!;

  // Let go right on the top dot of the other class: its side's own target still takes it.
  const drag = await touchDrag(
    page,
    { x: dot.x + dot.width / 2, y: dot.y + dot.height / 2 },
    { x: target.x + target.width / 2, y: target.y + 1 },
  );
  const top = page.locator(
    '[data-class-name="SoloArtist"] .react-flow__handle[data-handleid="target-top"]',
  );
  await expect(top).toHaveClass(/connectingto/);
  // Seen, not merely targeted: neither the zone nor its glow may be faded out.
  await expect(top).toHaveCSS('opacity', '1');
  await expect
    .poll(() => top.evaluate((zone) => getComputedStyle(zone, '::after').opacity))
    .toBe('1');

  await drag.release();
  await chooseNewProperty(page, 'mentoredBy');
  await expect(page.locator('[data-relation-name="mentoredBy"]')).toHaveAttribute(
    'data-to-side',
    'top',
  );
});
