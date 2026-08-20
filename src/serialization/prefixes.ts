import { NAMESPACES } from '../annotationvocabulary';
import { isBlankNode, localNameOf, namespaceOf, normalizeNamespaceIri } from '../ontologymodel';
import type { Ontology, Triple } from '../ontologymodel';

export { localNameOf, namespaceOf };

export interface PrefixTable {
  [prefix: string]: string;
}

/**
 * The prefixes written into an export. Only namespaces actually used by the triples are
 * declared, so a small ontology does not carry a wall of unused prefix lines — except for
 * the ontology's own prefix, which is always declared as documentation of the namespace.
 */
export function prefixesFor(ontology: Ontology, triples: readonly Triple[]): PrefixTable {
  const namespace = normalizeNamespaceIri(ontology.iri);
  const used = new Set<string>();

  for (const triple of triples) {
    // A blank node has no namespace, as a subject or as an object.
    if (!isBlankNode(triple.subject)) used.add(namespaceOf(triple.subject));
    used.add(namespaceOf(triple.predicate));
    if (triple.object.type === 'iri') used.add(namespaceOf(triple.object.value));
    else if (triple.object.type === 'literal' && triple.object.datatype) {
      used.add(namespaceOf(triple.object.datatype));
    }
  }

  const table: PrefixTable = {};
  for (const [prefix, iri] of Object.entries(NAMESPACES)) {
    if (used.has(iri)) table[prefix] = iri;
  }
  // rdf: is implied by rdf:type but N3 only writes it when it appears; keep it explicit.
  if (!table.rdf) table.rdf = NAMESPACES.rdf;

  const ownPrefix = ontology.prefix.trim() || 'ex';
  table[ownPrefix] = namespace;
  return table;
}

/** Splits an IRI at its last `#` or `/`, returning the namespace part. */

/** Renders `iri` as a CURIE when a declared prefix covers it, else returns null. */
export function toCurie(iri: string, prefixes: PrefixTable): string | null {
  const namespace = namespaceOf(iri);
  const local = localNameOf(iri);
  if (!local) return null;
  for (const [prefix, value] of Object.entries(prefixes)) {
    if (value === namespace) return `${prefix}:${local}`;
  }
  return null;
}
