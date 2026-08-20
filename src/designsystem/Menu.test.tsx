import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Primitives';
import { HamburgerIcon, Menu, MenuGroup, MenuSeparator } from './Menu';

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

describe('a trigger with no words on it', () => {
  /*
   * The app's file menu wears a hamburger. A picture is not a name, so the label has to reach the
   * button itself rather than only the panel it opens -- otherwise the one control that holds
   * every file action announces itself as "button".
   */
  it('is still named by its label', () => {
    render(
      <Menu label="File" triggerLabel={<HamburgerIcon />} data-testid="file-menu">
        <Button onClick={vi.fn()}>Save to file</Button>
      </Menu>,
    );

    expect(screen.getByRole('button', { name: 'File' })).toBe(screen.getByTestId('file-menu'));
  });

  it('draws the icon without letting a screen reader read it as content', () => {
    render(
      <Menu label="File" triggerLabel={<HamburgerIcon />} data-testid="file-menu">
        <Button onClick={vi.fn()}>Save to file</Button>
      </Menu>,
    );

    const icon = screen.getByTestId('file-menu').querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});

/**
 * Grouping. Eight actions in a row read as one list; the separator and the folded group are
 * what turn them into something scannable.
 */
describe('grouping the actions', () => {
  function renderGrouped() {
    render(
      <Menu label="File" triggerLabel="File" data-testid="file-menu">
        <Button onClick={vi.fn()}>Open</Button>
        <MenuSeparator />
        <MenuGroup label="Workspace" data-testid="workspace-group">
          <Button onClick={vi.fn()}>Back up</Button>
          <Button onClick={vi.fn()}>Restore</Button>
        </MenuGroup>
      </Menu>,
    );
    return screen.getByTestId('file-menu');
  }

  it('keeps a folded group folded until it is asked for', async () => {
    const user = userEvent.setup();
    const trigger = renderGrouped();
    await user.click(trigger);

    expect(screen.getByTestId('workspace-group')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Back up' })).not.toBeInTheDocument();
  });

  /*
   * The panel closes on any click inside it, which is right for an action and wrong for a
   * control that reveals more. Opening a group and finding the whole menu gone is the failure
   * this stops.
   */
  it('opens the group without closing the menu around it', async () => {
    const user = userEvent.setup();
    const trigger = renderGrouped();
    await user.click(trigger);
    await user.click(screen.getByTestId('workspace-group'));

    expect(screen.getByRole('button', { name: 'Back up' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
    expect(screen.getByTestId('workspace-group')).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes the whole menu once an action inside the group is chosen', async () => {
    const user = userEvent.setup();
    const trigger = renderGrouped();
    await user.click(trigger);
    await user.click(screen.getByTestId('workspace-group'));
    await user.click(screen.getByRole('button', { name: 'Restore' }));

    expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument();
  });

  it('puts the group and its contents in the tab order', async () => {
    const user = userEvent.setup();
    const trigger = renderGrouped();
    trigger.focus();
    await user.keyboard('{Enter}');

    await user.tab();
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId('workspace-group')).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Back up' })).toHaveFocus();
  });

  it('marks the rule as a separator rather than leaving it a stray box', () => {
    render(<MenuSeparator />);
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });
});
