export type {
  Annotation,
  AnnotatableEntity,
  Attribute,
  EntityKind,
  EntityRef,
  Relation,
  Ontology,
  OntologyClass,
  Position,
  Project,
  PropertyUsage,
} from './types';

export {
  DEFAULT_NAMESPACE_IRI,
  DEFAULT_PREFIX,
  attributeUsagesOfClass,
  classLocalNames,
  createAnnotation,
  createEmptyOntology,
  createId,
  createProject,
  findClass,
  findAttribute,
  findRelation,
  indexOntology,
  isOntologyEmpty,
  propertyLocalNames,
  relationUsages,
  relationUsagesTouchingClass,
  usageCount,
  usagesOfProperty,
} from './ontology';
export type { OntologyIndex } from './ontology';

export {
  ABSOLUTE_IRI_VALUE,
  entityIri,
  localNameOf,
  namespaceOf,
  normalizeNamespaceIri,
  ontologyIri,
  sanitizeLocalName,
  toClassLocalName,
  toPropertyLocalName,
  uniqueLocalName,
  validateNamespaceIri,
  validatePrefix,
} from './identifier';
export type { ValidationResult } from './identifier';

export {
  canSubclass,
  canSubproperty,
  classForest,
  classWithDescendants,
  attributeList,
  relationForest,
  rootClasses,
  subClassEdges,
  taxonomyModules,
} from './taxonomy';
export type { TaxonomyNode } from './taxonomy';

export {
  addAnnotation,
  addAttributeToClass,
  addClass,
  addAttribute,
  addRelation,
  addRelationBetween,
  addSubClassOf,
  removeSubClassOf,
  attachProperty,
  deleteClass,
  deleteAttribute,
  deleteRelation,
  detachUsage,
  moveClass,
  placeClasses,
  removeAnnotation,
  renameClass,
  renameAttribute,
  renameRelation,
  setAttributeRange,
  setOntologyIri,
  setOntologyPrefix,
  setSuperClass,
  setSuperRelation,
  setUsageEndpoints,
  updateAnnotation,
} from './mutations';

export { ontologyFromTriples } from './fromTriples';
export type { ImportReport, ImportResult } from './fromTriples';
export { decodeLayout, encodeLayout } from './layout';
export type { Layout } from './layout';
export { ontologyToTriples, blank, blankLabel, iri, isBlankNode, literal } from './triples';
export type { Triple, TripleObject, SerializationOptions } from './triples';
