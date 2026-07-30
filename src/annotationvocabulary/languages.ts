/** Suggested language tags for text annotations. The field accepts any BCP 47 tag. */
export const SUGGESTED_LANGUAGE_TAGS = [
  'en',
  'nl',
  'de',
  'fr',
  'es',
  'it',
  'pt',
  'sv',
  'pl',
  'zh',
  'ja',
] as const;

/** Loose BCP 47 check: primary subtag plus optional subtags, e.g. `en`, `en-GB`, `zh-Hant-TW`. */
const BCP47 = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/;

export function isValidLanguageTag(tag: string): boolean {
  return BCP47.test(tag);
}

/** Normalises casing so `EN-gb` and `en-GB` do not produce two distinct literals. */
export function normalizeLanguageTag(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed) return '';
  const [primary, ...rest] = trimmed.split('-');
  return [
    (primary ?? '').toLowerCase(),
    ...rest.map((sub) =>
      sub.length === 2 ? sub.toUpperCase() : sub.length === 4 ? capitalise(sub) : sub.toLowerCase(),
    ),
  ].join('-');
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
