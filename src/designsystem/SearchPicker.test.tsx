import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { SearchPicker } from './SearchPicker';
import type { PickerRow } from './SearchPicker';

/**
 * Steering a list from the box above it: typing stays in the box, the arrows move a highlight,
 * and Enter takes it.
 */

const rows: PickerRow[] = ['offeredBy', 'hasPart', 'ownedBy'].map((name) => ({
  key: name,
  name,
  tone: 'relation',
  badge: 'Relation',
}));

function Picker(props: {
  highlight?: number | null;
  onPick: (row: PickerRow) => void;
  onEnterWithoutRow?: () => void;
}) {
  const [query, setQuery] = useState('');
  return (
    <SearchPicker
      query={query}
      onQueryChange={setQuery}
      placeholder="Find…"
      inputLabel="Find a relation"
      rowsLabel="Relations"
      rows={rows}
      empty={<p>Nothing</p>}
      {...props}
    />
  );
}

const box = () => screen.getByRole('combobox', { name: 'Find a relation' });
const highlighted = () =>
  screen.queryByRole('option', { selected: true })?.getAttribute('data-result') ?? null;

describe('SearchPicker', () => {
  it('moves the highlight with the arrows, and hands Enter back to the box above the top', async () => {
    const user = userEvent.setup();
    render(<Picker onPick={vi.fn()} />);

    await user.click(box());
    expect(highlighted()).toBeNull();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(highlighted()).toBe('hasPart');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(highlighted()).toBe('ownedBy');
    expect(box()).toHaveAttribute(
      'aria-activedescendant',
      screen.getByText('ownedBy').closest('li')?.id,
    );

    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    expect(highlighted()).toBeNull();
    expect(box()).not.toHaveAttribute('aria-activedescendant');
  });

  it('picks the highlighted row on Enter, and otherwise does what the box asks', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onEnterWithoutRow = vi.fn();
    render(<Picker onPick={onPick} onEnterWithoutRow={onEnterWithoutRow} />);

    await user.type(box(), 'x{Enter}');
    expect(onEnterWithoutRow).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();

    await user.keyboard('{ArrowDown}{Enter}');
    expect(onPick).toHaveBeenCalledWith(rows[0]);
  });

  it('starts each query from the highlight it is given', async () => {
    const user = userEvent.setup();
    render(<Picker highlight={0} onPick={vi.fn()} />);

    expect(highlighted()).toBe('offeredBy');
    await user.click(box());
    await user.keyboard('{ArrowDown}');
    expect(highlighted()).toBe('hasPart');
    // A new query is a new list, so the arrows' place in the old one no longer applies.
    await user.type(box(), 'o');
    expect(highlighted()).toBe('offeredBy');
  });

  it('picks a row by click, and highlights what the pointer is over', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Picker onPick={onPick} />);

    await user.hover(screen.getByText('ownedBy'));
    expect(highlighted()).toBe('ownedBy');
    await user.click(screen.getByText('hasPart'));
    expect(onPick).toHaveBeenCalledWith(rows[1]);
  });
});
