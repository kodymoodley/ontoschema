import type { Annotation } from '../ontologymodel';

/**
 * The few annotations that get a form field of their own, and the rule for everything else.
 *
 * The tool used to ask people to know that a schema's title is `dcterms:title` and that what a
 * class means is `skos:definition`, then find each in a list of thirty CURIEs grouped by
 * namespace prefix. The vocabulary was the interface. These are the terms common enough to earn
 * a labelled box in plain words instead; every other term is still reachable, unchanged, in the
 * list that now sits behind "Other properties".
 *
 * **A named field edits the first annotation with its term, and only the first.** The model
 * allows several — three examples, two alternative labels — and a form that grew a list under
 * every field would be most of the weight this is trying to remove. So the second example and
 * beyond appear under Other properties, where lists are what the editor is for. That is the
 * owner's decision, taken with `skos:example` in mind: it is both worth promoting and the term
 * most likely to repeat.
 */

/** How a field is edited, where the vocabulary's own value kind does not settle it. */
export type FieldControl = 'text' | 'multiline' | 'licence' | 'boolean';

export interface NamedField {
  /** The term this field reads and writes. */
  term: string;
  /** What it is called in the form. Plain words: the CURIE is shown only when asked for. */
  label: string;
  control: FieldControl;
  /**
   * Whether the value is prose that could be written in another language.
   *
   * Declared here rather than taken from the vocabulary, which calls a creator's name text and
   * so offered to tag it `en`. A language on `dcterms:creator` is not wrong, it is just never
   * what anyone wants, and a dropdown beside every field is most of what a form should not be.
   * A value that already carries a tag still shows the control, so nothing becomes uneditable.
   */
  language?: boolean;
  /** A word about what belongs here, where the label alone leaves it open. */
  hint?: string;
}

/** The schema's own metadata. Namespace and prefix are not annotations and are not here. */
export const SCHEMA_FIELDS: readonly NamedField[] = [
  { term: 'dcterms:title', label: 'Title', control: 'text', language: true },
  { term: 'dcterms:description', label: 'Description', control: 'multiline', language: true },
  { term: 'dcterms:creator', label: 'Author', control: 'text', hint: 'Person or organisation.' },
  { term: 'owl:versionInfo', label: 'Version', control: 'text', hint: 'For example 1.2.0.' },
  { term: 'dcterms:license', label: 'Licence', control: 'licence' },
];

/** A class, relation or attribute. */
export const ENTITY_FIELDS: readonly NamedField[] = [
  {
    term: 'rdfs:label',
    label: 'Label',
    control: 'text',
    language: true,
    hint: 'How this reads to a person.',
  },
  { term: 'skos:definition', label: 'Definition', control: 'multiline', language: true },
  { term: 'rdfs:comment', label: 'Comment', control: 'multiline', language: true },
  { term: 'skos:example', label: 'Example', control: 'multiline', language: true },
  { term: 'owl:deprecated', label: 'Deprecated', control: 'boolean' },
];

/** What a field is currently editing: the first annotation with its term, if there is one. */
export function namedValue(
  annotations: readonly Annotation[],
  term: string,
): Annotation | undefined {
  return annotations.find((annotation) => annotation.term === term);
}

/**
 * Everything the named fields do not account for, in the order it was written.
 *
 * One occurrence per named term is taken, not every occurrence: a second `skos:example` has no
 * field to live in and has to appear here, or editing it would be impossible.
 */
export function unnamedAnnotations(
  annotations: readonly Annotation[],
  fields: readonly NamedField[],
): Annotation[] {
  const claimed = new Set<string>();
  for (const field of fields) {
    const first = namedValue(annotations, field.term);
    if (first) claimed.add(first.id);
  }
  return annotations.filter((annotation) => !claimed.has(annotation.id));
}

/** True when this term has a field of its own, so the Other list should not offer it twice. */
export function isNamedTerm(term: string, fields: readonly NamedField[]): boolean {
  return fields.some((field) => field.term === term);
}
