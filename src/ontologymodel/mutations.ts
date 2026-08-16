import { DEFAULT_XSD_DATATYPE, normalizeLanguageTag } from '../annotationvocabulary';
import type { XsdDatatype } from '../annotationvocabulary';
import { createAnnotation, createId, classLocalNames, propertyLocalNames } from './ontology';
import {
  normalizeNamespaceIri,
  toClassLocalName,
  toPropertyLocalName,
  uniqueLocalName,
} from './identifier';
import { canSubclass, canSubproperty } from './taxonomy';
import type {
  Annotation,
  Attribute,
  Relation,
  Ontology,
  OntologyClass,
  Position,
  PropertyUsage,
} from './types';

/**
 * Every mutation is a pure `(ontology, args) => ontology` function. No mutation reaches
 * outside this module, which is what makes the whole model testable without a UI and
 * lets the store implement undo by keeping snapshots.
 */

type Updater<T> = (entity: T) => T;

function mapById<T extends { id: string }>(items: T[], id: string, update: Updater<T>): T[] {
  return items.map((item) => (item.id === id ? update(item) : item));
}

/* ------------------------------------------------------------------ classes */

export function addClass(
  ontology: Ontology,
  options: { localName?: string; position?: Position; superClassIds?: string[] } = {},
): { ontology: Ontology; id: string } {
  const desired = toClassLocalName(options.localName ?? 'NewClass') || 'NewClass';
  const entity: OntologyClass = {
    id: createId('class'),
    localName: uniqueLocalName(desired, classLocalNames(ontology)),
    superClassIds: options.superClassIds ?? [],
    annotations: [],
    position: options.position ?? { x: 0, y: 0 },
  };
  return { ontology: { ...ontology, classes: [...ontology.classes, entity] }, id: entity.id };
}

export function renameClass(ontology: Ontology, id: string, localName: string): Ontology {
  const cleaned = toClassLocalName(localName);
  if (!cleaned) return ontology;
  const taken = ontology.classes.filter((e) => e.id !== id).map((e) => e.localName);
  const unique = uniqueLocalName(cleaned, taken);
  return {
    ...ontology,
    classes: mapById(ontology.classes, id, (e) => ({ ...e, localName: unique })),
  };
}

export function moveClass(ontology: Ontology, id: string, position: Position): Ontology {
  return { ...ontology, classes: mapById(ontology.classes, id, (e) => ({ ...e, position })) };
}

/**
 * Deleting a class cascades to its usages: every attribute row it carried and every
 * relation pointing at or away from it goes with it. The properties themselves survive in
 * the pool, because they were never owned by the class.
 */
export function deleteClass(ontology: Ontology, id: string): Ontology {
  return {
    ...ontology,
    classes: ontology.classes
      .filter((entity) => entity.id !== id)
      .map((entity) => ({
        ...entity,
        superClassIds: entity.superClassIds.filter((parentId) => parentId !== id),
      })),
    usages: ontology.usages.filter(
      (usage) => usage.subjectClassId !== id && usage.objectClassId !== id,
    ),
  };
}

export function addSubClassOf(ontology: Ontology, childId: string, parentId: string): Ontology {
  if (!canSubclass(ontology, childId, parentId)) return ontology;
  return {
    ...ontology,
    classes: mapById(ontology.classes, childId, (entity) =>
      entity.superClassIds.includes(parentId)
        ? entity
        : { ...entity, superClassIds: [...entity.superClassIds, parentId] },
    ),
  };
}

/** Re-parenting in the tree panel: replaces all parents with the single new one (or none). */
export function setSuperClass(
  ontology: Ontology,
  childId: string,
  parentId: string | null,
): Ontology {
  if (parentId !== null && !canSubclass(ontology, childId, parentId)) return ontology;
  return {
    ...ontology,
    classes: mapById(ontology.classes, childId, (entity) => ({
      ...entity,
      superClassIds: parentId === null ? [] : [parentId],
    })),
  };
}

/* -------------------------------------------------- datatype properties */

export function addAttribute(
  ontology: Ontology,
  options: { localName?: string; range?: XsdDatatype } = {},
): { ontology: Ontology; id: string } {
  const desired = toPropertyLocalName(options.localName ?? 'newAttribute') || 'newAttribute';
  const property: Attribute = {
    id: createId('dtp'),
    localName: uniqueLocalName(desired, propertyLocalNames(ontology)),
    range: options.range ?? DEFAULT_XSD_DATATYPE,
    superPropertyIds: [],
    annotations: [],
  };
  return {
    ontology: { ...ontology, attributes: [...ontology.attributes, property] },
    id: property.id,
  };
}

export function renameAttribute(ontology: Ontology, id: string, localName: string): Ontology {
  const cleaned = toPropertyLocalName(localName);
  if (!cleaned) return ontology;
  const taken = [
    ...ontology.relations.map((e) => e.localName),
    ...ontology.attributes.filter((e) => e.id !== id).map((e) => e.localName),
  ];
  const unique = uniqueLocalName(cleaned, taken);
  return {
    ...ontology,
    attributes: mapById(ontology.attributes, id, (e) => ({
      ...e,
      localName: unique,
    })),
  };
}

export function setAttributeRange(ontology: Ontology, id: string, range: XsdDatatype): Ontology {
  return {
    ...ontology,
    attributes: mapById(ontology.attributes, id, (e) => ({ ...e, range })),
  };
}

export function deleteAttribute(ontology: Ontology, id: string): Ontology {
  return {
    ...ontology,
    attributes: ontology.attributes
      .filter((property) => property.id !== id)
      .map((property) => ({
        ...property,
        superPropertyIds: property.superPropertyIds.filter((parentId) => parentId !== id),
      })),
    usages: ontology.usages.filter((usage) => usage.propertyId !== id),
  };
}

/* ---------------------------------------------------- object properties */

export function addRelation(
  ontology: Ontology,
  options: { localName?: string } = {},
): { ontology: Ontology; id: string } {
  const desired = toPropertyLocalName(options.localName ?? 'isRelatedTo') || 'isRelatedTo';
  const property: Relation = {
    id: createId('obp'),
    localName: uniqueLocalName(desired, propertyLocalNames(ontology)),
    superPropertyIds: [],
    annotations: [],
  };
  return {
    ontology: { ...ontology, relations: [...ontology.relations, property] },
    id: property.id,
  };
}

export function renameRelation(ontology: Ontology, id: string, localName: string): Ontology {
  const cleaned = toPropertyLocalName(localName);
  if (!cleaned) return ontology;
  const taken = [
    ...ontology.relations.filter((e) => e.id !== id).map((e) => e.localName),
    ...ontology.attributes.map((e) => e.localName),
  ];
  const unique = uniqueLocalName(cleaned, taken);
  return {
    ...ontology,
    relations: mapById(ontology.relations, id, (e) => ({ ...e, localName: unique })),
  };
}

export function deleteRelation(ontology: Ontology, id: string): Ontology {
  return {
    ...ontology,
    relations: ontology.relations
      .filter((property) => property.id !== id)
      .map((property) => ({
        ...property,
        superPropertyIds: property.superPropertyIds.filter((parentId) => parentId !== id),
      })),
    usages: ontology.usages.filter((usage) => usage.propertyId !== id),
  };
}

export function setSuperRelation(
  ontology: Ontology,
  childId: string,
  parentId: string | null,
): Ontology {
  if (parentId !== null && !canSubproperty(ontology, childId, parentId)) return ontology;
  return {
    ...ontology,
    relations: mapById(ontology.relations, childId, (entity) => ({
      ...entity,
      superPropertyIds: parentId === null ? [] : [parentId],
    })),
  };
}

/* ------------------------------------------------------------------ usages */

function propertyExists(ontology: Ontology, propertyId: string): boolean {
  return (
    ontology.attributes.some((entity) => entity.id === propertyId) ||
    ontology.relations.some((entity) => entity.id === propertyId)
  );
}

/**
 * Attaches a property to a class. Attaching the same property to the same class with the
 * same target twice is a no-op — that would be one fact stated twice, and would emit two
 * conflicting SHACL property shapes.
 */
export function attachProperty(
  ontology: Ontology,
  options: { propertyId: string; subjectClassId: string; objectClassId?: string | null },
): { ontology: Ontology; id: string } {
  const objectClassId = options.objectClassId ?? null;
  if (
    !propertyExists(ontology, options.propertyId) ||
    !ontology.classes.some((entity) => entity.id === options.subjectClassId) ||
    (objectClassId !== null && !ontology.classes.some((entity) => entity.id === objectClassId))
  ) {
    return { ontology, id: '' };
  }

  const existing = ontology.usages.find(
    (usage) =>
      usage.propertyId === options.propertyId &&
      usage.subjectClassId === options.subjectClassId &&
      usage.objectClassId === objectClassId,
  );
  if (existing) return { ontology, id: existing.id };

  const usage: PropertyUsage = {
    id: createId('use'),
    propertyId: options.propertyId,
    subjectClassId: options.subjectClassId,
    objectClassId,
  };
  return { ontology: { ...ontology, usages: [...ontology.usages, usage] }, id: usage.id };
}

/** Removes a single usage. The property stays in the pool, ready to be used elsewhere. */
export function detachUsage(ontology: Ontology, usageId: string): Ontology {
  return { ...ontology, usages: ontology.usages.filter((usage) => usage.id !== usageId) };
}

/** Re-points one end of a relation usage. */
export function setUsageEndpoints(
  ontology: Ontology,
  usageId: string,
  endpoints: { subjectClassId?: string; objectClassId?: string | null },
): Ontology {
  return {
    ...ontology,
    usages: mapById(ontology.usages, usageId, (usage) => ({
      ...usage,
      subjectClassId: endpoints.subjectClassId ?? usage.subjectClassId,
      objectClassId:
        endpoints.objectClassId !== undefined ? endpoints.objectClassId : usage.objectClassId,
    })),
  };
}

/**
 * Creates a datatype property and attaches it to a class in one step — the common path,
 * since a datatype property can never exist unattached in the editor.
 */
export function addAttributeToClass(
  ontology: Ontology,
  options: { classId: string; localName?: string; range?: XsdDatatype },
): { ontology: Ontology; propertyId: string; usageId: string } {
  const created = addAttribute(ontology, {
    ...(options.localName !== undefined ? { localName: options.localName } : {}),
    ...(options.range !== undefined ? { range: options.range } : {}),
  });
  const attached = attachProperty(created.ontology, {
    propertyId: created.id,
    subjectClassId: options.classId,
  });
  return { ontology: attached.ontology, propertyId: created.id, usageId: attached.id };
}

/**
 * Creates an object property and uses it between two classes — what the connection picker
 * calls when the user chooses "new property" rather than an existing one.
 */
export function addRelationBetween(
  ontology: Ontology,
  options: { localName?: string; subjectClassId: string; objectClassId: string },
): { ontology: Ontology; propertyId: string; usageId: string } {
  const created = addRelation(
    ontology,
    options.localName !== undefined ? { localName: options.localName } : {},
  );
  const attached = attachProperty(created.ontology, {
    propertyId: created.id,
    subjectClassId: options.subjectClassId,
    objectClassId: options.objectClassId,
  });
  return { ontology: attached.ontology, propertyId: created.id, usageId: attached.id };
}

/* ------------------------------------------------------------ annotations */

type AnnotationOwner = 'class' | 'relation' | 'attribute' | 'ontology';

function updateAnnotations(
  ontology: Ontology,
  owner: AnnotationOwner,
  ownerId: string,
  update: Updater<Annotation[]>,
): Ontology {
  switch (owner) {
    case 'ontology':
      return { ...ontology, annotations: update(ontology.annotations) };
    case 'class':
      return {
        ...ontology,
        classes: mapById(ontology.classes, ownerId, (e) => ({
          ...e,
          annotations: update(e.annotations),
        })),
      };
    case 'relation':
      return {
        ...ontology,
        relations: mapById(ontology.relations, ownerId, (e) => ({
          ...e,
          annotations: update(e.annotations),
        })),
      };
    case 'attribute':
      return {
        ...ontology,
        attributes: mapById(ontology.attributes, ownerId, (e) => ({
          ...e,
          annotations: update(e.annotations),
        })),
      };
  }
}

export function addAnnotation(
  ontology: Ontology,
  owner: AnnotationOwner,
  ownerId: string,
  term: string,
  value = '',
  language?: string,
): Ontology {
  const annotation = createAnnotation(term, value, language);
  return updateAnnotations(ontology, owner, ownerId, (list) => [...list, annotation]);
}

export function updateAnnotation(
  ontology: Ontology,
  owner: AnnotationOwner,
  ownerId: string,
  annotationId: string,
  patch: Partial<Pick<Annotation, 'term' | 'value' | 'language'>>,
): Ontology {
  return updateAnnotations(ontology, owner, ownerId, (list) =>
    list.map((annotation) => {
      if (annotation.id !== annotationId) return annotation;
      const next: Annotation = { ...annotation, ...patch };
      if (patch.language !== undefined) {
        const normalized = normalizeLanguageTag(patch.language);
        if (normalized) next.language = normalized;
        else delete next.language;
      }
      return next;
    }),
  );
}

export function removeAnnotation(
  ontology: Ontology,
  owner: AnnotationOwner,
  ownerId: string,
  annotationId: string,
): Ontology {
  return updateAnnotations(ontology, owner, ownerId, (list) =>
    list.filter((annotation) => annotation.id !== annotationId),
  );
}

/* -------------------------------------------------------- ontology header */

export function setOntologyIri(ontology: Ontology, iri: string): Ontology {
  return { ...ontology, iri: normalizeNamespaceIri(iri) };
}

export function setOntologyPrefix(ontology: Ontology, prefix: string): Ontology {
  return { ...ontology, prefix: prefix.trim() };
}
