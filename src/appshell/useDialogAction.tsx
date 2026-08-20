import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Modal } from '../designsystem';

/**
 * A button and the dialog it opens, returned as two pieces for the caller to place.
 *
 * Two pieces because they cannot always be rendered together. A button inside the file menu
 * lives in a panel that unmounts the moment anything in it is clicked, so a dialog rendered
 * beside it would be torn down by the very click meant to open it. Keeping the state here and
 * handing back both pieces lets the caller put the trigger where it belongs and the dialog
 * somewhere that outlives it — and a trigger that is *not* in a menu costs nothing for it.
 *
 * The children are built by the caller whether the dialog is open or not, which is free: an
 * element is a description, and `Modal` renders nothing until it opens.
 */
export function useDialogAction(options: {
  /** What the trigger says. */
  label: ReactNode;
  /** The dialog's heading. No ellipsis: a title names where you are, it is not an action. */
  title: string;
  testId: string;
  children: ReactNode;
  size?: 'default' | 'wide';
  /** Names the trigger when its label is a picture rather than words. */
  triggerLabel?: string;
}): { action: ReactNode; dialog: ReactNode } {
  const [open, setOpen] = useState(false);

  return {
    action: (
      <Button
        size="small"
        variant="subtle"
        onClick={() => setOpen(true)}
        data-testid={options.testId}
        {...(options.triggerLabel ? { 'aria-label': options.triggerLabel } : {})}
        {...(options.triggerLabel ? { title: options.triggerLabel } : {})}
      >
        {options.label}
      </Button>
    ),
    dialog: (
      <Modal
        title={options.title}
        size={options.size ?? 'wide'}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <Button variant="subtle" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        {options.children}
      </Modal>
    ),
  };
}
