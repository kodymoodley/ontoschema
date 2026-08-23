import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useProjectStore } from '../projectstore';
import { findClass } from '../ontologymodel';
import { AnnotationSection } from './AnnotationSection';

/**
 * The form in front of the vocabulary.
 *
 * What is being checked is that a labelled box and a term in a list are two ways of writing the
 * same annotation — the model does not know which one was used — and that nothing becomes
 * unreachable by being promoted to a box.
 */

const store = () => useProjectStore.getState();
const ontology = () => {
  const state = useProjectStore.getState();
  const project = state.projects.find((candidate) => candidate.id === state.activeProjectId);
  if (!project) throw new Error('no active project');
  return project.ontology;
};

function renderForClass() {
  const id = store().createClass({ localName: 'Car' });
  render(<AnnotationSection target={{ kind: 'class', id }} />);
  return id;
}

const annotationsOf = (id: string) => findClass(ontology(), id)?.annotations ?? [];

describe('a named field', () => {
  it('writes its term, without anyone having to know it', async () => {
    const user = userEvent.setup();
    const id = renderForClass();

    await user.type(screen.getByLabelText('Definition'), 'A road vehicle');

    expect(annotationsOf(id)).toHaveLength(1);
    expect(annotationsOf(id)[0]).toMatchObject({
      term: 'skos:definition',
      value: 'A road vehicle',
      language: 'en',
    });
  });

  /*
   * An empty box is not an annotation with an empty value. `dcterms:title ""` in an exported
   * file is a claim that the title is the empty string, which is not what an untouched field
   * means -- and it is what a form of always-present fields would write.
   */
  it('takes the annotation away again when the box is emptied', async () => {
    const user = userEvent.setup();
    const id = renderForClass();
    const field = screen.getByLabelText('Label');

    await user.type(field, 'Car');
    expect(annotationsOf(id)).toHaveLength(1);

    await user.clear(field);
    expect(annotationsOf(id)).toHaveLength(0);
  });

  it('shows what is already there, whichever way it was written', () => {
    const id = store().createClass({ localName: 'Car' });
    store().annotate({ kind: 'class', id }, 'rdfs:comment', 'Written elsewhere');
    render(<AnnotationSection target={{ kind: 'class', id }} />);

    expect(screen.getByLabelText('Comment')).toHaveValue('Written elsewhere');
  });

  /* A checkbox, rather than a text field you type the word `true` into. */
  it('records deprecation as a switch, and unsets it by removing the annotation', async () => {
    const user = userEvent.setup();
    const id = renderForClass();
    const deprecated = screen.getByRole('switch', { name: 'Deprecated' });

    await user.click(deprecated);
    expect(annotationsOf(id)).toMatchObject([{ term: 'owl:deprecated', value: 'true' }]);

    await user.click(deprecated);
    expect(annotationsOf(id)).toHaveLength(0);
  });
});

describe('the vocabulary behind it', () => {
  it('names the term on every field when asked to', async () => {
    const user = userEvent.setup();
    renderForClass();

    expect(screen.queryByText('skos:definition')).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Show RDF terms' }));
    expect(screen.getByText('skos:definition')).toBeInTheDocument();
  });

  /*
   * The owner's rule for repeats: the field shows the first, and the rest stay editable in the
   * list. `skos:example` is the case it was decided for -- promoted, and the term most likely
   * to be written more than once.
   */
  it('keeps a second value of a promoted term reachable', () => {
    const id = store().createClass({ localName: 'Car' });
    const target = { kind: 'class' as const, id };
    store().annotate(target, 'skos:example', 'a hatchback');
    store().annotate(target, 'skos:example', 'an estate');
    render(<AnnotationSection target={target} />);

    expect(screen.getByLabelText('Example')).toHaveValue('a hatchback');
    // The second is in the list behind the form, on a row of its own.
    const rows = document.querySelectorAll('[data-annotation-term="skos:example"]');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.querySelector('textarea')).toHaveValue('an estate');
  });

  /*
   * Offering a term that has an empty box of its own would create a row that vanished as it
   * appeared, since the box above would claim it. Offered once it is in use, because then
   * adding it means adding another one.
   */
  it('offers a promoted term only once it is in use', async () => {
    const user = userEvent.setup();
    const id = renderForClass();
    const list = () =>
      [...screen.getByLabelText('Annotation term to add').querySelectorAll('option')].map(
        (option) => option.value,
      );

    expect(list()).not.toContain('skos:example');

    await user.type(screen.getByLabelText('Example'), 'a hatchback');
    expect(annotationsOf(id)).toHaveLength(1);
    expect(list()).toContain('skos:example');
  });
});
