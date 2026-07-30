import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useProjectStore } from '../projectstore';
import { ExportPanel } from './ExportPanel';

const store = () => useProjectStore.getState();

function carWithAttribute() {
  store().setBaseIri('https://example.org/auto/');
  store().setPrefix('auto');
  const car = store().createClass({ localName: 'Car' });
  store().createAttributeOn(car, { localName: 'price', range: 'decimal' });
  return car;
}

const preview = () => screen.getByTestId('export-preview').textContent ?? '';

describe('ExportPanel', () => {
  it('warns before exporting an ontology with nothing in it', () => {
    render(<ExportPanel />);
    expect(screen.getByText(/no classes or properties yet/i)).toBeInTheDocument();
  });

  it('previews both layers by default', () => {
    carWithAttribute();
    render(<ExportPanel />);
    expect(preview()).toContain('auto:Car a owl:Class');
    expect(preview()).toContain('sh:NodeShape');
  });

  it('drops the shapes when SHACL is switched off', async () => {
    const user = userEvent.setup();
    carWithAttribute();
    render(<ExportPanel />);

    await user.click(screen.getByLabelText('Include SHACL shapes'));

    expect(preview()).toContain('auto:Car a owl:Class');
    expect(preview()).not.toContain('sh:NodeShape');
  });

  it('drops the axioms when OWL/RDFS is switched off', async () => {
    const user = userEvent.setup();
    carWithAttribute();
    render(<ExportPanel />);

    await user.click(screen.getByLabelText('Include OWL and RDFS axioms'));

    expect(preview()).not.toContain('a owl:Class');
    expect(preview()).toContain('sh:NodeShape');
    // The ontology header belongs to neither layer and always survives.
    expect(preview()).toContain('a owl:Ontology');
  });

  it('switches the preview between serializations', async () => {
    const user = userEvent.setup();
    carWithAttribute();
    render(<ExportPanel />);

    await user.selectOptions(screen.getByLabelText('Preview format'), 'rdfxml');
    expect(preview()).toContain('<?xml version="1.0" encoding="UTF-8"?>');

    await user.selectOptions(screen.getByLabelText('Preview format'), 'jsonld');
    expect(preview()).toContain('"@context"');
  });

  it('follows the model as it changes', async () => {
    const car = carWithAttribute();
    render(<ExportPanel />);
    expect(preview()).toContain('auto:Car');

    store().renameClassById(car, 'Automobile');
    expect(await screen.findByText(/auto:Automobile/)).toBeInTheDocument();
  });

  it('offers all four downloads', () => {
    carWithAttribute();
    render(<ExportPanel />);
    for (const extension of ['ttl', 'rdf', 'owl', 'jsonld']) {
      expect(screen.getByTestId(`download-${extension}`)).toBeInTheDocument();
    }
  });
});
