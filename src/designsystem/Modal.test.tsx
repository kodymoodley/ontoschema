import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, Field, Modal, Select, TextInput } from './index';

/**
 * A dialog shaped like the connection picker: a select first in DOM order, then the text
 * field the user actually types into, opened from a trigger the way the app opens it.
 *
 * `onClose` is an inline arrow, which is how every caller in the app writes it — and the
 * shape that broke focus.
 */
function PickerLikeDialog({ onClose = () => {} }: { onClose?: () => void }) {
  const [choice, setChoice] = useState('');
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" data-testid="trigger" onClick={() => setOpen(true)}>
        draw relation
      </button>
      <Modal
        title="Which object property?"
        open={open}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        footer={<Button>Use property</Button>}
      >
        <Field label="Property">
          <Select value={choice} aria-label="Property" onChange={(e) => setChoice(e.target.value)}>
            <option value="">— create a new property —</option>
            <option value="p1">hasPart</option>
          </Select>
        </Field>
        <Field label="New property name">
          {/* The dialog owns initial focus; callers mark the field they want it on. */}
          <TextInput
            data-autofocus
            value={name}
            aria-label="New property name"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
      </Modal>
    </>
  );
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('trigger'));
  return screen.getByRole('dialog');
}

describe('Modal focus behaviour', () => {
  it('keeps the caret in the field being typed into', async () => {
    const user = userEvent.setup();
    render(<PickerLikeDialog />);
    await openDialog(user);

    const name = screen.getByLabelText('New property name');
    await user.click(name);
    await user.keyboard('offeredBy');

    // The reported bug: after the first character the dialog re-rendered, the focus effect
    // re-ran, and focus jumped to the first focusable element — the select above.
    expect(name).toHaveFocus();
    expect(name).toHaveValue('offeredBy');
  });

  it('moves focus onto the field the caller marked, not the first control', async () => {
    const user = userEvent.setup();
    render(<PickerLikeDialog />);
    await openDialog(user);
    expect(screen.getByLabelText('New property name')).toHaveFocus();
  });

  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<PickerLikeDialog />);
    const dialog = await openDialog(user);

    for (let step = 0; step < 6; step += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('cycles backwards with Shift+Tab without escaping', async () => {
    const user = userEvent.setup();
    render(<PickerLikeDialog />);
    const dialog = await openDialog(user);

    for (let step = 0; step < 4; step += 1) {
      await user.tab({ shift: true });
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('closes on Escape and returns focus to whatever opened it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PickerLikeDialog onClose={onClose} />);
    await openDialog(user);

    await user.click(screen.getByLabelText('New property name'));
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('trigger')).toHaveFocus();
  });

  it('hides the rest of the page from assistive technology while open', async () => {
    const user = userEvent.setup();
    render(<PickerLikeDialog />);
    const trigger = screen.getByTestId('trigger');

    expect(trigger.closest('[aria-hidden="true"]')).toBeNull();
    await openDialog(user);
    expect(trigger.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('restores the page for assistive technology once closed', async () => {
    const user = userEvent.setup();
    render(<PickerLikeDialog />);
    await openDialog(user);
    await user.keyboard('{Escape}');

    expect(screen.getByTestId('trigger').closest('[aria-hidden="true"]')).toBeNull();
    // And nothing is left behind in the body.
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);
  });

  it('fires Escape once, not once per keystroke, despite the inline onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PickerLikeDialog onClose={onClose} />);
    await openDialog(user);

    await user.click(screen.getByLabelText('New property name'));
    await user.keyboard('abc{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
