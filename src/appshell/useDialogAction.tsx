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
 *
 * The state comes back too, for the one dialog that has a second way in: a keyboard shortcut
 * has to be able to open it without a trigger being clicked.
 */
export function useDialogAction(options: {
  /** What the trigger says. */
  label: ReactNode;
  /** The dialog's heading. No ellipsis: a title names where you are, it is not an action. */
  title: string;
  testId: string;
  /**
   * The dialog's contents. Given a function instead of a node, it is called with a way to
   * close — which the contents need when choosing something inside them should dismiss the
   * dialog, and which they cannot get by reaching for a variable that does not exist yet.
   */
  children: ReactNode | ((close: () => void) => ReactNode);
  size?: 'default' | 'wide';
  /** Names the trigger when its label is a picture rather than words. */
  triggerLabel?: string;
}): { action: ReactNode; dialog: ReactNode; open: boolean; setOpen: (open: boolean) => void } {
  const [open, setOpen] = useState(false);

  return {
    open,
    setOpen,
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
        {typeof options.children === 'function'
          ? options.children(() => setOpen(false))
          : options.children}
      </Modal>
    ),
  };
}
