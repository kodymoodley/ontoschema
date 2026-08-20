import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useProjectStore } from '../projectstore';
import { ExportPanel } from './ExportPanel';

/**
 * The panel writes files for one of two purposes, and the split is the thing worth testing:
 * saving offers documents this app can open again, exporting offers renderings it cannot.
 * Putting a file in the wrong list is the failure that would matter, because it would promise
 * a round trip that does not exist.
 */

const store = () => useProjectStore.getState();

function carWithAttribute() {
  store().setBaseIri('https://example.org/auto/');
  store().setPrefix('auto');
  const car = store().createClass({ localName: 'Car' });
  store().createAttributeOn(car, { localName: 'price', range: 'decimal' });
  return car;
}

const preview = () => screen.getByTestId('export-preview').textContent ?? '';

describe('saving a schema', () => {
  it('warns before writing an ontology with nothing in it', () => {
    render(<ExportPanel purpose="save" />);
    expect(screen.getByText(/no classes or properties yet/i)).toBeInTheDocument();
  });

  it('offers only the syntaxes this app can open again', () => {
    render(<ExportPanel purpose="save" />);

    expect(screen.getByTestId('download-ttl')).toBeInTheDocument();
    expect(screen.getByTestId('download-rdf')).toBeInTheDocument();
    expect(screen.getByTestId('download-owl')).toBeInTheDocument();
    // A rendering is not a document, however good a file it makes.
    expect(screen.queryByTestId('download-mmd')).not.toBeInTheDocument();
    expect(screen.queryByTestId('download-jsonld')).not.toBeInTheDocument();
    expect(screen.queryByTestId('download-shapes')).not.toBeInTheDocument();
  });

  /*
   * Shapes used to ride inside the ontology. They are a file of their own now, which is what
   * lets the ontology file be the thing a reasoner reads without being told to ignore half of
   * it — and it is why a reused property has to state its domain as a union.
   */
  it('writes the axioms and the layout, and no shapes', () => {
    carWithAttribute();
    render(<ExportPanel purpose="save" />);

    expect(preview()).toContain('auto:Car a owl:Class');
    expect(preview()).toContain('ontoschema:layout');
    expect(preview()).not.toContain('sh:NodeShape');
  });

  it('says what saving promises', () => {
    render(<ExportPanel purpose="save" />);
    expect(screen.getByText(/opens again here/i)).toBeInTheDocument();
  });

  it('switches the preview between the syntaxes', async () => {
    const user = userEvent.setup();
    carWithAttribute();
    render(<ExportPanel purpose="save" />);

    expect(preview()).toContain('@prefix');
    await user.selectOptions(screen.getByLabelText('Preview format'), 'rdf');
    expect(preview()).toContain('<?xml version="1.0"');
  });
});

describe('exporting', () => {
  it('offers the shapes, JSON-LD and the diagram, and nothing that would round-trip', () => {
    render(<ExportPanel />);

    expect(screen.getByTestId('download-shapes')).toBeInTheDocument();
    expect(screen.getByTestId('download-jsonld')).toBeInTheDocument();
    expect(screen.getByTestId('download-mmd')).toBeInTheDocument();
    expect(screen.queryByTestId('download-ttl')).not.toBeInTheDocument();
  });

  it('previews the shapes on their own, with no axioms beside them', () => {
    carWithAttribute();
    render(<ExportPanel />);

    expect(preview()).toContain('sh:NodeShape');
    expect(preview()).toContain('auto:Car_price');
    expect(preview()).not.toContain('auto:Car a owl:Class');
    // A layout means nothing to a validator.
    expect(preview()).not.toContain('ontoschema:layout');
  });

  it('says these are renderings rather than documents', () => {
    render(<ExportPanel />);
    expect(screen.getByText(/does not read them back/i)).toBeInTheDocument();
  });

  it('says the diagram is a picture rather than RDF', () => {
    render(<ExportPanel />);
    expect(screen.getByText(/a picture, not RDF/i)).toBeInTheDocument();
  });

  it('previews the diagram when it is chosen', async () => {
    const user = userEvent.setup();
    carWithAttribute();
    render(<ExportPanel />);

    await user.selectOptions(screen.getByLabelText('Preview format'), 'mmd');
    expect(preview()).toContain('classDiagram');
    expect(preview()).toContain('class Car');
  });
});

describe('either way', () => {
  it('follows the model as it changes', async () => {
    const car = carWithAttribute();
    const { rerender } = render(<ExportPanel purpose="save" />);
    expect(preview()).toContain('auto:Car');

    store().renameClassById(car, 'Automobile');
    rerender(<ExportPanel purpose="save" />);

    expect(preview()).toContain('auto:Automobile');
    expect(preview()).not.toContain('auto:Car a');
  });
});
