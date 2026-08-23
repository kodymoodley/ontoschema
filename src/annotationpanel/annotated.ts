import { findAttribute, findClass, findRelation } from '../ontologymodel';
import type { Annotation, EntityRef, Ontology } from '../ontologymodel';

/**
 * The annotations on whatever is being edited, or null when it no longer exists.
 *
 * Shared by the two editors — the named fields and the list of everything else — because both
 * have to agree about what they are looking at. `null` rather than an empty list, so a panel
 * left open on a deleted class renders nothing instead of an empty form.
 */
export function annotationsOf(ontology: Ontology, target: EntityRef): readonly Annotation[] | null {
  switch (target.kind) {
    case 'ontology':
      return ontology.annotations;
    case 'class':
      return findClass(ontology, target.id)?.annotations ?? null;
    case 'relation':
      return findRelation(ontology, target.id)?.annotations ?? null;
    case 'attribute':
      return findAttribute(ontology, target.id)?.annotations ?? null;
  }
}
