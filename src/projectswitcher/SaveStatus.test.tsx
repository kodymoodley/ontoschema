import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fileLinks } from '../filelink';
import type { LinkStatus } from '../filelink';
import { useProjectStore } from '../projectstore';
import { SaveStatus } from './SaveStatus';

/**
 * What the header says about where the work is kept, and that each problem's button reaches the
 * right action. The engine behind it is tested on its own; here its status is set directly.
 */

const openProject = () => useProjectStore.getState().activeProjectId ?? '';
const linkedAs = (status: LinkStatus) =>
  fileLinks.statuses.setState({ [openProject()]: status }, true);

afterEach(() => {
  fileLinks.statuses.setState({}, true);
  vi.restoreAllMocks();
});

describe('where the work is kept', () => {
  it('says the browser holds it when the schema is not linked to a file', () => {
    render(<SaveStatus />);
    expect(screen.getByTestId('save-status')).toHaveTextContent('In this browser');
  });

  it('names the file when every edit is being saved into it', () => {
    linkedAs({ kind: 'saved', file: 'insurance.ttl' });
    render(<SaveStatus />);
    expect(screen.getByTestId('save-status')).toHaveTextContent('Saved to insurance.ttl');
  });

  it('announces changes to assistive technology without interrupting', () => {
    render(<SaveStatus />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('says why a save failed', () => {
    linkedAs({ kind: 'failed', file: 'insurance.ttl', reason: 'disk full' });
    render(<SaveStatus />);
    expect(screen.getByText('Could not save to insurance.ttl')).toHaveAttribute(
      'title',
      'disk full',
    );
  });
});

describe('when something needs a decision', () => {
  it('reconnects to the file from a click, the only time a browser will ask', async () => {
    const user = userEvent.setup();
    const reconnect = vi.spyOn(fileLinks, 'reconnect').mockResolvedValue();
    linkedAs({ kind: 'permission', file: 'insurance.ttl' });
    render(<SaveStatus />);

    await user.click(screen.getByRole('button', { name: 'Reconnect insurance.ttl' }));

    expect(reconnect).toHaveBeenCalledWith(openProject());
  });

  it('keeps the edits made here when told to', async () => {
    const user = userEvent.setup();
    const keepMine = vi.spyOn(fileLinks, 'keepMine').mockResolvedValue();
    linkedAs({ kind: 'conflict', file: 'insurance.ttl' });
    render(<SaveStatus />);

    await user.click(screen.getByTestId('file-conflict'));
    await user.click(screen.getByTestId('keep-mine'));

    expect(keepMine).toHaveBeenCalledWith(openProject());
  });

  it('takes the file when told to', async () => {
    const user = userEvent.setup();
    const takeFile = vi.spyOn(fileLinks, 'takeFile').mockResolvedValue();
    linkedAs({ kind: 'conflict', file: 'insurance.ttl' });
    render(<SaveStatus />);

    await user.click(screen.getByTestId('file-conflict'));
    await user.click(screen.getByTestId('take-file'));

    expect(takeFile).toHaveBeenCalledWith(openProject());
  });

  it('saves into a file that would lose something only once told to', async () => {
    const user = userEvent.setup();
    const resume = vi.spyOn(fileLinks, 'resume').mockResolvedValue();
    linkedAs({ kind: 'paused', file: 'foreign.ttl' });
    render(<SaveStatus />);

    await user.click(screen.getByRole('button', { name: 'Not saving to foreign.ttl' }));
    expect(resume).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('save-into-file'));

    expect(resume).toHaveBeenCalledWith(openProject());
  });

  it('can stop linking a file that has gone, keeping the work in the browser', async () => {
    const user = userEvent.setup();
    const unlink = vi.spyOn(fileLinks, 'unlink').mockResolvedValue();
    linkedAs({ kind: 'missing', file: 'insurance.ttl' });
    render(<SaveStatus />);

    await user.click(screen.getByRole('button', { name: 'insurance.ttl has gone' }));
    await user.click(screen.getByRole('button', { name: 'Keep it in this browser' }));

    expect(unlink).toHaveBeenCalledWith(openProject());
  });
});
