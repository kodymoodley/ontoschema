import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  /*
   * Documentation first: what a thing means is what someone opens the panel to read, and its
   * wiring is what the canvas is already showing.
   */
  it('shows the documentation and the details together, in that order', () => {
    selectClass();
    render(<Inspector />);

    const headings = screen.getAllByRole('heading').map((h) => h.textContent?.replace('−', ''));
    expect(headings).toEqual(['Documentation', 'Details']);
    // Both sections are real, not just headings: a field from each.
    expect(screen.getByLabelText('Class local name')).toBeInTheDocument();
    expect(screen.getByLabelText('Annotation term to add')).toBeInTheDocument();
  });

  describe('folding a section away', () => {
    it('starts open, and says so on the control', () => {
      selectClass();
      render(<Inspector />);

      for (const name of ['Documentation', 'Details']) {
        expect(screen.getByRole('button', { name: new RegExp(name) })).toHaveAttribute(
          'aria-expanded',
          'true',
        );
      }
    });

    it('folds one section without touching the other', async () => {
      const user = userEvent.setup();
      selectClass();
      render(<Inspector />);

      await user.click(screen.getByRole('button', { name: /Details/ }));

      /*
       * Out of sight, still mounted. That is the point of `hidden` over unmounting: what was
       * typed into a folded section is still there when it comes back, which the next test
       * checks. Visibility is the claim, not presence.
       */
      expect(screen.getByLabelText('Class local name')).not.toBeVisible();
      // A field of the documentation section proper -- the term list below it lives inside the
      // closed "Other properties" disclosure and is never visible from here.
      expect(screen.getByLabelText('Label')).toBeVisible();
      expect(screen.getByRole('button', { name: /Details/ })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });

    it('brings it back, with what was typed into it still there', async () => {
      const user = userEvent.setup();
      selectClass();
      render(<Inspector />);

      const name = screen.getByLabelText('Class local name');
      await user.clear(name);
      await user.type(name, 'Coupe');

      await user.click(screen.getByRole('button', { name: /Details/ }));
      await user.click(screen.getByRole('button', { name: /Details/ }));

      expect(screen.getByLabelText('Class local name')).toHaveValue('Coupe');
    });
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
