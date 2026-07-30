import { useCallback, useEffect, useState } from 'react';

/**
 * Light/dark preference, following the operating system by default and remembering an
 * explicit choice. Stored separately from the workspace, since it is about this browser
 * rather than about any ontology.
 */

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ontoschema.theme';

function initialTheme(): Theme {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage unavailable; fall through to the system preference.
  }
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useThemePreference() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, theme);
    } catch {
      // Nothing to do: the theme still applies for this session.
    }
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
    [],
  );

  return { theme, toggleTheme };
}
