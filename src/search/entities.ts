import type { Annotation, EntityRef, Ontology } from '../ontologymodel';
import { search } from './bm25';
import type { SearchHit } from './bm25';

/**
 * Finding a class, relation or attribute in the open schema.
 *
 * Past about thirty classes the taxonomy tree stops being a way to find anything — you have to
 * already know where the thing is to use it — and that is the size the bundled examples reach.
 *
 * What is searched, and why in this order:
 *
 *  - the **local name**, weighted highest, because it is what people remember and what they
 *    type. `hasWheel` is tokenised into `has` and `wheel`, so half a name finds it.
 *  - the **labels**, next, since they are the same thing said for a reader.
 *  - the **definition and description**, lowest, because a class mentioned in passing in
 *    someone else's description should not outrank the class itself.
 */

/** A found entity, with enough to draw a row for it. */
export interface EntityMatch {
  ref: EntityRef;
  localName: string;
  kind: 'class' | 'relation' | 'attribute';
  /** The text that best explains why this is a result, if it was not simply the name. */
  context: string | null;
}

const LABEL_TERMS = ['rdfs:label', 'skos:prefLabel', 'skos:altLabel'];
const PROSE_TERMS = ['skos:definition', 'dcterms:description', 'rdfs:comment'];

const textOf = (annotations: readonly Annotation[], terms: readonly string[]) =>
  annotations
    .filter((annotation) => terms.includes(annotation.term))
    .map((annotation) => annotation.value)
    .join(' ');

export function searchEntities(ontology: Ontology, query: string, limit = 20): EntityMatch[] {
  const documents = [
    ...ontology.classes.map((entity) => ({ entity, kind: 'class' as const })),
    ...ontology.relations.map((entity) => ({ entity, kind: 'relation' as const })),
    ...ontology.attributes.map((entity) => ({ entity, kind: 'attribute' as const })),
  ].map(({ entity, kind }) => ({
    id: entity.id,
    fields: [
      { text: entity.localName, weight: 3 },
      { text: textOf(entity.annotations, LABEL_TERMS), weight: 2 },
      { text: textOf(entity.annotations, PROSE_TERMS), weight: 1 },
    ],
    value: { entity, kind },
  }));

  return search(documents, query, limit).map((hit) => toMatch(hit));
}

function toMatch(
  hit: SearchHit<{ entity: { id: string; localName: string }; kind: EntityMatch['kind'] }>,
): EntityMatch {
  const { entity, kind } = hit.value;
  return {
    ref: { kind, id: entity.id },
    localName: entity.localName,
    kind,
    // The name is already the row's heading, so repeating it as context says nothing.
    context: hit.matched && hit.matched !== entity.localName ? hit.matched : null,
  };
}
