import type {
  Annotation,
  DatatypeProperty,
  ObjectProperty,
  Ontology,
  OntologyClass,
  Project,
} from './types';
import { normalizeNamespaceIri } from './identifier';

export const DEFAULT_NAMESPACE_IRI = 'https://example.org/ontology/';
export const DEFAULT_PREFIX = 'ex';

/**
 * Ids are opaque and internal — entity identity survives renaming, which is what lets a
 * class keep its relations when its local name changes.
 */
export function createId(prefix: string): string {
  const random =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}

export function createEmptyOntology(
  iri: string = DEFAULT_NAMESPACE_IRI,
  prefix: string = DEFAULT_PREFIX,
): Ontology {
  return {
    iri: normalizeNamespaceIri(iri),
    prefix,
    annotations: [],
    classes: [],
    objectProperties: [],
    datatypeProperties: [],
  };
}

export function createProject(name: string, ontology: Ontology = createEmptyOntology()): Project {
  const now = new Date().toISOString();
  return { id: createId('project'), name, createdAt: now, updatedAt: now, ontology };
}

export function createAnnotation(term: string, value = '', language?: string): Annotation {
  const annotation: Annotation = { id: createId('ann'), term, value };
  if (language) annotation.language = language;
  return annotation;
}

export function findClass(ontology: Ontology, id: string): OntologyClass | undefined {
  return ontology.classes.find((entity) => entity.id === id);
}

export function findObjectProperty(ontology: Ontology, id: string): ObjectProperty | undefined {
  return ontology.objectProperties.find((entity) => entity.id === id);
}

export function findDatatypeProperty(ontology: Ontology, id: string): DatatypeProperty | undefined {
  return ontology.datatypeProperties.find((entity) => entity.id === id);
}

/** Datatype properties whose domain is the given class, i.e. the rows shown in its box. */
export function attributesOfClass(ontology: Ontology, classId: string): DatatypeProperty[] {
  return ontology.datatypeProperties.filter((property) => property.domainClassId === classId);
}

/** Scoped object properties that touch the given class in either direction. */
export function relationsTouchingClass(ontology: Ontology, classId: string): ObjectProperty[] {
  return ontology.objectProperties.filter(
    (property) =>
      property.kind === 'scoped' &&
      (property.domainClassId === classId || property.rangeClassId === classId),
  );
}

/** Scoped relations that are fully connected, and so serialise domain and range. */
export function connectedRelations(ontology: Ontology): ObjectProperty[] {
  return ontology.objectProperties.filter(
    (property) =>
      property.kind === 'scoped' &&
      property.domainClassId !== null &&
      property.rangeClassId !== null,
  );
}

export function allLocalNames(ontology: Ontology): string[] {
  return [
    ...ontology.classes.map((entity) => entity.localName),
    ...ontology.objectProperties.map((entity) => entity.localName),
    ...ontology.datatypeProperties.map((entity) => entity.localName),
  ];
}

export function classLocalNames(ontology: Ontology): string[] {
  return ontology.classes.map((entity) => entity.localName);
}

export function propertyLocalNames(ontology: Ontology): string[] {
  return [
    ...ontology.objectProperties.map((entity) => entity.localName),
    ...ontology.datatypeProperties.map((entity) => entity.localName),
  ];
}

export function isOntologyEmpty(ontology: Ontology): boolean {
  return (
    ontology.classes.length === 0 &&
    ontology.objectProperties.length === 0 &&
    ontology.datatypeProperties.length === 0
  );
}
