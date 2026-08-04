import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useProjectStore } from '../projectstore';
import { findObjectProperty, usagesOfProperty } from '../ontologymodel';
import { RelationDetails } from './RelationDetails';

const store = () => useProjectStore.getState();
const ontology = () => {
  const state = useProjectStore.getState();
  const project = state.projects.find((candidate) => candidate.id === state.activeProjectId);
  if (!project) throw new Error('no active project');
  return project.ontology;
};

function usedOnce() {
  const car = store().createClass({ localName: 'Car' });
  const dealership = store().createClass({ localName: 'Dealership' });
  const offeredBy = store().createObjectProperty({ localName: 'offeredBy' });
  store().attachPropertyToClass(offeredBy, car, dealership);
  return { car, dealership, offeredBy };
}

describe('RelationDetails', () => {
  it('reports an unused property and says nothing is drawn for it', () => {
    const hasPart = store().createObjectProperty({ localName: 'hasPart' });
    render(<RelationDetails propertyId={hasPart} />);

    expect(screen.getByText('Unused')).toBeInTheDocument();
    expect(screen.getByText(/Not used yet, so nothing is drawn/i)).toBeInTheDocument();
  });

  it('reports a single use, and that RDFS can state it', () => {
    const { offeredBy } = usedOnce();
    render(<RelationDetails propertyId={offeredBy} />);

    expect(screen.getByText('Used once')).toBeInTheDocument();
    expect(screen.getByText(/exports as rdfs:domain and rdfs:range/i)).toBeInTheDocument();
  });

  it('reports reuse, and explains why the axioms are dropped', () => {
    const { offeredBy } = usedOnce();
    const van = store().createClass({ localName: 'Van' });
    const garage = store().createClass({ localName: 'Garage' });
    store().attachPropertyToClass(offeredBy, van, garage);
    render(<RelationDetails propertyId={offeredBy} />);

    expect(screen.getByText('Reused (2×)')).toBeInTheDocument();
    expect(screen.getByText(/a union would lose the pairing/i)).toBeInTheDocument();
  });

  it('lists every pair the property is drawn between', () => {
    const { offeredBy } = usedOnce();
    const van = store().createClass({ localName: 'Van' });
    const garage = store().createClass({ localName: 'Garage' });
    store().attachPropertyToClass(offeredBy, van, garage);
    render(<RelationDetails propertyId={offeredBy} />);

    expect(screen.getByRole('button', { name: 'Car' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Van' })).toBeInTheDocument();
  });

  it('re-points one use without disturbing the others', async () => {
    const user = userEvent.setup();
    const { offeredBy, car } = usedOnce();
    const van = store().createClass({ localName: 'Van' });
    const garage = store().createClass({ localName: 'Garage' });
    store().attachPropertyToClass(offeredBy, van, garage);
    render(<RelationDetails propertyId={offeredBy} />);

    await user.selectOptions(screen.getByLabelText('Range of offeredBy on Car'), garage);

    const usages = usagesOfProperty(ontology(), offeredBy);
    expect(usages.find((u) => u.subjectClassId === car)?.objectClassId).toBe(garage);
    expect(usages.find((u) => u.subjectClassId === van)?.objectClassId).toBe(garage);
  });

  it('removes one use and leaves the property in the pool', async () => {
    const user = userEvent.setup();
    const { offeredBy } = usedOnce();
    render(<RelationDetails propertyId={offeredBy} />);

    await user.click(screen.getByRole('button', { name: 'Remove the offeredBy relation on Car' }));

    expect(usagesOfProperty(ontology(), offeredBy)).toHaveLength(0);
    expect(findObjectProperty(ontology(), offeredBy)).toBeDefined();
  });

  it('renames without dropping its uses', async () => {
    const user = userEvent.setup();
    const { offeredBy } = usedOnce();
    render(<RelationDetails propertyId={offeredBy} />);

    const field = screen.getByLabelText('Object property local name');
    await user.clear(field);
    await user.type(field, 'soldBy');

    expect(findObjectProperty(ontology(), offeredBy)?.localName).toBe('soldBy');
    expect(usagesOfProperty(ontology(), offeredBy)).toHaveLength(1);
  });

  it('flags an emptied name rather than reverting it', async () => {
    const user = userEvent.setup();
    const { offeredBy } = usedOnce();
    render(<RelationDetails propertyId={offeredBy} />);

    const field = screen.getByLabelText('Object property local name');
    await user.clear(field);

    expect(field).toHaveValue('');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(findObjectProperty(ontology(), offeredBy)?.localName).toBe('offeredBy');
  });

  it('deletes the property and all of its uses', async () => {
    const user = userEvent.setup();
    const { offeredBy } = usedOnce();
    render(<RelationDetails propertyId={offeredBy} />);

    await user.click(screen.getByRole('button', { name: 'Delete property' }));

    expect(findObjectProperty(ontology(), offeredBy)).toBeUndefined();
    expect(ontology().usages).toHaveLength(0);
  });
});
