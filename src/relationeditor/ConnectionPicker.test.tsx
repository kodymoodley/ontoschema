import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

/** Two classes and a connection already drawn between them, awaiting a relation. */
function drawnConnection() {
  const car = store().createClass({ localName: 'Car' });
  const dealership = store().createClass({ localName: 'Dealership' });
  store().beginConnection({ subjectClassId: car, objectClassId: dealership });
  return { car, dealership };
}

const box = () => screen.getByRole('combobox', { name: 'Relation name' });
const newButton = () => screen.getByTestId('new-relation');
const listed = () =>
  within(screen.getByRole('listbox', { name: 'Relations' }))
    .getAllByRole('option')
    .map((option) => option.getAttribute('data-result'));
const relationNames = () => ontology().relations.map((relation) => relation.localName);

describe('ConnectionPicker', () => {
  it('renders nothing until a connection has been drawn', () => {
    render(<ConnectionPicker />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('names the two classes being connected, in the direction drawn', () => {
    drawnConnection();
    render(<ConnectionPicker />);
    const dialog = screen.getByRole('dialog', { name: 'Which relation?' });
    expect(dialog).toHaveTextContent('Car');
    expect(dialog).toHaveTextContent('Dealership');
  });

  it('opens with the cursor in the box', () => {
    drawnConnection();
    render(<ConnectionPicker />);
    expect(box()).toHaveFocus();
  });

  it('creates a new relation from the name typed, with the button beside the box', async () => {
    const user = userEvent.setup();
    const { car, dealership } = drawnConnection();
    render(<ConnectionPicker />);

    await user.type(box(), 'offered by');
    await user.click(
      screen.getByRole('button', { name: 'Create a new relation called offeredBy' }),
    );

    expect(relationNames()).toEqual(['offeredBy']);
    const [usage] = usagesOfProperty(ontology(), ontology().relations[0]!.id);
    expect(usage).toMatchObject({ subjectClassId: car, objectClassId: dealership });
    expect(store().pendingConnection).toBeNull();
  });

  it('creates the name typed on Enter, when no relation is highlighted', async () => {
    const user = userEvent.setup();
    drawnConnection();
    store().createRelation({ localName: 'offeredBy' });
    render(<ConnectionPicker />);

    // `offer` matches offeredBy, but was not chosen: Enter makes what was typed.
    await user.type(box(), 'offer{Enter}');
    expect(relationNames()).toEqual(['offeredBy', 'offer']);
  });

  it('lists every relation before anything is typed, most used first', () => {
    drawnConnection();
    const hasPart = store().createRelation({ localName: 'hasPart' });
    store().createRelation({ localName: 'ownedBy' });
    const offeredBy = store().createRelation({ localName: 'offeredBy' });
    const [car, dealership] = ontology().classes.map((entity) => entity.id);
    store().attachPropertyToClass(offeredBy, car!, dealership!);
    store().attachPropertyToClass(offeredBy, dealership!, car!);
    store().attachPropertyToClass(hasPart, car!, car!);
    render(<ConnectionPicker />);

    expect(listed()).toEqual(['offeredBy', 'hasPart', 'ownedBy']);
    expect(screen.getByText('offeredBy').closest('li')).toHaveTextContent('used 2×');
    expect(screen.getByText('ownedBy').closest('li')).toHaveTextContent('unused');
  });

  it('narrows the list as the name is typed', async () => {
    const user = userEvent.setup();
    drawnConnection();
    store().createRelation({ localName: 'offeredBy' });
    store().createRelation({ localName: 'hasPart' });
    render(<ConnectionPicker />);

    await user.type(box(), 'part');
    expect(listed()).toEqual(['hasPart']);
  });

  /* Hundreds of relations are never all drawn: the list holds fifty and says how to reach the rest. */
  it('holds at most fifty relations, and says how to reach the rest', () => {
    drawnConnection();
    for (let index = 0; index < 60; index += 1) store().createRelation({ localName: `r${index}` });
    render(<ConnectionPicker />);

    expect(listed()).toHaveLength(50);
    expect(screen.getByText('Showing 50 of 60. Type to narrow.')).toBeInTheDocument();
  });

  it('reuses a relation picked from the list instead of creating a second one', async () => {
    const user = userEvent.setup();
    const { car, dealership } = drawnConnection();
    const offeredBy = store().createRelation({ localName: 'offeredBy' });
    render(<ConnectionPicker />);

    await user.click(screen.getByText('offeredBy'));

    expect(relationNames()).toEqual(['offeredBy']);
    expect(usagesOfProperty(ontology(), offeredBy)[0]).toMatchObject({
      subjectClassId: car,
      objectClassId: dealership,
    });
  });

  it('reuses the relation highlighted with the arrows on Enter', async () => {
    const user = userEvent.setup();
    drawnConnection();
    store().createRelation({ localName: 'offeredBy' });
    const hasPart = store().createRelation({ localName: 'hasPart' });
    render(<ConnectionPicker />);

    await user.type(box(), 'has{ArrowDown}{Enter}');
    expect(relationNames()).toEqual(['offeredBy', 'hasPart']);
    expect(usagesOfProperty(ontology(), hasPart)).toHaveLength(1);
  });

  /* Not `offeredBy2`: a name typed in full is the relation that has it. */
  it('takes a relation whose name is typed in full, and will not create it again', async () => {
    const user = userEvent.setup();
    drawnConnection();
    const offeredBy = store().createRelation({ localName: 'offeredBy' });
    render(<ConnectionPicker />);

    await user.type(box(), 'offered by');
    expect(screen.getByRole('option', { selected: true })).toHaveAttribute(
      'data-result',
      'offeredBy',
    );
    expect(screen.getByText('offeredBy already exists. Enter uses it.')).toBeInTheDocument();
    expect(newButton()).toBeDisabled();

    await user.keyboard('{Enter}');
    expect(relationNames()).toEqual(['offeredBy']);
    expect(usagesOfProperty(ontology(), offeredBy)).toHaveLength(1);
  });

  it('refuses a name an attribute holds, since the two share one namespace', async () => {
    const user = userEvent.setup();
    const { car } = drawnConnection();
    store().createAttributeOn(car, { localName: 'price' });
    render(<ConnectionPicker />);

    await user.type(box(), 'price{Enter}');

    expect(
      screen.getByText('price is already an attribute, so a relation cannot be called that too.'),
    ).toBeInTheDocument();
    expect(newButton()).toBeDisabled();
    expect(relationNames()).toEqual([]);
  });

  it('offers nothing to create until a usable name is typed', async () => {
    const user = userEvent.setup();
    drawnConnection();
    render(<ConnectionPicker />);

    expect(newButton()).toBeDisabled();
    await user.type(box(), '///');
    expect(newButton()).toBeDisabled();
    expect(screen.getByText('A relation needs a name.')).toBeInTheDocument();
  });

  it('pins the end of the line to the side it was let go near', async () => {
    const user = userEvent.setup();
    const car = store().createClass({ localName: 'Car' });
    const dealership = store().createClass({ localName: 'Dealership' });
    store().beginConnection({ subjectClassId: car, objectClassId: dealership, targetSide: 'top' });
    render(<ConnectionPicker />);

    await user.type(box(), 'offeredBy{Enter}');

    const property = ontology().relations[0]!;
    expect(usagesOfProperty(ontology(), property.id)[0]?.pinned).toEqual({ target: 'top' });
  });

  it('leaves the line free when it was let go over the middle of the class', async () => {
    const user = userEvent.setup();
    drawnConnection();
    render(<ConnectionPicker />);

    await user.type(box(), 'offeredBy{Enter}');

    const property = ontology().relations[0]!;
    expect(usagesOfProperty(ontology(), property.id)[0]).not.toHaveProperty('pinned');
  });

  it('creates nothing when cancelled', async () => {
    const user = userEvent.setup();
    drawnConnection();
    render(<ConnectionPicker />);

    await user.type(box(), 'offeredBy');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(ontology().relations).toHaveLength(0);
    expect(ontology().usages).toHaveLength(0);
    expect(store().pendingConnection).toBeNull();
  });

  it('starts each drawn line with an empty box', async () => {
    const user = userEvent.setup();
    drawnConnection();
    const { rerender } = render(<ConnectionPicker />);

    await user.type(box(), 'abandoned');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    drawnConnection();
    rerender(<ConnectionPicker />);
    expect(box()).toHaveValue('');
  });

  it('records the whole connection as a single undo step', async () => {
    const user = userEvent.setup();
    drawnConnection();
    const depth = store().history.past.length;
    render(<ConnectionPicker />);

    await user.type(box(), 'offeredBy{Enter}');

    expect(store().history.past.length).toBe(depth + 1);
    store().undo();
    expect(ontology().relations).toHaveLength(0);
    expect(ontology().usages).toHaveLength(0);
  });
});
