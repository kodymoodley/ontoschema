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
  DatatypeProperty,
  ObjectProperty,
  ObjectPropertyKind,
  Ontology,
  OntologyClass,
  Position,
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
 * Deleting a class cascades: its attributes go with it, and any scoped relation that
 * touched it is removed rather than left dangling with a half-defined domain or range.
 * Generic properties survive untouched because they never referenced the class.
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
    datatypeProperties: ontology.datatypeProperties.filter(
      (property) => property.domainClassId !== id,
    ),
    objectProperties: ontology.objectProperties.filter(
      (property) =>
        !(
          property.kind === 'scoped' &&
          (property.domainClassId === id || property.rangeClassId === id)
        ),
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

export function removeSubClassOf(ontology: Ontology, childId: string, parentId: string): Ontology {
  return {
    ...ontology,
    classes: mapById(ontology.classes, childId, (entity) => ({
      ...entity,
      superClassIds: entity.superClassIds.filter((id) => id !== parentId),
    })),
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

export function addDatatypeProperty(
  ontology: Ontology,
  options: {
    localName?: string;
    domainClassId?: string | null;
    range?: XsdDatatype;
    position?: Position;
  } = {},
): { ontology: Ontology; id: string } {
  const desired = toPropertyLocalName(options.localName ?? 'newAttribute') || 'newAttribute';
  const property: DatatypeProperty = {
    id: createId('dtp'),
    localName: uniqueLocalName(desired, propertyLocalNames(ontology)),
    domainClassId: options.domainClassId ?? null,
    range: options.range ?? DEFAULT_XSD_DATATYPE,
    superPropertyIds: [],
    annotations: [],
    position: options.position ?? { x: 0, y: 0 },
  };
  return {
    ontology: { ...ontology, datatypeProperties: [...ontology.datatypeProperties, property] },
    id: property.id,
  };
}

export function renameDatatypeProperty(
  ontology: Ontology,
  id: string,
  localName: string,
): Ontology {
  const cleaned = toPropertyLocalName(localName);
  if (!cleaned) return ontology;
  const taken = [
    ...ontology.objectProperties.map((e) => e.localName),
    ...ontology.datatypeProperties.filter((e) => e.id !== id).map((e) => e.localName),
  ];
  const unique = uniqueLocalName(cleaned, taken);
  return {
    ...ontology,
    datatypeProperties: mapById(ontology.datatypeProperties, id, (e) => ({
      ...e,
      localName: unique,
    })),
  };
}

export function setDatatypePropertyRange(
  ontology: Ontology,
  id: string,
  range: XsdDatatype,
): Ontology {
  return {
    ...ontology,
    datatypeProperties: mapById(ontology.datatypeProperties, id, (e) => ({ ...e, range })),
  };
}

export function setDatatypePropertyDomain(
  ontology: Ontology,
  id: string,
  domainClassId: string | null,
): Ontology {
  return {
    ...ontology,
    datatypeProperties: mapById(ontology.datatypeProperties, id, (e) => ({ ...e, domainClassId })),
  };
}

export function moveDatatypeProperty(ontology: Ontology, id: string, position: Position): Ontology {
  return {
    ...ontology,
    datatypeProperties: mapById(ontology.datatypeProperties, id, (e) => ({ ...e, position })),
  };
}

export function deleteDatatypeProperty(ontology: Ontology, id: string): Ontology {
  return {
    ...ontology,
    datatypeProperties: ontology.datatypeProperties
      .filter((property) => property.id !== id)
      .map((property) => ({
        ...property,
        superPropertyIds: property.superPropertyIds.filter((parentId) => parentId !== id),
      })),
  };
}

/* ---------------------------------------------------- object properties */

export function addObjectProperty(
  ontology: Ontology,
  options: {
    localName?: string;
    kind?: ObjectPropertyKind;
    domainClassId?: string | null;
    rangeClassId?: string | null;
    position?: Position;
  } = {},
): { ontology: Ontology; id: string } {
  const kind = options.kind ?? 'scoped';
  const fallback = kind === 'generic' ? 'isRelatedTo' : 'relatesTo';
  const desired = toPropertyLocalName(options.localName ?? fallback) || fallback;
  const property: ObjectProperty = {
    id: createId('obp'),
    localName: uniqueLocalName(desired, propertyLocalNames(ontology)),
    kind,
    domainClassId: kind === 'generic' ? null : (options.domainClassId ?? null),
    rangeClassId: kind === 'generic' ? null : (options.rangeClassId ?? null),
    superPropertyIds: [],
    annotations: [],
    position: options.position ?? { x: 0, y: 0 },
  };
  return {
    ontology: { ...ontology, objectProperties: [...ontology.objectProperties, property] },
    id: property.id,
  };
}

export function renameObjectProperty(ontology: Ontology, id: string, localName: string): Ontology {
  const cleaned = toPropertyLocalName(localName);
  if (!cleaned) return ontology;
  const taken = [
    ...ontology.objectProperties.filter((e) => e.id !== id).map((e) => e.localName),
    ...ontology.datatypeProperties.map((e) => e.localName),
  ];
  const unique = uniqueLocalName(cleaned, taken);
  return {
    ...ontology,
    objectProperties: mapById(ontology.objectProperties, id, (e) => ({ ...e, localName: unique })),
  };
}

export function setObjectPropertyEndpoints(
  ontology: Ontology,
  id: string,
  endpoints: { domainClassId?: string | null; rangeClassId?: string | null },
): Ontology {
  return {
    ...ontology,
    objectProperties: mapById(ontology.objectProperties, id, (entity) => ({
      ...entity,
      domainClassId:
        endpoints.domainClassId !== undefined ? endpoints.domainClassId : entity.domainClassId,
      rangeClassId:
        endpoints.rangeClassId !== undefined ? endpoints.rangeClassId : entity.rangeClassId,
    })),
  };
}

export function moveObjectProperty(ontology: Ontology, id: string, position: Position): Ontology {
  return {
    ...ontology,
    objectProperties: mapById(ontology.objectProperties, id, (e) => ({ ...e, position })),
  };
}

export function deleteObjectProperty(ontology: Ontology, id: string): Ontology {
  return {
    ...ontology,
    objectProperties: ontology.objectProperties
      .filter((property) => property.id !== id)
      .map((property) => ({
        ...property,
        superPropertyIds: property.superPropertyIds.filter((parentId) => parentId !== id),
      })),
  };
}

export function setSuperObjectProperty(
  ontology: Ontology,
  childId: string,
  parentId: string | null,
): Ontology {
  if (parentId !== null && !canSubproperty(ontology, childId, parentId)) return ontology;
  return {
    ...ontology,
    objectProperties: mapById(ontology.objectProperties, childId, (entity) => ({
      ...entity,
      superPropertyIds: parentId === null ? [] : [parentId],
    })),
  };
}

/* ------------------------------------------------------------ annotations */

type AnnotationOwner = 'class' | 'objectProperty' | 'datatypeProperty' | 'ontology';

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
    case 'objectProperty':
      return {
        ...ontology,
        objectProperties: mapById(ontology.objectProperties, ownerId, (e) => ({
          ...e,
          annotations: update(e.annotations),
        })),
      };
    case 'datatypeProperty':
      return {
        ...ontology,
        datatypeProperties: mapById(ontology.datatypeProperties, ownerId, (e) => ({
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
