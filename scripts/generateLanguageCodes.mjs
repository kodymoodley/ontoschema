#!/usr/bin/env node
/**
 * Writes the list of language codes the app accepts.
 *
 * The codes cannot be derived in the browser, even though the API exists there: `Intl` knows a
 * different number of languages in each engine — Node and Firefox recognise 183 two-letter
 * codes, Chromium 132 — so a schema saved in one browser would have its language tag stripped
 * when opened in another. The list is therefore settled once, here, and shipped.
 *
 * Only the codes are shipped. Names come from `Intl.DisplayNames` at runtime, where being
 * engine-dependent costs nothing: a missing name shows the code, and a differently worded one
 * is still the same language.
 *
 * Run with `npm run languages:refresh` after a Node upgrade to pick up new assignments.
 *
 * Usage: node scripts/generateLanguageCodes.mjs
 */
import { writeFileSync } from 'node:fs';

const OUTPUT = new URL('../src/annotationvocabulary/iso639-1.ts', import.meta.url);

const names = new Intl.DisplayNames(['en'], { type: 'language' });
const codes = [];

for (let first = 97; first <= 122; first += 1) {
  for (let second = 97; second <= 122; second += 1) {
    const code = String.fromCharCode(first, second);

    // An unrecognised code comes back unchanged, and a superseded one canonicalises to its
    // replacement — `iw` to `he`, `in` to `id`. Neither belongs in a file this app writes.
    if (names.of(code) === code) continue;
    if (Intl.getCanonicalLocales(code)[0] !== code) continue;

    codes.push(code);
  }
}

if (codes.length < 150) {
  console.error(`Only ${codes.length} languages found. This Node has a reduced ICU; not writing.`);
  process.exit(1);
}

writeFileSync(
  OUTPUT,
  `/**
 * Every current two-letter ISO 639-1 code, as recognised by the Node that generated this.
 *
 * GENERATED FILE — do not edit by hand. Run \`npm run languages:refresh\` instead.
 *
 * Shipped rather than derived in the browser because \`Intl\` recognises a different set in each
 * engine, and a language tag has to mean the same thing wherever a schema is opened.
 */
export const ISO_639_1 = [
${codes.map((code) => `  '${code}',`).join('\n')}
] as const;
`,
  'utf8',
);

console.log(`Wrote ${codes.length} language codes to ${OUTPUT.pathname}`);
