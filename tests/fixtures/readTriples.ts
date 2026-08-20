import { OWL_UNION_OF, RDF_FIRST, RDF_NIL, RDF_REST } from '../../src/annotationvocabulary';
import type { Triple } from '../../src/ontologymodel';

/**
 * Reading the internal triple list back, the way a consumer of the file would.
 *
 * Kept apart from `parseRdf.ts`, which is about real parsers and their quads. These work on
 * the list the model produces, before any syntax is chosen.
 */

/** Every object asserted for one subject and predicate. */
export const objectsOf = (triples: readonly Triple[], subject: string, predicate: string) =>
  triples
    .filter((triple) => triple.subject === subject && triple.predicate === predicate)
    .map((triple) => triple.object.value);

/** Whether one assertion is present. `object` is matched on the fields given, not all of them. */
export function has(
  triples: readonly Triple[],
  subject: string,
  predicate: string,
  object: Partial<Triple['object']>,
): boolean {
  return triples.some(
    (triple) =>
      triple.subject === subject &&
      triple.predicate === predicate &&
      Object.entries(object).every(
        ([key, value]) => (triple.object as Record<string, unknown>)[key] === value,
      ),
  );
}

/**
 * Walks a named `owl:unionOf` back into the classes it stands for.
 *
 * Reads the collection rather than asserting on cell names: the names are an implementation
 * detail, the membership is the fact being claimed.
 */
export function unionMembers(triples: readonly Triple[], union: string): string[] {
  const [head] = objectsOf(triples, union, OWL_UNION_OF);
  const members: string[] = [];
  let cell = head;
  while (cell && cell !== RDF_NIL) {
    const [first] = objectsOf(triples, cell, RDF_FIRST);
    if (first) members.push(first);
    cell = objectsOf(triples, cell, RDF_REST)[0];
  }
  return members;
}
