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
 * **Folding is deliberate, with one exception, and the exception is the rule the owner set.**
 * Selecting an entity opens the inspector at every width — that is what selecting means — so a
 * new selection unfolds the inspector if it was folded. Nothing else moves a panel on its own.
 * In particular nothing *folds* a panel for you: an earlier attempt collapsed the inspector
 * whenever the selection was empty, which shrank the canvas by 340px on every click, moved the
 * drawing under the pointer, and left the focus zoom computing against a width that was about to
 * change. Unfolding on a new selection is bounded in a way that was not — it can happen at most
 * once per fold, and only when the person has just asked to look at something.
 */

export type SidePanel = 'entities' | 'inspector';

const STORAGE_KEY = 'ontoschema.panels';

/**
 * How long the columns take to open or close. Mirrors the `grid-template-columns` transition in
 * `appshell.module.css`; anything measuring the canvas has to wait this out first.
 */
export const FOLD_DURATION_MS = 160;

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

  /** Changes the set only when it would differ, so a no-op call cannot cause a render. */
  const setPanel = useCallback((panel: SidePanel, isFolded: boolean) => {
    setFolded((current) => {
      if (current.has(panel) === isFolded) return current;
      const next = new Set(current);
      if (isFolded) next.add(panel);
      else next.delete(panel);
      return next;
    });
  }, []);

  const toggle = useCallback((panel: SidePanel) => {
    setFolded((current) => {
      const next = new Set(current);
      if (next.has(panel)) next.delete(panel);
      else next.add(panel);
      return next;
    });
  }, []);

  const show = useCallback((panel: SidePanel) => setPanel(panel, false), [setPanel]);
  const hide = useCallback((panel: SidePanel) => setPanel(panel, true), [setPanel]);

  return {
    isFolded: (panel: SidePanel) => folded.has(panel),
    toggle,
    show,
    hide,
  };
}
