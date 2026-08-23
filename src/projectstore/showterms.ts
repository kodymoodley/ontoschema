import { createPreference } from './preference';

/**
 * Whether the RDF term behind each named field is shown beside its label.
 *
 * Off by default, which is the point of the named fields: someone filling in a title should not
 * have to meet `dcterms:title` to do it. On, every field says which term it writes — so the
 * vocabulary is one switch away rather than hidden, and an expert can confirm what a form is
 * about to put in their file.
 *
 * Shared rather than per-panel. The schema's metadata and an entity's details are two surfaces
 * showing the same kind of thing, and a switch that had to be found twice would read as two
 * different settings.
 *
 * It lives here rather than with the panel that draws the switch because four UI modules read it
 * now — the ones that show a term beside a field, and the ones that show an entity's IRI — and a
 * UI module may not import a sibling. This is the shared place they all may reach.
 *
 * What it governs is one idea, not two: **the RDF underneath**. A term like `dcterms:title`, and
 * the IRI an entity will be written as. Both are the plumbing of what the form is for, worth
 * seeing when you want it and worth not meeting when you do not.
 */

const showTerms = createPreference<boolean>(
  'ontoschema.showTerms',
  (stored) => (stored === 'true' ? true : stored === 'false' ? false : undefined),
  (value) => String(value),
  () => false,
);

export function useShowTerms(): boolean {
  return showTerms.use();
}

export function toggleShowTerms(): void {
  showTerms.set(!showTerms.get());
}
