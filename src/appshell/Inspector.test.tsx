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

    const headings = screen.getAllByRole('heading').map((h) => h.textContent?.replace('+', ''));
    expect(headings).toEqual(['Documentation', 'Details']);
    // Both sections are real, not just headings: a field from each, mounted behind the fold.
    expect(screen.getByLabelText('Class local name')).toBeInTheDocument();
    expect(screen.getByLabelText('Annotation term to add')).toBeInTheDocument();
  });

  describe('folding a section away', () => {
    /*
     * Closed, so the panel opens as a list of headings. On a class with a long documentation
     * section the details were a screen of scrolling away, and the headings are both the fastest
     * thing to read and the shortest distance to any of them.
     */
    it('starts closed, and says so on the control', () => {
      selectClass();
      render(<Inspector />);

      for (const name of ['Documentation', 'Details']) {
        expect(screen.getByRole('button', { name: new RegExp(name) })).toHaveAttribute(
          'aria-expanded',
          'false',
        );
      }
      // Out of sight, but mounted: `hidden` rather than unmounting, so nothing typed is lost.
      expect(screen.getByLabelText('Class local name')).not.toBeVisible();
    });

    it('opens one section without touching the other', async () => {
      const user = userEvent.setup();
      selectClass();
      render(<Inspector />);

      await user.click(screen.getByRole('button', { name: /Details/ }));

      expect(screen.getByLabelText('Class local name')).toBeVisible();
      // A field of the documentation section proper -- the term list below it lives inside the
      // closed "Other properties" disclosure and is never visible from here.
      expect(screen.getByLabelText('Label')).not.toBeVisible();
      expect(screen.getByRole('button', { name: /Details/ })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });

    it('brings it back, with what was typed into it still there', async () => {
      const user = userEvent.setup();
      selectClass();
      render(<Inspector />);

      const details = () => screen.getByRole('button', { name: /Details/ });
      await user.click(details());

      const name = screen.getByLabelText('Class local name');
      await user.clear(name);
      await user.type(name, 'Coupe');

      await user.click(details());
      await user.click(details());

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
  it('gives the two Add buttons names that tell them apart', async () => {
    const user = userEvent.setup();
    selectClass();
    render(<Inspector />);

    /*
     * Both sections open first. The claim is about the names, not about visibility -- "Add
     * annotation" sits inside the closed "Other properties" disclosure even once its section is
     * open -- but a closed section is `hidden`, and `getByRole` does not look inside one.
     */
    await user.click(screen.getByRole('button', { name: /Documentation/ }));
    await user.click(screen.getByRole('button', { name: /Details/ }));

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
