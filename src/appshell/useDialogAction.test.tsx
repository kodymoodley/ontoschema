import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDialogAction } from './useDialogAction';
import { MetadataIcon } from './icons';

/**
 * A trigger and the dialog it opens, handed back separately so the caller can put them in
 * different places. What is worth testing is that separation: the dialog has to survive its
 * trigger being unmounted, because the file menu unmounts everything in it on the first click.
 */
function Harness({ apart }: { apart: boolean }) {
  const { action, dialog } = useDialogAction({
    label: 'Metadata',
    title: 'Schema metadata',
    testId: 'open-metadata',
    children: <p>the fields</p>,
  });

  // `apart` models the file menu: a container that throws its contents away once clicked.
  return apart ? (
    <>
      <Disappearing>{action}</Disappearing>
      {dialog}
    </>
  ) : (
    <Disappearing>
      {action}
      {dialog}
    </Disappearing>
  );
}

/**
 * Stands in for the menu panel, which unmounts as soon as anything inside it is used.
 *
 * React state rather than DOM removal, because that is how the real menu closes — and because
 * emptying the node by hand does not unmount anything, so a portalled dialog would survive it
 * and the test would prove nothing.
 */
function Disappearing({ children }: { children: ReactNode }) {
  const [showing, setShowing] = useState(true);
  return <div onClickCapture={() => setShowing(false)}>{showing ? children : null}</div>;
}

const dialog = () => screen.queryByRole('dialog', { name: 'Schema metadata' });

describe('a button and the dialog it opens', () => {
  it('shows nothing until the trigger is used', () => {
    render(<Harness apart />);
    expect(dialog()).not.toBeInTheDocument();
    expect(screen.getByTestId('open-metadata')).toHaveTextContent('Metadata');
  });

  it('opens on the trigger, and closes on Close', async () => {
    const user = userEvent.setup();
    render(<Harness apart />);

    await user.click(screen.getByTestId('open-metadata'));
    expect(dialog()).toBeInTheDocument();
    expect(screen.getByText('the fields')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(dialog()).not.toBeInTheDocument();
  });

  /*
   * Why the hook hands back two pieces rather than one. Rendered together inside a container
   * that unmounts on click -- which is exactly what the file menu is -- the dialog is destroyed
   * by the very click meant to open it.
   */
  it('is lost if the dialog is rendered beside the trigger that unmounts', async () => {
    const user = userEvent.setup();
    render(<Harness apart={false} />);

    await user.click(screen.getByTestId('open-metadata'));
    expect(dialog()).not.toBeInTheDocument();
  });

  it('names the trigger separately when its label is a picture', () => {
    function IconTrigger() {
      const { action } = useDialogAction({
        label: <MetadataIcon />,
        title: 'Schema metadata',
        testId: 'open-metadata',
        triggerLabel: 'Metadata',
        children: null,
      });
      return <>{action}</>;
    }
    render(<IconTrigger />);
    const trigger = screen.getByRole('button', { name: 'Metadata' });
    expect(trigger).toBeInTheDocument();
    // A picture is not a name, and it must not become part of one either.
    expect(trigger.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(trigger).toHaveAttribute('title', 'Metadata');
  });
});
