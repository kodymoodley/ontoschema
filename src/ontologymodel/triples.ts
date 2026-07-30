import {
  OWL_CLASS,
  OWL_DATATYPE_PROPERTY,
  OWL_OBJECT_PROPERTY,
  OWL_ONTOLOGY,
  RDFS_DOMAIN,
  RDFS_RANGE,
  RDFS_SUBCLASS_OF,
  RDFS_SUBPROPERTY_OF,
  RDF_TYPE,
  annotationTermIri,
  findAnnotationTerm,
  isValidLanguageTag,
  xsdDatatypeIri,
} from '../annotationvocabulary';
import { entityIri, normalizeNamespaceIri, ontologyIri } from './identifier';
import type { Annotation, Ontology } from './types';

/**
 * A minimal, serializer-agnostic RDF triple. This is the ONLY thing the serialization
 * layer consumes, which is what guarantees Turtle, RDF/XML and JSON-LD are semantically
 * identical: they are three renderings of one list.
 */
export type TripleObject =
  | { type: 'iri'; value: string }
  | { type: 'literal'; value: string; language?: string; datatype?: string };

export interface Triple {
  subject: string;
  predicate: string;
  object: TripleObject;
}

export const iri = (value: string): TripleObject => ({ type: 'iri', value });

export function literal(
  value: string,
  options: { language?: string; datatype?: string } = {},
): TripleObject {
  const node: TripleObject = { type: 'literal', value };
  // A literal may carry a language tag or a datatype, never both.
  if (options.language) node.language = options.language;
  else if (options.datatype) node.datatype = options.datatype;
  return node;
}

/**
 * An absolute IRI: a scheme followed by characters legal in an IRI. Anything containing a
 * space, quote or angle bracket is not an IRI and must be written as a literal instead —
 * emitting it as an IRI would produce a document no parser can read.
 */
const ABSOLUTE_IRI_VALUE = /^[A-Za-z][A-Za-z0-9+.-]*:[^\s<>"{}|\\^`]*$/;

/**
 * Renders one annotation. Terms declared `iri` produce an IRI object when the value really
 * is one; `date` produces an xsd:date literal; `text` may carry a language tag.
 * Blank values are skipped by the caller.
 */
function annotationTriple(subject: string, annotation: Annotation): Triple | null {
  const predicate = annotationTermIri(annotation.term);
  if (!predicate) return null;

  const value = annotation.value.trim();
  if (!value) return null;

  const term = findAnnotationTerm(annotation.term);
  const kind = term?.kind ?? 'text';

  if (kind === 'iri' && ABSOLUTE_IRI_VALUE.test(value)) {
    return { subject, predicate, object: iri(value) };
  }
  if (kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return {
      subject,
      predicate,
      object: literal(value, { datatype: 'http://www.w3.org/2001/XMLSchema#date' }),
    };
  }
  if (kind === 'text' && annotation.language && isValidLanguageTag(annotation.language)) {
    return { subject, predicate, object: literal(value, { language: annotation.language }) };
  }
  return { subject, predicate, object: literal(value) };
}

function annotationTriples(subject: string, annotations: readonly Annotation[]): Triple[] {
  return annotations
    .map((annotation) => annotationTriple(subject, annotation))
    .filter((triple): triple is Triple => triple !== null);
}

/**
 * Projects the whole ontology to triples.
 *
 * Emitted per entity: an rdf:type declaration, its annotations, its hierarchy links, and
 * — for scoped object properties and attached datatype properties — rdfs:domain/rdfs:range.
 * Nothing beyond TBox is produced; no restrictions, no individuals.
 */
export function ontologyToTriples(ontology: Ontology): Triple[] {
  const namespace = normalizeNamespaceIri(ontology.iri);
  const subjectOf = (localName: string) => entityIri(namespace, localName);
  const classIri = new Map(ontology.classes.map((e) => [e.id, subjectOf(e.localName)]));
  const objectPropertyIri = new Map(
    ontology.objectProperties.map((e) => [e.id, subjectOf(e.localName)]),
  );
  const datatypePropertyIri = new Map(
    ontology.datatypeProperties.map((e) => [e.id, subjectOf(e.localName)]),
  );

  const triples: Triple[] = [];

  const header = ontologyIri(namespace);
  triples.push({ subject: header, predicate: RDF_TYPE, object: iri(OWL_ONTOLOGY) });
  triples.push(...annotationTriples(header, ontology.annotations));

  for (const entity of ontology.classes) {
    const subject = classIri.get(entity.id);
    if (!subject) continue;
    triples.push({ subject, predicate: RDF_TYPE, object: iri(OWL_CLASS) });
    triples.push(...annotationTriples(subject, entity.annotations));
    for (const parentId of entity.superClassIds) {
      const parent = classIri.get(parentId);
      if (parent && parent !== subject) {
        triples.push({ subject, predicate: RDFS_SUBCLASS_OF, object: iri(parent) });
      }
    }
  }

  for (const property of ontology.objectProperties) {
    const subject = objectPropertyIri.get(property.id);
    if (!subject) continue;
    triples.push({ subject, predicate: RDF_TYPE, object: iri(OWL_OBJECT_PROPERTY) });
    triples.push(...annotationTriples(subject, property.annotations));
    for (const parentId of property.superPropertyIds) {
      const parent = objectPropertyIri.get(parentId);
      if (parent && parent !== subject) {
        triples.push({ subject, predicate: RDFS_SUBPROPERTY_OF, object: iri(parent) });
      }
    }
    // A generic property is deliberately left without domain/range so it stays reusable.
    if (property.kind !== 'scoped') continue;
    const domain = property.domainClassId ? classIri.get(property.domainClassId) : undefined;
    const range = property.rangeClassId ? classIri.get(property.rangeClassId) : undefined;
    if (domain) triples.push({ subject, predicate: RDFS_DOMAIN, object: iri(domain) });
    if (range) triples.push({ subject, predicate: RDFS_RANGE, object: iri(range) });
  }

  for (const property of ontology.datatypeProperties) {
    const subject = datatypePropertyIri.get(property.id);
    if (!subject) continue;
    triples.push({ subject, predicate: RDF_TYPE, object: iri(OWL_DATATYPE_PROPERTY) });
    triples.push(...annotationTriples(subject, property.annotations));
    for (const parentId of property.superPropertyIds) {
      const parent = datatypePropertyIri.get(parentId);
      if (parent && parent !== subject) {
        triples.push({ subject, predicate: RDFS_SUBPROPERTY_OF, object: iri(parent) });
      }
    }
    const domain = property.domainClassId ? classIri.get(property.domainClassId) : undefined;
    if (domain) triples.push({ subject, predicate: RDFS_DOMAIN, object: iri(domain) });
    triples.push({ subject, predicate: RDFS_RANGE, object: iri(xsdDatatypeIri(property.range)) });
  }

  return dedupe(triples);
}

/** Two identical assertions are one fact; duplicates would only bloat the output. */
function dedupe(triples: readonly Triple[]): Triple[] {
  const seen = new Set<string>();
  const unique: Triple[] = [];
  for (const triple of triples) {
    const key = `${triple.subject}|${triple.predicate}|${triple.object.type}|${triple.object.value}|${
      triple.object.type === 'literal' ? (triple.object.language ?? '') : ''
    }|${triple.object.type === 'literal' ? (triple.object.datatype ?? '') : ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(triple);
  }
  return unique;
}
