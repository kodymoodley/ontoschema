import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useProjectStore } from '../projectstore';
import { findClass } from '../ontologymodel';
import { AnnotationEditor, LanguageTagSuggestions } from './AnnotationEditor';

const store = () => useProjectStore.getState();
const ontology = () => {
  const state = useProjectStore.getState();
  const project = state.projects.find((candidate) => candidate.id === state.activeProjectId);
  if (!project) throw new Error('no active project');
  return project.ontology;
};

function renderForClass() {
  const id = store().createClass({ localName: 'Car' });
  render(
    <>
      <LanguageTagSuggestions />
      <AnnotationEditor target={{ kind: 'class', id }} />
    </>,
  );
  return id;
}

const annotationsOf = (id: string) => findClass(ontology(), id)?.annotations ?? [];

/** The editor tags each row with the term it edits. */
const rowFor = (term: string) =>
  document.querySelector<HTMLElement>(`[data-annotation-term="${term}"]`);

describe('AnnotationEditor', () => {
  it('starts empty with an explanation', () => {
    renderForClass();
    expect(screen.getByText(/No annotations yet/i)).toBeInTheDocument();
  });

  it('adds the chosen term', async () => {
    const user = userEvent.setup();
    const id = renderForClass();

    await user.selectOptions(screen.getByLabelText('Annotation term to add'), 'skos:prefLabel');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(annotationsOf(id)).toHaveLength(1);
    expect(annotationsOf(id)[0]?.term).toBe('skos:prefLabel');
  });

  it('defaults a text annotation to English and offers a language field', async () => {
    const user = userEvent.setup();
    const id = renderForClass();

    await user.selectOptions(screen.getByLabelText('Annotation term to add'), 'skos:prefLabel');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(annotationsOf(id)[0]?.language).toBe('en');
    expect(screen.getByLabelText('skos:prefLabel language tag')).toHaveValue('en');
  });

  it('writes the typed value into the model', async () => {
    const user = userEvent.setup();
    const id = renderForClass();

    await user.selectOptions(screen.getByLabelText('Annotation term to add'), 'skos:prefLabel');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.type(screen.getByLabelText('skos:prefLabel value'), 'Car');

    expect(annotationsOf(id)[0]?.value).toBe('Car');
  });

  it('keeps focus in the value field across the whole word', async () => {
    const user = userEvent.setup();
    renderForClass();

    await user.selectOptions(screen.getByLabelText('Annotation term to add'), 'skos:prefLabel');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    const value = screen.getByLabelText('skos:prefLabel value');
    await user.click(value);
    await user.keyboard('Dealership');
    expect(value).toHaveFocus();
  });

  it('holds two values for one term under different language tags', async () => {
    const user = userEvent.setup();
    const id = renderForClass();

    for (const [text, language] of [
      ['Car', 'en'],
      ['Auto', 'nl'],
    ]) {
      await user.selectOptions(screen.getByLabelText('Annotation term to add'), 'skos:prefLabel');
      await user.click(screen.getByRole('button', { name: 'Add' }));
      const values = screen.getAllByLabelText('skos:prefLabel value');
      const languages = screen.getAllByLabelText('skos:prefLabel language tag');
      await user.clear(values.at(-1) as HTMLElement);
      await user.type(values.at(-1) as HTMLElement, text as string);
      await user.clear(languages.at(-1) as HTMLElement);
      await user.type(languages.at(-1) as HTMLElement, language as string);
    }

    expect(annotationsOf(id)).toHaveLength(2);
    expect(annotationsOf(id).map((a) => [a.value, a.language])).toEqual([
      ['Car', 'en'],
      ['Auto', 'nl'],
    ]);
  });

  it('normalises a sloppy language tag', async () => {
    const user = userEvent.setup();
    const id = renderForClass();

    await user.selectOptions(screen.getByLabelText('Annotation term to add'), 'rdfs:label');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    const language = screen.getByLabelText('rdfs:label language tag');
    await user.clear(language);
    await user.type(language, 'EN-gb');

    expect(annotationsOf(id)[0]?.language).toBe('en-GB');
  });

  it('marks a malformed language tag as invalid without discarding it', async () => {
    const user = userEvent.setup();
    renderForClass();

    await user.selectOptions(screen.getByLabelText('Annotation term to add'), 'rdfs:label');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    const language = screen.getByLabelText('rdfs:label language tag');
    await user.clear(language);
    await user.type(language, '!!');

    expect(language).toHaveAttribute('aria-invalid', 'true');
  });

  it('offers no language tag for a term whose value is an IRI', async () => {
    const user = userEvent.setup();
    renderForClass();

    await user.selectOptions(screen.getByLabelText('Annotation term to add'), 'rdfs:seeAlso');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.queryByLabelText('rdfs:seeAlso language tag')).not.toBeInTheDocument();
    const row = rowFor('rdfs:seeAlso');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('IRI')).toBeInTheDocument();
  });

  it('uses a date control for a date-valued term', async () => {
    const user = userEvent.setup();
    renderForClass();

    await user.selectOptions(screen.getByLabelText('Annotation term to add'), 'dcterms:created');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByLabelText('dcterms:created value')).toHaveAttribute('type', 'date');
  });

  it('changes an annotation term in place, keeping the value', async () => {
    const user = userEvent.setup();
    const id = renderForClass();

    await user.selectOptions(screen.getByLabelText('Annotation term to add'), 'rdfs:label');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.type(screen.getByLabelText('rdfs:label value'), 'Car');
    await user.selectOptions(screen.getByLabelText('Annotation term'), 'skos:prefLabel');

    expect(annotationsOf(id)[0]).toMatchObject({ term: 'skos:prefLabel', value: 'Car' });
  });

  it('removes an annotation', async () => {
    const user = userEvent.setup();
    const id = renderForClass();

    await user.selectOptions(screen.getByLabelText('Annotation term to add'), 'rdfs:label');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Remove rdfs:label' }));

    expect(annotationsOf(id)).toHaveLength(0);
  });

  it('offers only ontology-appropriate terms for the ontology header', () => {
    render(<AnnotationEditor target={{ kind: 'ontology', id: '' }} />);
    const picker = screen.getByLabelText('Annotation term to add');
    expect(within(picker).getByRole('option', { name: /dcterms:title/ })).toBeInTheDocument();
    // skos:prefLabel describes a concept, not an ontology, so it is not offered here.
    expect(
      within(picker).queryByRole('option', { name: /skos:prefLabel/ }),
    ).not.toBeInTheDocument();
  });

  it('renders nothing when the target no longer exists', () => {
    const { container } = render(<AnnotationEditor target={{ kind: 'class', id: 'gone' }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
