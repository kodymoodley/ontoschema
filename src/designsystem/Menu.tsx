import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { Button } from './Primitives';
import styles from './primitives.module.css';

/**
 * A button that reveals a short list of actions.
 *
 * Built as a disclosure — a button whose `aria-expanded` says whether a panel is showing — rather
 * than as an ARIA menu. The menu pattern brings roving `tabindex`, arrow-key navigation and
 * type-ahead, and is what an application menu bar wants; a handful of actions behind one button
 * is not that, and a disclosure does the same job with ordinary buttons every assistive
 * technology already understands. Tab moves through the actions, which is what people try first.
 *
 * The panel is rendered into the document body rather than beside its trigger. Below the
 * three-column breakpoint the header scrolls sideways, and an element that scrolls clips whatever
 * hangs out of it: positioned inline, the panel was cut off a few pixels below the button on a
 * phone. Fixed coordinates measured from the trigger put it back where it belongs, and the
 * position is taken fresh each time it opens rather than remembered.
 */

interface MenuProps {
  /** Names the trigger and the panel for assistive technology. */
  label: string;
  /** Shown on the trigger. Defaults to the label. */
  triggerLabel?: ReactNode;
  /** The actions. Ordinary buttons; each one closes the panel when it is used. */
  children: ReactNode;
  className?: string | undefined;
  'data-testid'?: string | undefined;
}

interface Anchor {
  top: number;
  right: number;
}

export function Menu({ label, triggerLabel, children, className, ...rest }: MenuProps) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const panelId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const open = anchor !== null;

  /* The trigger is the only button inside the wrapper; the actions live in the portal. */
  const triggerButton = () => wrapper.current?.querySelector('button') ?? null;

  const close = useCallback((returnFocus: boolean) => {
    setAnchor(null);
    if (returnFocus) triggerButton()?.focus();
  }, []);

  const toggle = () => {
    if (open) {
      close(false);
      return;
    }
    const box = triggerButton()?.getBoundingClientRect();
    if (!box) return;
    // Anchored to the trigger's right edge, so the panel opens inwards and stays on screen.
    setAnchor({ top: box.bottom + 4, right: Math.max(4, window.innerWidth - box.right) });
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };
    /*
     * `pointerdown` rather than `click`. A click arrives after the control it landed on has
     * already acted, so a second trigger elsewhere would open and then be closed by its own event.
     */
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrapper.current?.contains(target)) return;
      if ((target as Element).closest?.(`[data-menu-panel="${panelId}"]`)) return;
      close(false);
    };
    /*
     * The coordinates are only true for as long as the trigger stays put. Rather than track it,
     * the panel closes — a menu that follows its button around a resize is more machinery than
     * a menu that politely gets out of the way.
     */
    const onViewportChange = () => close(false);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
    };
  }, [open, close, panelId]);

  return (
    <div className={`${styles.menu} ${className ?? ''}`} ref={wrapper}>
      <Button
        size="small"
        variant="subtle"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        onClick={toggle}
        {...rest}
      >
        {triggerLabel ?? label}
      </Button>

      {anchor && typeof document !== 'undefined'
        ? createPortal(
            /*
             * Choosing an action closes the panel, wherever in it the pointer landed. The
             * alternative is every caller remembering to close, and the one that forgets leaves
             * a menu hanging over the thing it has just changed.
             */
            <div
              id={panelId}
              data-menu-panel={panelId}
              role="group"
              aria-label={label}
              className={styles.menuPanel}
              style={{ top: anchor.top, right: anchor.right }}
              onClick={() => close(false)}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/**
 * Three stacked lines: the glyph a menu trigger is expected to wear.
 *
 * Drawn here beside the component it belongs to rather than pulled from an icon package, for the
 * reason the header icons give — one shape does not justify a dependency — and `currentColor` so
 * the subtle and pressed states of the trigger need no special handling. The trigger names itself
 * through `aria-label`, so this is decorative and hidden from assistive technology.
 */
export function HamburgerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
    </svg>
  );
}
