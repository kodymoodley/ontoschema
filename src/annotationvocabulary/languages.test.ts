import { describe, expect, it } from 'vitest';
import { SUGGESTED_LANGUAGE_TAGS, isValidLanguageTag, normalizeLanguageTag } from './languages';

/**
 * The tags offered under a text annotation. They are suggestions rather than a whitelist — the
 * field takes any BCP 47 tag — so what matters is that the shortlist is usable and that every
 * entry on it is something the validator would accept.
 */
describe('SUGGESTED_LANGUAGE_TAGS', () => {
  it('offers twenty, which is a list that can still be read at a glance', () => {
    expect(SUGGESTED_LANGUAGE_TAGS).toHaveLength(20);
  });

  it('uses two-letter ISO 639-1 codes throughout', () => {
    for (const tag of SUGGESTED_LANGUAGE_TAGS) expect(tag).toMatch(/^[a-z]{2}$/);
  });

  it('lists each language once', () => {
    expect(new Set(SUGGESTED_LANGUAGE_TAGS).size).toBe(SUGGESTED_LANGUAGE_TAGS.length);
  });

  it('offers nothing the field would then flag as invalid', () => {
    for (const tag of SUGGESTED_LANGUAGE_TAGS) expect(isValidLanguageTag(tag)).toBe(true);
  });

  it('is already in the form the model stores', () => {
    for (const tag of SUGGESTED_LANGUAGE_TAGS) expect(normalizeLanguageTag(tag)).toBe(tag);
  });

  it('keeps the languages it used to suggest, so nobody loses one they were using', () => {
    // The list was eleven before, weighted to western Europe. Growing it must not drop any.
    for (const tag of ['en', 'nl', 'de', 'fr', 'es', 'it', 'pt', 'sv', 'pl', 'zh', 'ja']) {
      expect(SUGGESTED_LANGUAGE_TAGS).toContain(tag);
    }
  });

  it('reaches beyond Europe, which is the point of the change', () => {
    for (const tag of ['hi', 'ar', 'bn', 'ru', 'ur', 'id', 'tr', 'ko', 'vi']) {
      expect(SUGGESTED_LANGUAGE_TAGS).toContain(tag);
    }
  });

  it('still accepts a tag that is not on the list', () => {
    expect(isValidLanguageTag('cy')).toBe(true);
    expect(isValidLanguageTag('en-GB')).toBe(true);
  });
});
