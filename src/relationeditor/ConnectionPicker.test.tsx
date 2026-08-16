import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useProjectStore } from '../projectstore';
import { usagesOfProperty } from '../ontologymodel';
import { ConnectionPicker } from './ConnectionPicker';

const store = () => useProjectStore.getState();
const ontology = () => {
  const state = useProjectStore.getState();
  const project = state.projects.find((candidate) => candidate.id === state.activeProjectId);
  if (!project) throw new Error('no active project');
  return project.ontology;
};

/** Two classes and a connection already drawn between them, awaiting a property. */
function drawnConnection() {
  const car = store().createClass({ localName: 'Car' });
  const dealership = store().createClass({ localName: 'Dealership' });
  store().beginConnection({ subjectClassId: car, objectClassId: dealership });
  return { car, dealership };
}

describe('ConnectionPicker', () => {
  it('renders nothing until a connection has been drawn', () => {
    render(<ConnectionPicker />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('names the two classes being connected, in the direction drawn', () => {
    drawnConnection();
    render(<ConnectionPicker />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Car');
    expect(dialog).toHaveTextContent('Dealership');
  });

  it('creates a new property and uses it between the two classes', async () => {
    const user = userEvent.setup();
    const { car, dealership } = drawnConnection();
    render(<ConnectionPicker />);

    await user.type(screen.getByLabelText('New object property name'), 'offeredBy');
    await user.click(screen.getByTestId('confirm-connection'));

    const property = ontology().relations.find((p) => p.localName === 'offeredBy');
    expect(property).toBeDefined();
    const usages = usagesOfProperty(ontology(), property?.id ?? '');
    expect(usages).toHaveLength(1);
    expect(usages[0]).toMatchObject({ subjectClassId: car, objectClassId: dealership });
    expect(useProjectStore.getState().pendingConnection).toBeNull();
  });

  it('keeps focus in the name field while typing', async () => {
    const user = userEvent.setup();
    drawnConnection();
    render(<ConnectionPicker />);

    const field = screen.getByLabelText('New object property name');
    await user.click(field);
    await user.keyboard('offeredBy');

    expect(field).toHaveFocus();
    expect(field).toHaveValue('offeredBy');
  });

  it('reuses an existing property instead of creating a second one', async () => {
    const user = userEvent.setup();
    const hasPart = store().createRelation({ localName: 'hasPart' });
    const { car, dealership } = drawnConnection();
    const before = ontology().relations.length;
    render(<ConnectionPicker />);

    await user.selectOptions(screen.getByLabelText('Object property to use'), hasPart);
    await user.click(screen.getByTestId('confirm-connection'));

    expect(ontology().relations).toHaveLength(before);
    expect(usagesOfProperty(ontology(), hasPart)[0]).toMatchObject({
      subjectClassId: car,
      objectClassId: dealership,
    });
  });

  it('shows how often each candidate property is already used', () => {
    store().createRelation({ localName: 'hasPart' });
    drawnConnection();
    render(<ConnectionPicker />);
    expect(screen.getByRole('option', { name: /hasPart \(unused\)/ })).toBeInTheDocument();
  });

  it('hides the name field when an existing property is chosen', async () => {
    const user = userEvent.setup();
    const hasPart = store().createRelation({ localName: 'hasPart' });
    drawnConnection();
    render(<ConnectionPicker />);

    expect(screen.getByLabelText('New object property name')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Object property to use'), hasPart);
    expect(screen.queryByLabelText('New object property name')).not.toBeInTheDocument();
  });

  it('refuses to confirm a new property with no usable name', async () => {
    const user = userEvent.setup();
    drawnConnection();
    render(<ConnectionPicker />);

    expect(screen.getByTestId('confirm-connection')).toBeDisabled();
    await user.type(screen.getByLabelText('New object property name'), '///');
    expect(screen.getByTestId('confirm-connection')).toBeDisabled();
    expect(screen.getByText('That name cannot be used.')).toBeInTheDocument();
  });

  it('creates nothing when cancelled', async () => {
    const user = userEvent.setup();
    drawnConnection();
    render(<ConnectionPicker />);

    await user.type(screen.getByLabelText('New object property name'), 'offeredBy');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(ontology().relations).toHaveLength(0);
    expect(ontology().usages).toHaveLength(0);
    expect(useProjectStore.getState().pendingConnection).toBeNull();
  });

  it('forgets the abandoned draft when a new connection is drawn', async () => {
    const user = userEvent.setup();
    drawnConnection();
    const { rerender } = render(<ConnectionPicker />);

    await user.type(screen.getByLabelText('New object property name'), 'abandoned');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    drawnConnection();
    rerender(<ConnectionPicker />);
    expect(screen.getByLabelText('New object property name')).toHaveValue('');
  });

  it('confirms on Enter from the name field', async () => {
    const user = userEvent.setup();
    drawnConnection();
    render(<ConnectionPicker />);

    await user.type(screen.getByLabelText('New object property name'), 'offeredBy{Enter}');
    expect(ontology().relations.map((p) => p.localName)).toEqual(['offeredBy']);
  });

  it('records the whole connection as a single undo step', async () => {
    const user = userEvent.setup();
    drawnConnection();
    const depth = store().history.past.length;
    render(<ConnectionPicker />);

    await user.type(screen.getByLabelText('New object property name'), 'offeredBy');
    await user.click(screen.getByTestId('confirm-connection'));

    expect(store().history.past.length).toBe(depth + 1);
    store().undo();
    expect(ontology().relations).toHaveLength(0);
    expect(ontology().usages).toHaveLength(0);
  });
});
