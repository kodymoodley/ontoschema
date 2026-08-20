import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useProjectStore } from '../projectstore';
import { EXAMPLES } from '../examplelibrary';
import { ProjectSwitcher } from './ProjectSwitcher';

const store = () => useProjectStore.getState();
const ontology = () => {
  const state = useProjectStore.getState();
  const project = state.projects.find((candidate) => candidate.id === state.activeProjectId);
  if (!project) throw new Error('no active project');
  return project.ontology;
};

/** The project actions live behind one menu now, so reaching any of them starts here. */
async function openFileMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('file-menu'));
}

async function openExamples(user: ReturnType<typeof userEvent.setup>) {
  await openFileMenu(user);
  await user.click(screen.getByTestId('open-examples'));
  return screen.getByRole('dialog', { name: 'Open an example' });
}

describe('the example picker', () => {
  it('lists every example with its summary and size', async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher />);
    const dialog = await openExamples(user);

    for (const example of EXAMPLES) {
      const entry = within(dialog).getByText(example.title).closest('button');
      expect(entry, `${example.title} is missing`).not.toBeNull();
      expect(entry).toHaveTextContent(example.summary.slice(0, 40));
      expect(entry).toHaveTextContent(/\d+ classes/);
    }
  });

  it('loads the chosen example into a new project', async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher />);
    await openExamples(user);

    const before = store().projects.length;
    await user.click(screen.getByText('Music library'));

    expect(store().projects).toHaveLength(before + 1);
    const model = ontology();
    expect(model.prefix).toBe('mus');
    expect(model.classes.map((entity) => entity.localName)).toContain('Album');
    expect(model.classes.length).toBeGreaterThan(10);
  });

  it('leaves existing work alone', async () => {
    const user = userEvent.setup();
    const existing = store().createClass({ localName: 'MyOwnClass' });
    const original = store().activeProjectId;
    render(<ProjectSwitcher />);

    await openExamples(user);
    await user.click(screen.getByText('University'));

    // The example opens as its own project rather than overwriting the one in progress.
    expect(store().activeProjectId).not.toBe(original);
    store().switchProject(original ?? '');
    expect(ontology().classes.map((entity) => entity.id)).toContain(existing);
  });

  it('names the project after the example', async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher />);
    await openExamples(user);
    await user.click(screen.getByText('Insurance firm'));

    const active = store().projects.find((project) => project.id === store().activeProjectId);
    expect(active?.name).toBe('Insurance firm');
  });

  it('starts the example with a clean undo history', async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher />);
    await openExamples(user);
    await user.click(screen.getByText('Recipes and cooking'));

    // Undo must not unpick the example one mutation at a time.
    expect(store().canUndo()).toBe(false);
  });

  it('closes once an example is chosen', async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher />);
    await openExamples(user);
    await user.click(screen.getByText('Vehicle dealership'));

    expect(screen.queryByRole('dialog', { name: 'Open an example' })).not.toBeInTheDocument();
  });

  it('can be dismissed without loading anything', async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher />);
    await openExamples(user);
    const before = store().projects.length;

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store().projects).toHaveLength(before);
  });

  it('can load two examples side by side', async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher />);

    await openExamples(user);
    await user.click(screen.getByText('Music library'));
    await openExamples(user);
    await user.click(screen.getByText('University'));

    const names = store().projects.map((project) => project.name);
    expect(names).toContain('Music library');
    expect(names).toContain('University');
    // Distinct namespaces, so nothing collides when both are open.
    expect(ontology().prefix).toBe('uni');
  });
});

/**
 * Restoring a backup replaces everything in the browser, so what is worth testing is the
 * asking: that nothing happens until the person agrees, and that changing their mind is free.
 */
describe('restoring a backup', () => {
  /** The picker is a file input, so a test drives it the way the browser would. */
  async function chooseBackup(user: ReturnType<typeof userEvent.setup>, content: string) {
    await openFileMenu(user);
    const input = screen.getByLabelText('Restore a backup file');
    await user.upload(input, new File([content], 'backup.json', { type: 'application/json' }));
  }

  const confirmation = () => screen.queryByRole('dialog', { name: /Replace everything/ });

  it('asks before replacing anything', async () => {
    const user = userEvent.setup();
    store().newProject('Something I care about');
    render(<ProjectSwitcher />);

    await chooseBackup(user, store().exportWorkspaceFile());

    expect(confirmation()).toBeInTheDocument();
    expect(store().projects.map((project) => project.name)).toContain('Something I care about');
  });

  it('says how much is at stake, in whole words rather than a count of one', async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher />);
    await chooseBackup(user, store().exportWorkspaceFile());

    expect(confirmation()).toHaveTextContent('The one project open here');
  });

  it('counts them once there are several', async () => {
    const user = userEvent.setup();
    store().newProject('Second');
    store().newProject('Third');
    render(<ProjectSwitcher />);
    await chooseBackup(user, store().exportWorkspaceFile());

    expect(confirmation()).toHaveTextContent('All 3 projects here');
  });

  it('changes nothing when the answer is no', async () => {
    const user = userEvent.setup();
    const backup = store().exportWorkspaceFile();
    store().newProject('Made after the backup');
    render(<ProjectSwitcher />);

    await chooseBackup(user, backup);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(confirmation()).not.toBeInTheDocument();
    expect(store().projects.map((project) => project.name)).toContain('Made after the backup');
  });

  it('replaces the workspace once the answer is yes', async () => {
    const user = userEvent.setup();
    const backup = store().exportWorkspaceFile();
    const before = store().projects.map((project) => project.name);
    store().newProject('Made after the backup');
    render(<ProjectSwitcher />);

    await chooseBackup(user, backup);
    await user.click(screen.getByTestId('confirm-restore'));

    expect(store().projects.map((project) => project.name)).toEqual(before);
  });

  it('says so, and keeps the workspace, when the file is not a backup', async () => {
    const user = userEvent.setup();
    const before = store().projects.map((project) => project.id);
    render(<ProjectSwitcher />);

    await chooseBackup(user, 'certainly not a backup');
    await user.click(screen.getByTestId('confirm-restore'));

    expect(screen.getByRole('dialog', { name: /Could not open/ })).toBeInTheDocument();
    expect(store().projects.map((project) => project.id)).toEqual(before);
  });
});
