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
 * Properties are a reusable pool. They carry no domain and no range, because where a
 * property may be used is a *local* fact about a class, not a global fact about the
 * property — see PropertyUsage.
 *
 * A attribute's xsd range is the exception: `price` is a decimal wherever it is
 * used, so the range lives on the property and is always safe to export as `rdfs:range`.
 */
export interface Attribute {
  id: string;
  localName: string;
  range: XsdDatatype;
  superPropertyIds: string[];
  annotations: Annotation[];
}

export interface Relation {
  id: string;
  localName: string;
  superPropertyIds: string[];
  annotations: Annotation[];
}

/**
 * A property being used on a class — the single most important concept in the model.
 *
 * `Car —offeredBy→ Dealership` is a *local* constraint: it says nothing about how
 * `offeredBy` behaves elsewhere. RDFS cannot express that. Repeating `rdfs:domain` means
 * intersection (every Car is also a Van), and a union domain loses the pairing entirely,
 * licensing `Car offeredBy Garage`. So a usage is exported as a SHACL property shape,
 * which is per-class and keeps each pairing intact.
 *
 * One usage maps 1:1 onto one `sh:PropertyShape`.
 *
 *   - attribute usage: `objectClassId` is null; the value type is the property's xsd range
 *   - relation usage:  `objectClassId` names the class the relation points at
 *
 * A property with no usages is simply unused: it is declared in the ontology and listed in
 * the property pool, but there is nothing to draw for it on the canvas.
 */
export interface PropertyUsage {
  id: string;
  propertyId: string;
  subjectClassId: string;
  objectClassId: string | null;
}

export interface Ontology {
  /** Namespace IRI; entity IRIs are this concatenated with the local name. */
  iri: string;
  prefix: string;
  annotations: Annotation[];
  classes: OntologyClass[];
  relations: Relation[];
  attributes: Attribute[];
  usages: PropertyUsage[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  ontology: Ontology;
}

/** Every kind of thing that can be selected and annotated. */
export type EntityKind = 'class' | 'relation' | 'attribute' | 'ontology';

export interface EntityRef {
  kind: EntityKind;
  id: string;
}

export type AnnotatableEntity = OntologyClass | Relation | Attribute;

/** A usage resolved against the entities it refers to, for rendering and serialization. */
export interface ResolvedUsage {
  usage: PropertyUsage;
  subjectClass: OntologyClass;
  objectClass: OntologyClass | null;
  relation: Relation | null;
  attribute: Attribute | null;
}
