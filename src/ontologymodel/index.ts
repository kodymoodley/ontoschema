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
  ResolvedUsage,
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
  findUsage,
  hasUnambiguousDomain,
  indexOntology,
  isOntologyEmpty,
  propertyLocalNames,
  relationUsages,
  relationUsagesOfClass,
  relationUsagesTouchingClass,
  resolveUsage,
  usageCount,
  usagesOfProperty,
} from './ontology';
export type { OntologyIndex } from './ontology';

export {
  ABSOLUTE_IRI_VALUE,
  entityIri,
  normalizeNamespaceIri,
  ontologyIri,
  sanitizeLocalName,
  toClassLocalName,
  toPropertyLocalName,
  uniqueLocalName,
  validateLocalName,
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
  attachProperty,
  deleteClass,
  deleteAttribute,
  deleteRelation,
  detachUsage,
  moveClass,
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

export { ontologyToTriples, iri, literal } from './triples';
export type { Triple, TripleObject, SerializationOptions } from './triples';
