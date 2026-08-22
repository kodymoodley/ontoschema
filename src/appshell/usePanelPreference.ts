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
 *
 * That unfolding is **borrowed rather than kept**, which is why there are two kinds of open here.
 * A panel folded by hand stays folded as far as this preference is concerned; a selection lifts
 * it out of the way for as long as there is something to show, and deselecting hands the space
 * straight back. So the stored answer to "is the inspector folded" never changes because of what
 * happens to be selected, and a reload puts the window back the way its owner left it.
 *
 * The obvious simplification — one flag, folded when nothing is selected — is the thing that must
 * not be built. It was, once: the canvas shrank by 340px on every click, which moved the drawing
 * under the pointer and left the focus zoom computing against a width that was about to change.
 * The difference is that a borrowed reveal only moves the column when the selection goes from
 * nothing to something or back, never on a click that merely changes what is selected.
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

/** Adds or removes one member, returning the same set when that would change nothing. */
function withMember(current: Set<SidePanel>, panel: SidePanel, present: boolean): Set<SidePanel> {
  if (current.has(panel) === present) return current;
  const next = new Set(current);
  if (present) next.add(panel);
  else next.delete(panel);
  return next;
}

export function usePanelPreference() {
  /** What its owner asked for. This is what persists. */
  const [folded, setFolded] = useState<Set<SidePanel>>(initialFolded);
  /** What is being lent to something on screen. Never stored: it belongs to a selection. */
  const [revealed, setRevealed] = useState<Set<SidePanel>>(() => new Set());

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify([...folded]));
    } catch {
      // Nothing to do: the panels still fold for this session.
    }
  }, [folded]);

  /*
   * The four deliberate moves. Each one settles the question outright, so a panel put away by
   * hand cannot be holding a loan from a selection made before it.
   */
  const hide = useCallback((panel: SidePanel) => {
    setFolded((current) => withMember(current, panel, true));
    setRevealed((current) => withMember(current, panel, false));
  }, []);

  const show = useCallback((panel: SidePanel) => {
    setFolded((current) => withMember(current, panel, false));
    setRevealed((current) => withMember(current, panel, false));
  }, []);

  const isFolded = useCallback(
    (panel: SidePanel) => folded.has(panel) && !revealed.has(panel),
    [folded, revealed],
  );

  const toggle = useCallback(
    (panel: SidePanel) => {
      if (isFolded(panel)) show(panel);
      else hide(panel);
    },
    [isFolded, show, hide],
  );

  /** Lends the space to whatever is on screen, without disturbing what its owner asked for. */
  const reveal = useCallback((panel: SidePanel) => {
    setRevealed((current) => withMember(current, panel, true));
  }, []);

  /** Hands it back. Nothing happens if the panel was open because its owner wanted it open. */
  const conceal = useCallback((panel: SidePanel) => {
    setRevealed((current) => withMember(current, panel, false));
  }, []);

  return { isFolded, toggle, show, hide, reveal, conceal };
}
