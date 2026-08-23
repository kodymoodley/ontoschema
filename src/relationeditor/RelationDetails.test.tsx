import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useProjectStore } from '../projectstore';
import { RDFS_DOMAIN, RDFS_RANGE, SH_NODE_SHAPE } from '../annotationvocabulary';
import { findRelation, ontologyToTriples, usagesOfProperty } from '../ontologymodel';
import { DOCUMENT_OPTIONS } from '../serialization';
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
  const offeredBy = store().createRelation({ localName: 'offeredBy' });
  store().attachPropertyToClass(offeredBy, car, dealership);
  return { car, dealership, offeredBy };
}

describe('RelationDetails', () => {
  it('reports an unused property and says nothing is drawn for it', () => {
    const hasPart = store().createRelation({ localName: 'hasPart' });
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
    expect(screen.getByText(/not which goes with which/i)).toBeInTheDocument();
  });

  /*
   * The panel makes a claim about the file this app writes, and this is what keeps the claim
   * true. It was false for a while: the sentence said the axioms were omitted on reuse, which
   * they had been until a commit changed the exporter to state a union instead. Nothing failed,
   * because nothing tied the words to the behaviour. This does -- one ontology, read both ways.
   */
  it('says the same thing the exporter does', () => {
    const { offeredBy } = usedOnce();
    const van = store().createClass({ localName: 'Van' });
    const garage = store().createClass({ localName: 'Garage' });
    store().attachPropertyToClass(offeredBy, van, garage);
    render(<RelationDetails propertyId={offeredBy} />);
    const claim = screen.getByText(/rdfs:domain and rdfs:range/i).textContent ?? '';

    // The options a saved file is written with, not this test's idea of them.
    const saved = ontologyToTriples(ontology(), DOCUMENT_OPTIONS);
    const states = (predicate: string) =>
      saved.some(
        (triple) => triple.predicate === predicate && triple.subject.endsWith('offeredBy'),
      );

    expect(claim).toContain('omitted');
    expect(states(RDFS_DOMAIN), 'the panel says omitted; the file states a domain').toBe(false);
    expect(states(RDFS_RANGE), 'the panel says omitted; the file states a range').toBe(false);
    // And the shapes it points at are in that same file.
    expect(saved.some((triple) => triple.object.value === SH_NODE_SHAPE)).toBe(true);
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
    expect(findRelation(ontology(), offeredBy)).toBeDefined();
  });

  it('renames without dropping its uses', async () => {
    const user = userEvent.setup();
    const { offeredBy } = usedOnce();
    render(<RelationDetails propertyId={offeredBy} />);

    const field = screen.getByLabelText('Relation local name');
    await user.clear(field);
    await user.type(field, 'soldBy');

    expect(findRelation(ontology(), offeredBy)?.localName).toBe('soldBy');
    expect(usagesOfProperty(ontology(), offeredBy)).toHaveLength(1);
  });

  it('flags an emptied name rather than reverting it', async () => {
    const user = userEvent.setup();
    const { offeredBy } = usedOnce();
    render(<RelationDetails propertyId={offeredBy} />);

    const field = screen.getByLabelText('Relation local name');
    await user.clear(field);

    expect(field).toHaveValue('');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(findRelation(ontology(), offeredBy)?.localName).toBe('offeredBy');
  });

  it('deletes the property and all of its uses', async () => {
    const user = userEvent.setup();
    const { offeredBy } = usedOnce();
    render(<RelationDetails propertyId={offeredBy} />);

    await user.click(screen.getByRole('button', { name: 'Delete relation' }));

    expect(findRelation(ontology(), offeredBy)).toBeUndefined();
    expect(ontology().usages).toHaveLength(0);
  });
});
