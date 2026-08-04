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

async function openExamples(user: ReturnType<typeof userEvent.setup>) {
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
