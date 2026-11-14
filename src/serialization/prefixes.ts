import { NAMESPACES } from '../annotationvocabulary';
import {
  isBlankNode,
  localNameOf,
  namespaceOf,
  normalizeNamespaceIri,
  validatePrefix,
} from '../ontologymodel';
import type { Ontology, Triple } from '../ontologymodel';

export { localNameOf, namespaceOf };

export interface PrefixTable {
  [prefix: string]: string;
}

/**
 * The prefixes written into an export. Only namespaces actually used by the triples are
 * declared, so a small ontology does not carry a wall of unused prefix lines — except for
 * the ontology's own prefix, which is always declared as documentation of the namespace.
 *
 * Each namespace is named the way the document it came from named it, then the way this app
 * names it, and the ontology's own prefix always names its own namespace. One name per
 * namespace, one namespace per name; the first claim wins. A prefix this app could not write in
 * every format, such as Turtle's empty `:`, is passed over.
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

  const ownPrefix = ontology.prefix.trim() || 'ex';
  const table: PrefixTable = {};
  const named = new Set<string>();
  const claim = (prefix: string, iri: string) => {
    if (table[prefix] || named.has(iri) || !validatePrefix(prefix).valid) return;
    table[prefix] = iri;
    named.add(iri);
  };
  /*
   * The ontology's own prefix and namespace go together or not at all, so no other name can take
   * either. Where the document declared that pair it is written in the document's order, so a
   * file this app saved keeps its prefix lines exactly where they were.
   */
  const wanted = (prefix: string, iri: string) =>
    (prefix === ownPrefix) === (iri === namespace) && (used.has(iri) || iri === namespace);

  for (const [prefix, iri] of Object.entries(ontology.prefixes)) {
    if (wanted(prefix, iri)) claim(prefix, iri);
  }
  for (const [prefix, iri] of Object.entries(NAMESPACES)) {
    if (wanted(prefix, iri)) claim(prefix, iri);
  }
  // rdf: is implied by rdf:type but N3 only writes it when it appears; keep it explicit.
  if (!named.has(NAMESPACES.rdf)) claim('rdf', NAMESPACES.rdf);

  // Never refused: nothing else may hold this name or this namespace (see `wanted`).
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
