import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Palette } from './Palette';

/**
 * The palette is a narrow column, so what it shows by default costs more than it looks. The
 * relation hint is worth reading once and was taking three lines of it permanently.
 */
function renderPalette() {
  render(<Palette onCreate={vi.fn()} onCreateObjectProperty={vi.fn()} canCreateAttribute={true} />);
  return screen.getByRole('button', { name: 'How do I draw a relation?' });
}

const hint = () => screen.queryByText(/dragging from the right edge/);

describe('the relation hint', () => {
  it('is out of the way until it is asked for', () => {
    renderPalette();
    expect(hint()).not.toBeInTheDocument();
  });

  it('opens and closes from the same control', async () => {
    const user = userEvent.setup();
    const toggle = renderPalette();

    await user.click(toggle);
    expect(hint()).toBeInTheDocument();

    await user.click(toggle);
    expect(hint()).not.toBeInTheDocument();
  });

  /*
   * A button rather than a `title` tooltip, so this has to behave like one: the state has to be
   * announced, not merely visible, or the control reads as a mystery to a screen reader.
   */
  it('says whether it is open', async () => {
    const user = userEvent.setup();
    const toggle = renderPalette();

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens from the keyboard, since it is not a hover tooltip', async () => {
    const user = userEvent.setup();
    const toggle = renderPalette();

    toggle.focus();
    await user.keyboard('{Enter}');
    expect(hint()).toBeInTheDocument();
  });
});
