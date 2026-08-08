import { describe, expect, it } from 'vitest';
import {
  SUGGESTED_LANGUAGE_TAGS,
  isValidLanguageTag,
  languageNames,
  normalizeLanguageTag,
} from './languages';

/**
 * A language tag is optional, but one that exists has to be real — the point is that another
 * tool reading an exported file never meets a tag it cannot resolve.
 *
 * The set comes from the platform rather than from a list written here, so these tests check the
 * derivation holds up rather than checking a table against itself.
 */

describe('the derived set of languages', () => {
  it('is the same everywhere, because the codes ship rather than being asked for', () => {
    /*
     * The reason the list is generated and committed. Chromium's Intl knows 132 two-letter
     * languages where Node's knows 183, so deriving the set in the browser would mean a tag
     * saved in Firefox being stripped when the schema was opened in Chrome.
     */
    expect(languageNames().size).toBe(183);
  });

  it('recognises languages from across the world, not only Europe', () => {
    for (const code of ['en', 'zh', 'hi', 'ar', 'bn', 'sw', 'ta', 'yo', 'ko', 'nl']) {
      expect(isValidLanguageTag(code), `${code} should be a language`).toBe(true);
    }
  });

  it('refuses letter pairs that are not languages', () => {
    for (const code of ['zz', 'qq', 'xx', 'aj']) {
      expect(isValidLanguageTag(code), `${code} should not be a language`).toBe(false);
    }
  });

  it('refuses codes the platform has superseded, so a file cannot carry a stale one', () => {
    // The runtime still answers to these, but each canonicalises to something else.
    for (const [old, current] of [
      ['iw', 'he'],
      ['in', 'id'],
      ['ji', 'yi'],
      ['mo', 'ro'],
    ]) {
      expect(isValidLanguageTag(old!), `${old} is superseded`).toBe(false);
      expect(isValidLanguageTag(current!), `${current} replaces it`).toBe(true);
    }
  });

  it('names the codes it offers, since a bare code is no use in a list', () => {
    // Names come from the browser, so an engine with thinner data shows the code instead. The
    // common languages have to be named wherever the app runs.
    const names = languageNames();
    for (const code of SUGGESTED_LANGUAGE_TAGS) {
      expect(names.get(code), `${code} has no name`).not.toBe(code);
    }
    const named = [...names.values()].filter((name, index) => name !== [...names.keys()][index]);
    expect(named.length).toBeGreaterThan(100);
  });

  it('accepts only two letters — no region or script subtags', () => {
    expect(isValidLanguageTag('en')).toBe(true);
    expect(isValidLanguageTag('en-GB')).toBe(false);
    expect(isValidLanguageTag('zh-Hant-TW')).toBe(false);
    expect(isValidLanguageTag('eng')).toBe(false);
  });
});

describe('normalizeLanguageTag', () => {
  it('settles casing and surrounding space', () => {
    expect(normalizeLanguageTag('  EN ')).toBe('en');
    expect(normalizeLanguageTag('Nl')).toBe('nl');
  });

  it('returns nothing for a tag that is not a language, which is what drops it', () => {
    // The mutation that writes a language treats an empty result as "no tag", so this is the
    // single place an invalid tag is turned away before it can reach the model.
    expect(normalizeLanguageTag('zz')).toBe('');
    expect(normalizeLanguageTag('en-GB')).toBe('');
    expect(normalizeLanguageTag('')).toBe('');
    expect(normalizeLanguageTag('   ')).toBe('');
  });
});

describe('SUGGESTED_LANGUAGE_TAGS', () => {
  it('offers twenty, which is a list that can still be read at a glance', () => {
    expect(SUGGESTED_LANGUAGE_TAGS).toHaveLength(20);
  });

  it('lists each language once', () => {
    expect(new Set(SUGGESTED_LANGUAGE_TAGS).size).toBe(SUGGESTED_LANGUAGE_TAGS.length);
  });

  it('offers nothing the validator would then turn away', () => {
    for (const tag of SUGGESTED_LANGUAGE_TAGS) {
      expect(isValidLanguageTag(tag), `${tag} is not a current language`).toBe(true);
    }
  });

  it('keeps the languages that were suggested before, so nobody loses one', () => {
    for (const tag of ['en', 'nl', 'de', 'fr', 'es', 'it', 'pt', 'sv', 'pl', 'zh', 'ja']) {
      expect(SUGGESTED_LANGUAGE_TAGS).toContain(tag);
    }
  });
});
