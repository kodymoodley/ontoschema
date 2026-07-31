import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Contrast checked from the tokens themselves.
 *
 * axe cannot answer this in jsdom, which has no layout or painting, and checking it in a
 * real browser would only cover whatever happens to be on screen. Computing the ratios from
 * the palette covers every pairing the design system permits, and fails the moment someone
 * lightens a token past the point of legibility.
 */

const TOKENS = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

/** WCAG 2.1 AA: 4.5:1 for body text, 3:1 for large text and non-text elements. */
const AA_TEXT = 4.5;
const AA_LARGE = 3;

function blockFor(selector: string): string {
  const start = TOKENS.indexOf(selector);
  if (start < 0) throw new Error(`no ${selector} block in tokens.css`);
  const open = TOKENS.indexOf('{', start);
  const close = TOKENS.indexOf('}', open);
  return TOKENS.slice(open, close);
}

function tokensOf(selector: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [, name, value] of blockFor(selector).matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    if (name && value) values[name] = value.trim();
  }
  return values;
}

function channel(value: number): number {
  const ratio = value / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match?.[1]) throw new Error(`not a six-digit hex colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((offset) =>
    Number.parseInt(match[1]!.slice(offset, offset + 2), 16),
  );
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
}

export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

const THEMES = [
  { name: 'light', selector: ':root {' },
  { name: 'dark', selector: ":root[data-theme='dark']" },
];

/** Text tokens, and every surface they are legitimately drawn on. */
const TEXT_ON_SURFACES = ['--text-primary', '--text-secondary', '--text-tertiary'] as const;

const SURFACES = ['--surface-base', '--surface-raised', '--surface-sunken', '--surface-canvas'];

describe.each(THEMES)('$name theme', ({ selector }) => {
  const tokens = tokensOf(selector);

  it('defines every token the checks below need', () => {
    for (const name of [...TEXT_ON_SURFACES, ...SURFACES]) {
      expect(tokens[name], `${name} is missing`).toBeDefined();
    }
  });

  it.each(TEXT_ON_SURFACES)('%s is readable on every surface', (text) => {
    for (const surface of SURFACES) {
      const ratio = contrastRatio(tokens[text]!, tokens[surface]!);
      expect(
        ratio,
        `${text} on ${surface} is ${ratio.toFixed(2)}:1, below the ${AA_TEXT}:1 floor`,
      ).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('keeps the danger colour readable, since it carries error messages', () => {
    const ratio = contrastRatio(tokens['--danger']!, tokens['--surface-base']!);
    expect(ratio, `--danger is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('keeps entity accents distinguishable as non-text marks', () => {
    // Accents colour borders, dots and edges rather than body text, so 3:1 applies.
    for (const accent of ['--accent-class', '--accent-relation', '--accent-attribute']) {
      const ratio = contrastRatio(tokens[accent]!, tokens['--surface-base']!);
      expect(ratio, `${accent} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });

  it('keeps the focus ring visible against the canvas', () => {
    const ratio = contrastRatio(tokens['--focus-ring']!, tokens['--surface-canvas']!);
    expect(ratio, `--focus-ring is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_LARGE);
  });
});

describe('the ratio calculation itself', () => {
  it('matches the known extremes and mid grey', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    // #808080 on white is the textbook 3.95:1.
    expect(contrastRatio('#808080', '#ffffff')).toBeCloseTo(3.95, 1);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#123456', '#fedcba')).toBeCloseTo(contrastRatio('#fedcba', '#123456'), 6);
  });

  it('rejects a colour it cannot read', () => {
    expect(() => contrastRatio('rebeccapurple', '#ffffff')).toThrow(/six-digit hex/);
  });
});
