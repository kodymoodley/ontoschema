import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Primitives';
import { Menu } from './Menu';

/**
 * The disclosure, not the actions inside it.
 *
 * What is worth testing here is the closing: a panel that stays open over the thing it just
 * changed is the failure this component exists to prevent, and there are four ways out of it.
 */

function renderMenu(onChoose = vi.fn()) {
  render(
    <div>
      <button type="button">outside</button>
      <Menu label="Project actions" triggerLabel="File" data-testid="file-menu">
        <Button onClick={onChoose}>New project</Button>
        <Button onClick={vi.fn()}>Save to file</Button>
      </Menu>
    </div>,
  );
  return { trigger: screen.getByTestId('file-menu'), onChoose };
}

const action = () => screen.queryByRole('button', { name: 'New project' });

describe('opening', () => {
  it('keeps the actions out of the way until asked', () => {
    renderMenu();
    expect(action()).not.toBeInTheDocument();
  });

  it('says whether it is open, so the state is announced and not merely visible', async () => {
    const user = userEvent.setup();
    const { trigger } = renderMenu();

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(action()).toBeInTheDocument();
  });
});

describe('closing', () => {
  it('closes when an action is chosen, without each action having to remember', async () => {
    const user = userEvent.setup();
    const { trigger, onChoose } = renderMenu();

    await user.click(trigger);
    await user.click(action() as HTMLElement);

    expect(onChoose).toHaveBeenCalledOnce();
    expect(action()).not.toBeInTheDocument();
  });

  it('closes on a click outside', async () => {
    const user = userEvent.setup();
    const { trigger } = renderMenu();

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'outside' }));
    expect(action()).not.toBeInTheDocument();
  });

  it('closes on Escape and gives the keyboard back to the trigger', async () => {
    const user = userEvent.setup();
    const { trigger } = renderMenu();

    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(action()).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  /*
   * The panel is placed at coordinates measured from the trigger when it opened, so a resize
   * leaves it somewhere that no longer means anything. Closing is cheaper than following.
   */
  it('closes when the viewport changes under it', async () => {
    const user = userEvent.setup();
    const { trigger } = renderMenu();

    await user.click(trigger);
    // Dispatched outside React, so the state change it causes has to be flushed.
    act(() => window.dispatchEvent(new Event('resize')));
    expect(action()).not.toBeInTheDocument();
  });
});

describe('reaching it without a mouse', () => {
  it('opens from the keyboard and puts the actions in the tab order', async () => {
    const user = userEvent.setup();
    const { trigger } = renderMenu();

    trigger.focus();
    await user.keyboard('{Enter}');

    expect(action()).toBeInTheDocument();
    await user.tab();
    expect(action()).toHaveFocus();
  });
});
