import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Badge, TextInput, cx } from './Primitives';
import type { BadgeTone } from './Primitives';
import styles from './searchpicker.module.css';

/**
 * A box to type in, and a list of what matches to pick from: finding an entity, and choosing
 * which relation a drawn line is.
 *
 * The list is the box's to steer. Typing stays in the box while the arrow keys move a highlight
 * through the rows, and Enter takes the highlighted row -- the pattern ARIA calls a combobox --
 * so nothing has to be tabbed to and a mouse is never needed.
 *
 * What a row is, and what picking it does, is the caller's: this knows rows only as a badge, a
 * name and a line of detail.
 */

export interface PickerRow {
  key: string;
  name: string;
  tone: BadgeTone;
  badge: string;
  /** Why the row is here, or what it is used for; one line, clipped. */
  detail?: string | null;
}

interface SearchPickerProps {
  query: string;
  onQueryChange: (query: string) => void;
  placeholder: string;
  /** The box's accessible name. */
  inputLabel: string;
  /** The list's accessible name. */
  rowsLabel: string;
  rows: readonly PickerRow[];
  onPick: (row: PickerRow) => void;
  /** The row Enter takes for this query until the arrows move it, or none. */
  highlight?: number | null;
  /** What Enter does when no row is highlighted. */
  onEnterWithoutRow?: () => void;
  /** Shown in place of the list when there are no rows. */
  empty: ReactNode;
  /** Beside the box, on its right: a button that acts on what was typed. */
  action?: ReactNode;
  /** Under the list. */
  note?: ReactNode;
  invalid?: boolean;
}

export function SearchPicker({
  query,
  onQueryChange,
  placeholder,
  inputLabel,
  rowsLabel,
  rows,
  onPick,
  highlight = null,
  onEnterWithoutRow,
  empty,
  action,
  note,
  invalid,
}: SearchPickerProps) {
  const listId = useId();
  const rowId = (index: number) => `${listId}-row-${index}`;

  /*
   * Where the arrows have put the highlight, for the query they moved it under. A new query
   * starts again from the caller's highlight, without an effect to reset anything: a highlight
   * kept for another query is simply not this query's.
   */
  const [moved, setMoved] = useState<{ query: string; index: number | null } | null>(null);
  const active = moved && moved.query === query ? moved.index : highlight;
  const moveTo = (index: number | null) => setMoved({ query, index });

  // The highlighted row stays in view as the arrows walk past the edge of the list.
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (active === null) return;
    list.current?.querySelector(`[data-row-index="${active}"]`)?.scrollIntoView?.({
      block: 'nearest',
    });
  }, [active]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && rows.length > 0) {
      event.preventDefault();
      moveTo(active === null ? 0 : Math.min(active + 1, rows.length - 1));
    } else if (event.key === 'ArrowUp' && rows.length > 0) {
      event.preventDefault();
      // Up past the first row hands Enter back to the box.
      moveTo(active === null || active === 0 ? null : active - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = active === null ? undefined : rows[active];
      if (row) onPick(row);
      else onEnterWithoutRow?.();
    }
  };

  return (
    <div className={styles.picker}>
      <div className={styles.queryRow}>
        <TextInput
          className={styles.query}
          value={query}
          // The dialog around this puts focus here when it opens.
          data-autofocus
          placeholder={placeholder}
          aria-label={inputLabel}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={rows.length > 0}
          aria-controls={listId}
          aria-activedescendant={active === null ? undefined : rowId(active)}
          invalid={invalid}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {action}
      </div>

      {rows.length === 0 ? (
        empty
      ) : (
        <ul ref={list} id={listId} role="listbox" aria-label={rowsLabel} className={styles.rows}>
          {rows.map((row, index) => (
            <li
              key={row.key}
              id={rowId(index)}
              role="option"
              aria-selected={index === active}
              className={cx(styles.row, index === active && styles.active)}
              data-result={row.name}
              data-row-index={index}
              onMouseEnter={() => moveTo(index)}
              onClick={() => onPick(row)}
            >
              <Badge tone={row.tone}>{row.badge}</Badge>
              <span className={styles.name}>{row.name}</span>
              {row.detail ? <span className={styles.detail}>{row.detail}</span> : null}
            </li>
          ))}
        </ul>
      )}

      {note}
    </div>
  );
}
