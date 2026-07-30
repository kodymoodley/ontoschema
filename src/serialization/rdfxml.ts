import { RDF_TYPE } from '../annotationvocabulary';
import { ontologyToTriples } from '../ontologymodel';
import type { Ontology, Triple } from '../ontologymodel';
import { localNameOf, namespaceOf, prefixesFor } from './prefixes';
import type { PrefixTable } from './prefixes';

/**
 * RDF/XML writer.
 *
 * Written by hand because the RDF-JS ecosystem has no maintained standalone RDF/XML
 * serializer. The scope here is narrow and fully under our control — no blank nodes, no
 * collections, no reification — so a direct writer is both smaller and easier to verify
 * than pulling in a general-purpose serialization stack. Correctness is enforced by
 * parsing the output back with a real parser in the test suite.
 */

const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

export function serializeRdfXml(ontology: Ontology): string {
  const triples = ontologyToTriples(ontology);
  const prefixes = { ...prefixesFor(ontology, triples) };
  ensurePrefixesForPredicates(triples, prefixes);

  const bySubject = groupBySubject(triples);
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];

  const declarations = Object.entries(prefixes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([prefix, iri]) => `         xmlns:${prefix}="${escapeAttribute(iri)}"`);
  lines.push(['<rdf:RDF', ...declarations].join('\n') + '>');

  for (const [subject, subjectTriples] of bySubject) {
    lines.push('', ...describeSubject(subject, subjectTriples, prefixes));
  }

  lines.push('', '</rdf:RDF>', '');
  return lines.join('\n');
}

/**
 * Every predicate becomes an XML element name, so each predicate namespace needs a prefix.
 * Anything not already covered gets a generated one.
 */
function ensurePrefixesForPredicates(triples: readonly Triple[], prefixes: PrefixTable): void {
  const declared = new Set(Object.values(prefixes));
  let counter = 0;
  for (const triple of triples) {
    const namespace = namespaceOf(triple.predicate);
    if (declared.has(namespace)) continue;
    let candidate = `ns${counter}`;
    while (prefixes[candidate]) {
      counter += 1;
      candidate = `ns${counter}`;
    }
    prefixes[candidate] = namespace;
    declared.add(namespace);
  }
}

function groupBySubject(triples: readonly Triple[]): Map<string, Triple[]> {
  const grouped = new Map<string, Triple[]>();
  for (const triple of triples) {
    const existing = grouped.get(triple.subject);
    if (existing) existing.push(triple);
    else grouped.set(triple.subject, [triple]);
  }
  return grouped;
}

function describeSubject(
  subject: string,
  triples: readonly Triple[],
  prefixes: PrefixTable,
): string[] {
  // Prefer a typed node element (`<owl:Class rdf:about="...">`) — the shape Protégé writes —
  // falling back to rdf:Description when the type has no usable QName.
  const typeTriple = triples.find(
    (triple) => triple.predicate === RDF_TYPE && triple.object.type === 'iri',
  );
  const typeQName =
    typeTriple && typeTriple.object.type === 'iri'
      ? qname(typeTriple.object.value, prefixes)
      : null;

  const elementName = typeQName ?? 'rdf:Description';
  const body = triples.filter((triple) => triple !== typeTriple || typeQName === null);

  const lines = [`  <${elementName} rdf:about="${escapeAttribute(subject)}">`];
  for (const triple of body) lines.push(...propertyElement(triple, prefixes));
  lines.push(`  </${elementName}>`);
  return lines;
}

function propertyElement(triple: Triple, prefixes: PrefixTable): string[] {
  const name = qname(triple.predicate, prefixes);
  if (!name) return [];

  if (triple.object.type === 'iri') {
    return [`    <${name} rdf:resource="${escapeAttribute(triple.object.value)}"/>`];
  }

  const attributes = triple.object.language
    ? ` xml:lang="${escapeAttribute(triple.object.language)}"`
    : triple.object.datatype
      ? ` rdf:datatype="${escapeAttribute(triple.object.datatype)}"`
      : '';
  return [`    <${name}${attributes}>${escapeText(triple.object.value)}</${name}>`];
}

/** Renders an IRI as an XML QName using the declared prefixes, or null if impossible. */
function qname(iri: string, prefixes: PrefixTable): string | null {
  const namespace = namespaceOf(iri);
  const local = localNameOf(iri);
  if (!local || !isNcName(local)) return null;
  if (namespace === RDF_NS) return `rdf:${local}`;
  for (const [prefix, value] of Object.entries(prefixes)) {
    if (value === namespace) return `${prefix}:${local}`;
  }
  return null;
}

const NCNAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

function isNcName(value: string): boolean {
  return NCNAME.test(value);
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}
