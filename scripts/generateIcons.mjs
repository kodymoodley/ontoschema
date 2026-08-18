#!/usr/bin/env node
/**
 * Rasterises `public/icon.svg` into the PNG sizes installers ask for.
 *
 * Node cannot draw an SVG on its own, and adding an image library for three files that change
 * almost never is a poor trade: the native ones weigh about ten megabytes and slow every CI
 * install. Playwright is already here for the end-to-end suite and drives a real browser, so it
 * does the drawing.
 *
 * The SVG stays the source of truth and is what gets reviewed; these are generated output, the
 * same arrangement as `iso639-1.ts` and its script.
 *
 * Run with `npm run icons:refresh` after editing the icon. Needs the Playwright browsers, which
 * `npm run test:e2e:install` fetches.
 *
 * Usage: node scripts/generateIcons.mjs
 */
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SOURCE = new URL('../public/icon.svg', import.meta.url);

/**
 * 180 is what iOS asks of `apple-touch-icon`. 192 and 512 are what Chrome wants before it will
 * offer to install a site, and 512 is also what it scales the splash screen from.
 */
const SIZES = [
  { pixels: 180, file: 'apple-touch-icon.png' },
  { pixels: 192, file: 'icon-192.png' },
  { pixels: 512, file: 'icon-512.png' },
];

const svg = await readFile(SOURCE, 'utf8');

const browser = await chromium.launch();
try {
  for (const { pixels, file } of SIZES) {
    const page = await browser.newPage({
      viewport: { width: pixels, height: pixels },
      // Rendered at its final size rather than scaled down from one large image, so the strokes
      // stay crisp at 180 instead of being resampled from 512.
      deviceScaleFactor: 1,
    });
    /*
     * The page is the icon and nothing else: no margin, no scrollbars, and a transparent
     * background so the SVG's own fill decides every pixel.
     */
    await page.setContent(
      `<!doctype html><style>
         html,body { margin: 0; padding: 0; background: transparent; }
         svg { display: block; width: ${pixels}px; height: ${pixels}px; }
       </style>${svg}`,
      { waitUntil: 'load' },
    );

    const target = fileURLToPath(new URL(`../public/${file}`, import.meta.url));
    await page.screenshot({ path: target, omitBackground: true });
    await page.close();
    console.log(`Wrote ${file} at ${pixels}x${pixels}`);
  }
} finally {
  await browser.close();
}
