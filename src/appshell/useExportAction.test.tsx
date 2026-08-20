import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectSwitcher } from '../projectswitcher';
import { useProjectStore } from '../projectstore';
import { useExportAction } from './useExportAction';

/**
 * Composed the way the header composes it, because the composition is the risky part: the item
 * sits inside a menu that unmounts on click, and only the dialog being rendered elsewhere keeps
 * it alive long enough to be seen.
 */
function Header() {
  const exporting = useExportAction();
  return (
    <>
      <ProjectSwitcher extraActions={exporting.action} />
      {exporting.dialog}
    </>
  );
}

const openMenu = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByTestId('file-menu'));

const dialog = () => screen.queryByRole('dialog', { name: 'Export' });

describe('export from the file menu', () => {
  it('is one of the file actions rather than a panel of its own', async () => {
    const user = userEvent.setup();
    render(<Header />);

    expect(screen.queryByTestId('open-export')).not.toBeInTheDocument();
    await openMenu(user);
    expect(screen.getByTestId('open-export')).toBeInTheDocument();
  });

  it('survives the menu closing under it', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await openMenu(user);
    await user.click(screen.getByTestId('open-export'));

    // The click closed the menu; the dialog it opened must still be there.
    expect(screen.queryByTestId('open-export')).not.toBeInTheDocument();
    expect(dialog()).toBeInTheDocument();
  });

  it('shows the export panel, working against the open project', async () => {
    const user = userEvent.setup();
    const motorcycle = useProjectStore.getState().createClass({ localName: 'Motorcycle' });
    // The export panel shows the shapes first, and a class with no usages has none.
    useProjectStore.getState().createAttributeOn(motorcycle, { localName: 'engineSize' });
    render(<Header />);

    await openMenu(user);
    await user.click(screen.getByTestId('open-export'));

    expect(screen.getByTestId('download-mmd')).toBeInTheDocument();
    expect(screen.getByTestId('export-preview')).toHaveTextContent('Motorcycle');
  });

  it('closes again', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await openMenu(user);
    await user.click(screen.getByTestId('open-export'));
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(dialog()).not.toBeInTheDocument();
  });
});
