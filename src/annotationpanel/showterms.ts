import { createPreference } from '../projectstore';

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
