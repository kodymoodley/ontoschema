import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useProjectStore } from '../projectstore';
import { Inspector } from './Inspector';

/**
 * One panel, no tabs.
 *
 * Three tabs left in turn and each departure had the same shape, so the test that matters is
 * that nothing tabbed remains: a tab is how a panel hides half of what it knows, and this one
 * describes a single thing from a single source.
 */

const store = () => useProjectStore.getState();

const selectClass = () => {
  const car = store().createClass({ localName: 'Car' });
  store().select({ kind: 'class', id: car });
  return car;
};

describe('with something selected', () => {
  it('has no tabs at all', () => {
    selectClass();
    render(<Inspector />);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('shows the details and the annotations together, in that order', () => {
    selectClass();
    render(<Inspector />);

    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(headings).toEqual(['Details', 'Annotations']);
    // Both sections are real, not just headings: a field from each.
    expect(screen.getByLabelText('Class local name')).toBeInTheDocument();
    expect(screen.getByLabelText('Annotation term to add')).toBeInTheDocument();
  });

  it('names the entity once, above both sections', () => {
    selectClass();
    render(<Inspector />);
    expect(screen.getByText('Car')).toBeInTheDocument();
    expect(screen.getByText('Class')).toBeInTheDocument();
  });

  /*
   * The two "Add" buttons were only ever apart because a tab hid one of them. On one panel they
   * are on screen together, and two controls answering to one name is a problem for anyone
   * reaching them by name.
   */
  it('gives the two Add buttons names that tell them apart', () => {
    selectClass();
    render(<Inspector />);

    expect(screen.getByRole('button', { name: 'Add attribute to this class' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add annotation' })).toBeInTheDocument();
  });
});

describe('with nothing selected', () => {
  it('says so once, rather than once per section', () => {
    render(<Inspector />);

    expect(screen.getByText(/Nothing selected/)).toBeInTheDocument();
    expect(screen.queryAllByRole('heading')).toHaveLength(0);
  });

  it("points at where the ontology's own metadata went", () => {
    render(<Inspector />);
    expect(screen.getByText('Metadata')).toBeInTheDocument();
  });
});

/*
 * The document is called a schema on screen and an ontology in the file. The exported RDF still
 * says `owl:Ontology`, exactly as it still says `owl:ObjectProperty` for what the interface
 * calls a relation: the vocabulary belongs to OWL, the words belong to whoever is reading them.
 */
describe('what the document is called', () => {
  it('says schema, not ontology', () => {
    store().select({ kind: 'ontology', id: '' });
    render(<Inspector />);

    // Twice: the badge names the kind and the header names the thing. Both said Ontology before.
    expect(screen.getAllByText('Schema')).toHaveLength(2);
    expect(screen.queryByText(/Ontology/)).not.toBeInTheDocument();
  });
});
