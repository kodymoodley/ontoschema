#!/usr/bin/env node
/**
 * Fails the build when the shipped bundle grows past its budget.
 *
 * Sizes are measured gzipped, because that is what crosses the wire. The budgets are a
 * ratchet set a little above today's output: they exist to catch an accidental import of
 * something enormous, not to force micro-optimisation. Raise them deliberately, with a
 * reason, never to make a red build go away.
 *
 * Usage: node scripts/checkBundleSize.mjs [--update]
 */

import { readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ASSETS = fileURLToPath(new URL('../dist/assets/', import.meta.url));

/**
 * Budgets in kB, gzipped, set a little above today's output. Splitting the vendors out does
 * not shrink the total — it means an app-only change does not invalidate a returning
 * visitor's cache of React, the canvas engine and the RDF writer.
 */
const BUDGETS = {
  /*
   * Our own application code. Raised from 35 for the canvas focus and fit-view gestures, which
   * brought their own touch handling, and from 36 for the work that got the browser chrome out of
   * the way on a phone.
   *
   * Measured rather than guessed at, so the next person can tell drift from a real import: 35.70
   * before that work, 35.96 with the full-screen hook and the manifest, 36.43 with the menu the
   * project actions moved into. No dependency was added -- the growth is a portal-positioned menu
   * primitive and a fullscreen hook, both ours, and the check exists to catch an accidental import
   * of something enormous rather than to argue over half a kilobyte.
   *
   * Raised from 38 for the workspace backup, which landed on 38.00 exactly -- a budget the next
   * change would break for no reason of its own. Measured: 37.53 before it, 38.00 after, and the
   * growth is a file format, two store actions and a confirmation dialog, all ours.
   */
  'index.js': 40,
  'react.js': 65,
  'canvas.js': 80, // @xyflow/react and dagre
  'rdf.js': 55, // n3
  'index.css': 12,
  'canvas.css': 6,
  /** Everything above, added up — the number that actually decides how fast the app loads. */
  total: 235,
};

/** `index-DgDSQNvl.js` and `index.js` are the same chunk; compare on the stable part. */
function chunkName(file) {
  const match = /^(.*?)-[A-Za-z0-9_-]{8,}\.(js|css)$/.exec(file);
  return match ? `${match[1]}.${match[2]}` : file;
}

async function measure() {
  const files = await readdir(ASSETS);
  const sizes = new Map();

  for (const file of files) {
    if (!/\.(js|css)$/.test(file)) continue;
    const gzipped = gzipSync(await readFile(join(ASSETS, file))).byteLength / 1024;
    sizes.set(chunkName(file), (sizes.get(chunkName(file)) ?? 0) + gzipped);
  }

  return sizes;
}

const sizes = await measure();
if (sizes.size === 0) {
  console.error('No built assets found. Run `npm run build` first.');
  process.exit(1);
}

const rows = [...sizes.entries()].sort(([a], [b]) => a.localeCompare(b));
const total = rows.reduce((sum, [, size]) => sum + size, 0);
const failures = [];

for (const [name, size] of rows) {
  const budget = BUDGETS[name];
  const verdict = budget === undefined ? 'no budget' : `${budget} kB`;
  const over = budget !== undefined && size > budget;
  if (over) failures.push(`${name} is ${size.toFixed(1)} kB gzipped, over its ${budget} kB budget`);
  console.log(
    `${over ? 'OVER' : 'ok  '}  ${name.padEnd(14)} ${size.toFixed(1).padStart(7)} kB   (${verdict})`,
  );
}

const overTotal = total > BUDGETS.total;
if (overTotal) {
  failures.push(`total is ${total.toFixed(1)} kB gzipped, over the ${BUDGETS.total} kB budget`);
}
console.log(
  `${overTotal ? 'OVER' : 'ok  '}  ${'total'.padEnd(14)} ${total.toFixed(1).padStart(7)} kB   (${BUDGETS.total} kB)`,
);

if (failures.length > 0) {
  console.error(`\nBundle budget exceeded:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
