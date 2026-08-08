import { ISO_639_1 } from './iso639-1';

/**
 * Language tags for text annotations.
 *
 * A tag is optional, but when there is one it has to be a real language, so that a file leaving
 * OntoSchema never makes another tool complain about an unknown tag. That means validating
 * against the actual ISO 639-1 set rather than against a shape: `zz` is well-formed and not a
 * language.
 *
 * The codes are generated rather than written out here, by a script that asks `Intl` which
 * two-letter combinations name a language and which of those are still current. They are
 * *shipped* rather than derived in the browser because each engine knows a different number of
 * them — Node and Firefox 183, Chromium 132 — and a tag valid in one browser must not be
 * stripped when the schema is opened in another.
 *
 * Names are a different matter and do come from the browser at runtime. A missing one shows the
 * bare code and a differently worded one is still the same language, so engine differences there
 * cost nothing.
 *
 * Region and script subtags are deliberately not accepted. `en-GB` is a legitimate BCP 47 tag, but
 * two letters is the whole vocabulary here, which keeps validation a set membership test.
 */

const CODES: ReadonlySet<string> = new Set(ISO_639_1);

let cache: Map<string, string> | null = null;

/** Every accepted code, mapped to a name for reading — falling back to the code itself. */
export function languageNames(): ReadonlyMap<string, string> {
  if (cache) return cache;

  const names = new Intl.DisplayNames(['en'], { type: 'language' });
  cache = new Map(ISO_639_1.map((code) => [code, names.of(code) ?? code]));
  return cache;
}

/** True for a current two-letter ISO 639-1 code, in any casing. */
export function isValidLanguageTag(tag: string): boolean {
  return CODES.has(tag.trim().toLowerCase());
}

/**
 * The form the model stores, or an empty string for anything that is not a language.
 *
 * Returning empty rather than throwing is what keeps an invalid tag out of the model: the one
 * mutation that writes a language already treats an empty result as "no tag".
 */
export function normalizeLanguageTag(tag: string): string {
  const cleaned = tag.trim().toLowerCase();
  return CODES.has(cleaned) ? cleaned : '';
}

/**
 * Offered first in the picker: the most widely spoken languages, so the common choice is near
 * the top of a list of nearly two hundred. Every one is checked against the derived set by a
 * test, so a typo here cannot smuggle in a code that is not a language.
 */
export const SUGGESTED_LANGUAGE_TAGS = [
  'en',
  'zh',
  'hi',
  'es',
  'ar',
  'fr',
  'bn',
  'pt',
  'ru',
  'ur',
  'id',
  'de',
  'ja',
  'tr',
  'ko',
  'vi',
  'it',
  'nl',
  'pl',
  'sv',
] as const;
