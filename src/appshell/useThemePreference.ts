import { useEffect } from 'react';
import { createPreference } from '../projectstore';

/**
 * Light/dark, following the operating system until someone chooses otherwise.
 *
 * The choice is a preference rather than part of any schema — see `projectstore/preference`,
 * which holds the three of them and the reasoning.
 */

type Theme = 'light' | 'dark';

const theme = createPreference<Theme>(
  'ontoschema.theme',
  (stored) => (stored === 'light' || stored === 'dark' ? stored : undefined),
  (value) => value,
  () => (globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
);

export function useThemePreference() {
  const current = theme.use();

  // The document carries it, so every stylesheet can see it without prop-drilling.
  useEffect(() => {
    document.documentElement.dataset.theme = current;
  }, [current]);

  return {
    theme: current,
    toggleTheme: () => theme.set(theme.get() === 'dark' ? 'light' : 'dark'),
  };
}
