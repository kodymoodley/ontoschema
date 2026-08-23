import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expectNoAxeViolations } from '../../tests/axe';
import { useProjectStore } from '../projectstore';
import { AnnotationSection } from '../annotationpanel';
import { ClassDetails, AttributeDetails } from '../classeditor';
import { ConnectionPicker, RelationDetails } from '../relationeditor';
import { HierarchyTree } from '../taxonomytree';
import { ExportPanel } from '../exportpanel';
import { OntologyMetadataForm } from '../ontologymetadata';
import { Button, Field, Modal, Select, TextInput } from './index';

const store = () => useProjectStore.getState();

/** A small schema, so every panel has something real to render. */
function seed() {
  store().setBaseIri('https://example.org/auto/');
  const car = store().createClass({ localName: 'Car' });
  const dealership = store().createClass({ localName: 'Dealership' });
  const price = store().createAttributeOn(car, { localName: 'price', range: 'decimal' });
  const offeredBy = store().createRelation({ localName: 'offeredBy' });
  store().attachPropertyToClass(offeredBy, car, dealership);
  store().reparentClass(dealership, car);
  store().annotate({ kind: 'class', id: car }, 'skos:prefLabel', 'Car', 'en');
  return { car, dealership, price, offeredBy };
}

/*
 * A green accessibility suite is worthless if the harness is silently doing nothing, which
 * is an easy state to reach in jsdom. These two prove it is really running.
 */
describe('the axe harness itself', () => {
  it('fails on a control with no accessible name', async () => {
    const { container } = render(<input type="text" />);
    await expect(expectNoAxeViolations(container)).rejects.toThrow();
  });

  it('reports which rule was broken, not just that something was', async () => {
    // Deliberately missing alt text, to prove the failure names the rule.
    const { container } = render(<img src="x.png" />);
    await expect(expectNoAxeViolations(container)).rejects.toThrow(/image-alt/);
  });
});

describe('panels have no axe violations', () => {
  it('class details', async () => {
    const { car } = seed();
    const { container } = render(<ClassDetails classId={car} />);
    await expectNoAxeViolations(container);
  });

  it('attribute details', async () => {
    const { price } = seed();
    const { container } = render(<AttributeDetails propertyId={price} />);
    await expectNoAxeViolations(container);
  });

  it('relation details', async () => {
    const { offeredBy } = seed();
    const { container } = render(<RelationDetails propertyId={offeredBy} />);
    await expectNoAxeViolations(container);
  });

  it('annotation editor', async () => {
    const { car } = seed();
    const { container } = render(<AnnotationSection target={{ kind: 'class', id: car }} />);
    await expectNoAxeViolations(container);
  });

  it('hierarchy tree, on each tab', async () => {
    const user = userEvent.setup();
    seed();
    const { container } = render(<HierarchyTree />);
    await expectNoAxeViolations(container);

    for (const tab of ['Relation', 'Attribute']) {
      await user.click(screen.getByRole('tab', { name: tab }));
      await expectNoAxeViolations(container);
    }
  });

  it('ontology metadata form', async () => {
    seed();
    const { container } = render(<OntologyMetadataForm />);
    await expectNoAxeViolations(container);
  });

  it('export panel', async () => {
    seed();
    const { container } = render(<ExportPanel />);
    await expectNoAxeViolations(container);
  });

  it('connection picker, which is a dialog', async () => {
    const { car, dealership } = seed();
    store().beginConnection({ subjectClassId: car, objectClassId: dealership });
    render(<ConnectionPicker />);
    // The dialog is portalled to the body, so the whole document is the subject.
    await expectNoAxeViolations(document.body);
  });
});

describe('dialog semantics', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <main>
        <button type="button" onClick={() => setOpen(true)}>
          open
        </button>
        <Modal
          title="A dialog"
          open={open}
          onClose={() => setOpen(false)}
          footer={<Button>Confirm</Button>}
        >
          <Field label="Name">
            <TextInput data-autofocus aria-label="Name" defaultValue="" />
          </Field>
          <Field label="Kind">
            <Select aria-label="Kind" defaultValue="a">
              <option value="a">A</option>
            </Select>
          </Field>
        </Modal>
      </main>
    );
  }

  it('names the dialog for assistive technology', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'open' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('A dialog');
  });

  it('passes axe while open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'open' }));
    await expectNoAxeViolations(document.body);
  });
});

describe('invalid controls announce themselves', () => {
  it('marks an invalid field for assistive technology, not only in colour', () => {
    render(
      <Field label="Prefix" error="Prefix cannot be empty.">
        <TextInput invalid aria-label="Prefix" defaultValue="" />
      </Field>,
    );
    expect(screen.getByLabelText('Prefix')).toHaveAttribute('aria-invalid', 'true');
  });

  it('leaves a valid field unmarked', () => {
    render(<TextInput aria-label="Prefix" defaultValue="ex" />);
    expect(screen.getByLabelText('Prefix')).not.toHaveAttribute('aria-invalid');
  });
});
