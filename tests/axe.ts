import axe from 'axe-core';
import { expect } from 'vitest';

/**
 * Runs axe over a rendered fragment and fails with the offending markup rather than a bare
 * count, so a violation is actionable from the test output alone.
 *
 * Two rules are switched off because jsdom cannot answer them honestly, not because they do
 * not matter:
 *
 *  - `color-contrast` needs real layout and painting. Contrast is checked instead by
 *    `src/designsystem/contrast.test.ts`, which computes the ratios from the tokens.
 *  - `region` wants every node inside a landmark, which is a property of a whole page and
 *    not of the panel fragments these tests mount.
 */
export async function expectNoAxeViolations(container: HTMLElement): Promise<void> {
  const results = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
      region: { enabled: false },
    },
  });

  const report = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n` +
      violation.nodes.map((node) => `    ${node.html}`).join('\n'),
  );

  expect(report, report.join('\n\n')).toEqual([]);
}
