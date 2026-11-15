export type {
  Annotation,
  AnnotatableEntity,
  Attribute,
  ClassSide,
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
  CLASS_SIDES,
  DEFAULT_NAMESPACE_IRI,
  DEFAULT_PREFIX,
  isClassSide,
  attributeUsagesOfClass,
  classLocalNames,
  createAnnotation,
  createEmptyOntology,
  withVersionIri,
  hasVersionIri,
  initialVersionIri,
  VERSION_IRI_TERM,
  INITIAL_VERSION,
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
  headerIri,
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
  pinUsageEnd,
  setUsageEndpoints,
  updateAnnotation,
} from './mutations';

export { ontologyFromTriples } from './fromTriples';
export type { ImportReport, ImportResult } from './fromTriples';
export { decodeLayout, decodePosition, encodePosition } from './layout';
export type { Layout } from './layout';
export { ontologyToTriples, blank, blankLabel, iri, isBlankNode, literal } from './triples';
export type { Triple, TripleObject, SerializationOptions } from './triples';

export { cleanName, holderOfName, nameProblem } from './naming';
export type { NameHolder, NamedKind } from './naming';
