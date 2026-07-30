import type { XsdDatatype } from '../annotationvocabulary';

/** Canvas coordinates. Layout is part of the saved document, not of the RDF output. */
export interface Position {
  x: number;
  y: number;
}

/**
 * One annotation assertion on an entity or on the ontology header.
 * `term` is a CURIE from the annotation vocabulary, e.g. `skos:prefLabel`.
 * `language` only ever applies to terms whose kind is `text`.
 */
export interface Annotation {
  id: string;
  term: string;
  value: string;
  language?: string;
}

export interface OntologyClass {
  id: string;
  localName: string;
  superClassIds: string[];
  annotations: Annotation[];
  position: Position;
}

/**
 * A datatype property (an "attribute"). Its domain is a single class, so it renders as a
 * typed row inside that class's box. `domainClassId` is null while it is unattached.
 */
export interface DatatypeProperty {
  id: string;
  localName: string;
  domainClassId: string | null;
  range: XsdDatatype;
  superPropertyIds: string[];
  annotations: Annotation[];
  /** Only used while the property is unattached and floating on the canvas. */
  position: Position;
}

/**
 * `scoped`  — drawn as an edge between two classes; emits rdfs:domain and rdfs:range.
 * `generic` — a reusable property with no domain/range (hasPart, isRelatedTo, ...),
 *             dropped from the palette as a standalone node.
 */
export type ObjectPropertyKind = 'scoped' | 'generic';

export interface ObjectProperty {
  id: string;
  localName: string;
  kind: ObjectPropertyKind;
  domainClassId: string | null;
  rangeClassId: string | null;
  superPropertyIds: string[];
  annotations: Annotation[];
  position: Position;
}

export interface Ontology {
  /** Namespace IRI; entity IRIs are this concatenated with the local name. */
  iri: string;
  prefix: string;
  annotations: Annotation[];
  classes: OntologyClass[];
  objectProperties: ObjectProperty[];
  datatypeProperties: DatatypeProperty[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  ontology: Ontology;
}

/** Every kind of thing that can be selected and annotated. */
export type EntityKind = 'class' | 'objectProperty' | 'datatypeProperty' | 'ontology';

export interface EntityRef {
  kind: EntityKind;
  id: string;
}

export type AnnotatableEntity = OntologyClass | ObjectProperty | DatatypeProperty;
