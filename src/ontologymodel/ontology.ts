import type {
  Annotation,
  DatatypeProperty,
  ObjectProperty,
  Ontology,
  OntologyClass,
  Project,
  PropertyUsage,
  ResolvedUsage,
} from './types';
import { normalizeNamespaceIri } from './identifier';

export const DEFAULT_NAMESPACE_IRI = 'https://example.org/ontology/';
export const DEFAULT_PREFIX = 'ex';

/**
 * Ids are opaque and internal — entity identity survives renaming, which is what lets a
 * class keep its usages when its local name changes.
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
    usages: [],
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

/* ------------------------------------------------------------------ lookup */

export function findClass(ontology: Ontology, id: string): OntologyClass | undefined {
  return ontology.classes.find((entity) => entity.id === id);
}

export function findObjectProperty(ontology: Ontology, id: string): ObjectProperty | undefined {
  return ontology.objectProperties.find((entity) => entity.id === id);
}

export function findDatatypeProperty(ontology: Ontology, id: string): DatatypeProperty | undefined {
  return ontology.datatypeProperties.find((entity) => entity.id === id);
}

export function findUsage(ontology: Ontology, id: string): PropertyUsage | undefined {
  return ontology.usages.find((usage) => usage.id === id);
}

/**
 * Indexes built once per derivation. Callers that touch every class or usage should take
 * these rather than calling `find` inside a loop, which is quadratic on large ontologies.
 */
export interface OntologyIndex {
  classById: Map<string, OntologyClass>;
  objectPropertyById: Map<string, ObjectProperty>;
  datatypePropertyById: Map<string, DatatypeProperty>;
  attributeUsagesByClass: Map<string, PropertyUsage[]>;
  relationUsagesByClass: Map<string, PropertyUsage[]>;
  usagesByProperty: Map<string, PropertyUsage[]>;
}

export function indexOntology(ontology: Ontology): OntologyIndex {
  const classById = new Map(ontology.classes.map((entity) => [entity.id, entity]));
  const objectPropertyById = new Map(ontology.objectProperties.map((e) => [e.id, e]));
  const datatypePropertyById = new Map(ontology.datatypeProperties.map((e) => [e.id, e]));

  const attributeUsagesByClass = new Map<string, PropertyUsage[]>();
  const relationUsagesByClass = new Map<string, PropertyUsage[]>();
  const usagesByProperty = new Map<string, PropertyUsage[]>();

  const push = (map: Map<string, PropertyUsage[]>, key: string, usage: PropertyUsage) => {
    const existing = map.get(key);
    if (existing) existing.push(usage);
    else map.set(key, [usage]);
  };

  for (const usage of ontology.usages) {
    if (!classById.has(usage.subjectClassId)) continue;
    push(usagesByProperty, usage.propertyId, usage);
    if (datatypePropertyById.has(usage.propertyId)) {
      push(attributeUsagesByClass, usage.subjectClassId, usage);
    } else if (objectPropertyById.has(usage.propertyId)) {
      push(relationUsagesByClass, usage.subjectClassId, usage);
    }
  }

  return {
    classById,
    objectPropertyById,
    datatypePropertyById,
    attributeUsagesByClass,
    relationUsagesByClass,
    usagesByProperty,
  };
}

/* ------------------------------------------------------------------ usages */

/** Attribute usages on a class, i.e. the typed rows shown inside its box. */
export function attributeUsagesOfClass(ontology: Ontology, classId: string): PropertyUsage[] {
  const datatypeIds = new Set(ontology.datatypeProperties.map((entity) => entity.id));
  return ontology.usages.filter(
    (usage) => usage.subjectClassId === classId && datatypeIds.has(usage.propertyId),
  );
}

/** Relation usages leaving a class, i.e. the edges drawn from it. */
export function relationUsagesOfClass(ontology: Ontology, classId: string): PropertyUsage[] {
  const objectIds = new Set(ontology.objectProperties.map((entity) => entity.id));
  return ontology.usages.filter(
    (usage) => usage.subjectClassId === classId && objectIds.has(usage.propertyId),
  );
}

/** Every relation usage in the ontology whose endpoints both still exist. */
export function relationUsages(ontology: Ontology): PropertyUsage[] {
  const classIds = new Set(ontology.classes.map((entity) => entity.id));
  const objectIds = new Set(ontology.objectProperties.map((entity) => entity.id));
  return ontology.usages.filter(
    (usage) =>
      objectIds.has(usage.propertyId) &&
      classIds.has(usage.subjectClassId) &&
      usage.objectClassId !== null &&
      classIds.has(usage.objectClassId),
  );
}

export function usagesOfProperty(ontology: Ontology, propertyId: string): PropertyUsage[] {
  return ontology.usages.filter((usage) => usage.propertyId === propertyId);
}

/** How many classes a property is used on. 0 = unused, 1 = unambiguous, 2+ = reused. */
export function usageCount(ontology: Ontology, propertyId: string): number {
  return usagesOfProperty(ontology, propertyId).length;
}

/**
 * A property used exactly once has an unambiguous domain (and range), so RDFS can state it
 * truthfully. Once reused, only the SHACL shapes can express it without lying.
 */
export function hasUnambiguousDomain(ontology: Ontology, propertyId: string): boolean {
  return usageCount(ontology, propertyId) === 1;
}

/** Classes that touch a relation usage in either direction. */
export function relationUsagesTouchingClass(ontology: Ontology, classId: string): PropertyUsage[] {
  const objectIds = new Set(ontology.objectProperties.map((entity) => entity.id));
  return ontology.usages.filter(
    (usage) =>
      objectIds.has(usage.propertyId) &&
      (usage.subjectClassId === classId || usage.objectClassId === classId),
  );
}

export function resolveUsage(ontology: Ontology, usage: PropertyUsage): ResolvedUsage | null {
  const subjectClass = findClass(ontology, usage.subjectClassId);
  if (!subjectClass) return null;
  return {
    usage,
    subjectClass,
    objectClass: usage.objectClassId ? (findClass(ontology, usage.objectClassId) ?? null) : null,
    objectProperty: findObjectProperty(ontology, usage.propertyId) ?? null,
    datatypeProperty: findDatatypeProperty(ontology, usage.propertyId) ?? null,
  };
}

/* ------------------------------------------------------------------- names */

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
