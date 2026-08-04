import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useProjectStore } from '../projectstore';
import { attributeUsagesOfClass, findClass, usagesOfProperty } from '../ontologymodel';
import { ClassDetails } from './ClassDetails';
import { AttributeDetails } from './AttributeDetails';

const store = () => useProjectStore.getState();
const ontology = () => {
  const state = useProjectStore.getState();
  const project = state.projects.find((candidate) => candidate.id === state.activeProjectId);
  if (!project) throw new Error('no active project');
  return project.ontology;
};

describe('ClassDetails', () => {
  it('shows the IRI built from the ontology namespace', () => {
    store().setBaseIri('https://example.org/auto/');
    const car = store().createClass({ localName: 'Car' });
    render(<ClassDetails classId={car} />);
    expect(screen.getByText('https://example.org/auto/Car')).toBeInTheDocument();
  });

  it('renames as you type and keeps focus in the field', async () => {
    const user = userEvent.setup();
    const car = store().createClass({ localName: 'Car' });
    render(<ClassDetails classId={car} />);

    const field = screen.getByLabelText('Class local name');
    await user.clear(field);
    await user.type(field, 'Automobile');

    expect(field).toHaveFocus();
    expect(findClass(ontology(), car)?.localName).toBe('Automobile');
  });

  it('can be emptied while typing, flagging itself instead of snapping back', async () => {
    const user = userEvent.setup();
    const car = store().createClass({ localName: 'Car' });
    render(<ClassDetails classId={car} />);

    const field = screen.getByLabelText('Class local name');
    await user.clear(field);

    expect(field).toHaveValue('');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('A class needs a name.')).toBeInTheDocument();
    // Nothing invalid reaches the model.
    expect(findClass(ontology(), car)?.localName).toBe('Car');
  });

  it('restores the stored name if the field is abandoned while empty', async () => {
    const user = userEvent.setup();
    const car = store().createClass({ localName: 'Car' });
    render(<ClassDetails classId={car} />);

    const field = screen.getByLabelText('Class local name');
    await user.clear(field);
    await user.tab();

    expect(field).toHaveValue('Car');
  });

  it('adds a typed attribute and clears the entry field for the next one', async () => {
    const user = userEvent.setup();
    const car = store().createClass({ localName: 'Car' });
    render(<ClassDetails classId={car} />);

    await user.type(screen.getByLabelText('New attribute name'), 'year');
    await user.selectOptions(screen.getByLabelText('New attribute range'), 'integer');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(attributeUsagesOfClass(ontology(), car)).toHaveLength(1);
    expect(ontology().datatypeProperties[0]).toMatchObject({ localName: 'year', range: 'integer' });
    expect(screen.getByLabelText('New attribute name')).toHaveValue('');
  });

  it('stays on the class so several attributes can be added in a row', async () => {
    const user = userEvent.setup();
    const car = store().createClass({ localName: 'Car' });
    render(<ClassDetails classId={car} />);

    for (const name of ['make', 'model', 'year']) {
      await user.type(screen.getByLabelText('New attribute name'), name);
      await user.click(screen.getByRole('button', { name: 'Add' }));
    }

    expect(attributeUsagesOfClass(ontology(), car)).toHaveLength(3);
    expect(store().selection).toEqual({ kind: 'class', id: car });
  });

  it('adds on Enter as well as on the button', async () => {
    const user = userEvent.setup();
    const car = store().createClass({ localName: 'Car' });
    render(<ClassDetails classId={car} />);

    await user.type(screen.getByLabelText('New attribute name'), 'make{Enter}');
    expect(attributeUsagesOfClass(ontology(), car)).toHaveLength(1);
  });

  it('detaches an attribute without deleting the property', async () => {
    const user = userEvent.setup();
    const car = store().createClass({ localName: 'Car' });
    store().createAttributeOn(car, { localName: 'make' });
    render(<ClassDetails classId={car} />);

    await user.click(screen.getByRole('button', { name: 'Remove make from Car' }));

    expect(attributeUsagesOfClass(ontology(), car)).toHaveLength(0);
    expect(ontology().datatypeProperties).toHaveLength(1);
  });

  it('offers only superclasses that would not close a cycle', async () => {
    const vehicle = store().createClass({ localName: 'Vehicle' });
    const car = store().createClass({ localName: 'Car' });
    store().reparentClass(car, vehicle);
    render(<ClassDetails classId={vehicle} />);

    const picker = screen.getByLabelText('Superclass');
    // Car sits below Vehicle, so it cannot also be its parent.
    expect(within(picker).queryByRole('option', { name: 'Car' })).not.toBeInTheDocument();
  });

  it('deletes the class and everything attached to it', async () => {
    const user = userEvent.setup();
    const car = store().createClass({ localName: 'Car' });
    store().createAttributeOn(car, { localName: 'make' });
    render(<ClassDetails classId={car} />);

    await user.click(screen.getByRole('button', { name: 'Delete class' }));

    expect(findClass(ontology(), car)).toBeUndefined();
    expect(ontology().usages).toHaveLength(0);
  });

  it('renders nothing for a class that no longer exists', () => {
    const { container } = render(<ClassDetails classId="gone" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('AttributeDetails', () => {
  it('explains that a single use exports as rdfs:domain', () => {
    const car = store().createClass({ localName: 'Car' });
    const price = store().createAttributeOn(car, { localName: 'price', range: 'decimal' });
    render(<AttributeDetails propertyId={price} />);
    expect(screen.getByText(/single use exports as rdfs:domain/i)).toBeInTheDocument();
  });

  it('warns that a reused property drops its rdfs:domain', () => {
    const car = store().createClass({ localName: 'Car' });
    const product = store().createClass({ localName: 'Product' });
    const price = store().createAttributeOn(car, { localName: 'price', range: 'decimal' });
    store().attachPropertyToClass(price, product);
    render(<AttributeDetails propertyId={price} />);

    expect(screen.getByText(/rdfs:domain is omitted/i)).toBeInTheDocument();
  });

  it('attaches the property to another class from the picker', async () => {
    const user = userEvent.setup();
    const car = store().createClass({ localName: 'Car' });
    const product = store().createClass({ localName: 'Product' });
    const price = store().createAttributeOn(car, { localName: 'price', range: 'decimal' });
    render(<AttributeDetails propertyId={price} />);

    await user.selectOptions(screen.getByLabelText('Add this attribute to a class'), product);
    expect(usagesOfProperty(ontology(), price)).toHaveLength(2);
  });

  it('stops offering classes that already use the property', async () => {
    const car = store().createClass({ localName: 'Car' });
    const price = store().createAttributeOn(car, { localName: 'price' });
    render(<AttributeDetails propertyId={price} />);
    expect(screen.queryByLabelText('Add this attribute to a class')).not.toBeInTheDocument();
  });

  it('changes the range, which is global to the property', async () => {
    const user = userEvent.setup();
    const car = store().createClass({ localName: 'Car' });
    const price = store().createAttributeOn(car, { localName: 'price', range: 'string' });
    render(<AttributeDetails propertyId={price} />);

    await user.selectOptions(screen.getByLabelText('Attribute range'), 'decimal');
    expect(ontology().datatypeProperties[0]?.range).toBe('decimal');
  });

  it('tells the user when a property is used nowhere', () => {
    const car = store().createClass({ localName: 'Car' });
    const price = store().createAttributeOn(car, { localName: 'price' });
    const usage = ontology().usages[0];
    store().detachUsageById(usage?.id ?? '');
    render(<AttributeDetails propertyId={price} />);

    expect(screen.getByText(/Not used by any class yet/i)).toBeInTheDocument();
  });
});
