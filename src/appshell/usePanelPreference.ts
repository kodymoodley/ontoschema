import { useCallback, useEffect, useState } from 'react';

/**
 * Which side panels are folded away on a wide screen.
 *
 * Stored beside the theme rather than in the workspace, and for the same reason: it is about
 * this browser and this person, not about any schema. Opening someone else's file should not
 * rearrange your window.
 *
 * Only wide layouts have anything to fold. Below the three-column breakpoint both panels are
 * already overlay drawers that come and go, so this preference is simply not consulted there.
 *
 * **Folding is deliberate and stays deliberate.** Nothing in the app closes a panel on your
 * behalf, and nothing reopens one either. That is a decision with a measurement behind it: an
 * earlier attempt collapsed the inspector whenever the selection was empty, which shrank the
 * canvas by 340px on every click, moved the drawing under the pointer, and left the focus zoom
 * computing against a width that was about to change.
 */

export type SidePanel = 'entities' | 'inspector';

const STORAGE_KEY = 'ontoschema.panels';

/** Which panels are folded. Absent from the set means showing, so the default is both open. */
function initialFolded(): Set<SidePanel> {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!stored) return new Set();
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((name): name is SidePanel => name === 'entities' || name === 'inspector'),
    );
  } catch {
    // Unreadable or hand-edited: start with both panels showing rather than refusing to load.
    return new Set();
  }
}

export function usePanelPreference() {
  const [folded, setFolded] = useState<Set<SidePanel>>(initialFolded);

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify([...folded]));
    } catch {
      // Nothing to do: the panels still fold for this session.
    }
  }, [folded]);

  const toggle = useCallback((panel: SidePanel) => {
    setFolded((current) => {
      const next = new Set(current);
      if (next.has(panel)) next.delete(panel);
      else next.add(panel);
      return next;
    });
  }, []);

  return {
    isFolded: (panel: SidePanel) => folded.has(panel),
    toggle,
  };
}
