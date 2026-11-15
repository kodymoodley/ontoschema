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

    await user.type(screen.getByLabelText('New relation name'), 'offeredBy');
    await user.click(screen.getByTestId('confirm-connection'));

    const property = ontology().relations.find((p) => p.localName === 'offeredBy');
    expect(property).toBeDefined();
    const usages = usagesOfProperty(ontology(), property?.id ?? '');
    expect(usages).toHaveLength(1);
    expect(usages[0]).toMatchObject({ subjectClassId: car, objectClassId: dealership });
    expect(useProjectStore.getState().pendingConnection).toBeNull();
  });

  /* Let go near a side of the class, and the new line stays on that side. */
  it('pins the end of the line to the side it was let go near', async () => {
    const user = userEvent.setup();
    const car = store().createClass({ localName: 'Car' });
    const dealership = store().createClass({ localName: 'Dealership' });
    store().beginConnection({ subjectClassId: car, objectClassId: dealership, targetSide: 'top' });
    render(<ConnectionPicker />);

    await user.type(screen.getByLabelText('New relation name'), 'offeredBy');
    await user.click(screen.getByTestId('confirm-connection'));

    const property = ontology().relations.find((p) => p.localName === 'offeredBy');
    expect(usagesOfProperty(ontology(), property?.id ?? '')[0]?.pinned).toEqual({ target: 'top' });
  });

  it('leaves the line free when it was let go over the middle of the class', async () => {
    const user = userEvent.setup();
    drawnConnection();
    render(<ConnectionPicker />);

    await user.type(screen.getByLabelText('New relation name'), 'offeredBy');
    await user.click(screen.getByTestId('confirm-connection'));

    const property = ontology().relations.find((p) => p.localName === 'offeredBy');
    expect(usagesOfProperty(ontology(), property?.id ?? '')[0]).not.toHaveProperty('pinned');
  });

  it('keeps focus in the name field while typing', async () => {
    const user = userEvent.setup();
    drawnConnection();
    render(<ConnectionPicker />);

    const field = screen.getByLabelText('New relation name');
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

    await user.selectOptions(screen.getByLabelText('Relation to use'), hasPart);
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

    expect(screen.getByLabelText('New relation name')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Relation to use'), hasPart);
    expect(screen.queryByLabelText('New relation name')).not.toBeInTheDocument();
  });

  it('refuses to confirm a new property with no usable name', async () => {
    const user = userEvent.setup();
    drawnConnection();
    render(<ConnectionPicker />);

    expect(screen.getByTestId('confirm-connection')).toBeDisabled();
    await user.type(screen.getByLabelText('New relation name'), '///');
    expect(screen.getByTestId('confirm-connection')).toBeDisabled();
    expect(screen.getByText('A relation needs a name.')).toBeInTheDocument();
  });

  /* Not `offeredBy2`: the name was the relation that already has it. */
  it('switches to reusing a relation whose name is typed, and back on typing past it', async () => {
    const user = userEvent.setup();
    const { car, dealership } = drawnConnection();
    const offeredBy = store().createRelation({ localName: 'offeredBy' });
    render(<ConnectionPicker />);
    const name = screen.getByLabelText('New relation name');

    await user.type(name, 'offered by');
    expect(screen.getByLabelText('Relation to use')).toHaveValue(offeredBy);
    expect(screen.getByText('offeredBy already exists, so this will use it.')).toBeInTheDocument();

    await user.type(name, 'X');
    expect(screen.getByLabelText('Relation to use')).toHaveValue('');
    await user.type(name, '{Backspace}{Enter}');

    expect(ontology().relations.map((relation) => relation.localName)).toEqual(['offeredBy']);
    expect(usagesOfProperty(ontology(), offeredBy)[0]).toMatchObject({
      subjectClassId: car,
      objectClassId: dealership,
    });
  });

  it('refuses a name an attribute holds, since the two share one namespace', async () => {
    const user = userEvent.setup();
    const { car } = drawnConnection();
    store().createAttributeOn(car, { localName: 'price' });
    render(<ConnectionPicker />);

    await user.type(screen.getByLabelText('New relation name'), 'price');

    expect(
      screen.getByText('price is already an attribute, so a relation cannot be called that too.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('confirm-connection')).toBeDisabled();
  });

  it('creates nothing when cancelled', async () => {
    const user = userEvent.setup();
    drawnConnection();
    render(<ConnectionPicker />);

    await user.type(screen.getByLabelText('New relation name'), 'offeredBy');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(ontology().relations).toHaveLength(0);
    expect(ontology().usages).toHaveLength(0);
    expect(useProjectStore.getState().pendingConnection).toBeNull();
  });

  it('forgets the abandoned draft when a new connection is drawn', async () => {
    const user = userEvent.setup();
    drawnConnection();
    const { rerender } = render(<ConnectionPicker />);

    await user.type(screen.getByLabelText('New relation name'), 'abandoned');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    drawnConnection();
    rerender(<ConnectionPicker />);
    expect(screen.getByLabelText('New relation name')).toHaveValue('');
  });

  it('confirms on Enter from the name field', async () => {
    const user = userEvent.setup();
    drawnConnection();
    render(<ConnectionPicker />);

    await user.type(screen.getByLabelText('New relation name'), 'offeredBy{Enter}');
    expect(ontology().relations.map((p) => p.localName)).toEqual(['offeredBy']);
  });

  it('records the whole connection as a single undo step', async () => {
    const user = userEvent.setup();
    drawnConnection();
    const depth = store().history.past.length;
    render(<ConnectionPicker />);

    await user.type(screen.getByLabelText('New relation name'), 'offeredBy');
    await user.click(screen.getByTestId('confirm-connection'));

    expect(store().history.past.length).toBe(depth + 1);
    store().undo();
    expect(ontology().relations).toHaveLength(0);
    expect(ontology().usages).toHaveLength(0);
  });
});
