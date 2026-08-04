export type {
  Annotation,
  AnnotatableEntity,
  DatatypeProperty,
  EntityKind,
  EntityRef,
  ObjectProperty,
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
  findDatatypeProperty,
  findObjectProperty,
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
  datatypePropertyList,
  objectPropertyForest,
  rootClasses,
  subClassEdges,
  taxonomyModules,
} from './taxonomy';
export type { TaxonomyNode } from './taxonomy';

export {
  addAnnotation,
  addAttributeToClass,
  addClass,
  addDatatypeProperty,
  addObjectProperty,
  addRelationBetween,
  addSubClassOf,
  attachProperty,
  deleteClass,
  deleteDatatypeProperty,
  deleteObjectProperty,
  detachUsage,
  moveClass,
  removeAnnotation,
  renameClass,
  renameDatatypeProperty,
  renameObjectProperty,
  setDatatypePropertyRange,
  setOntologyIri,
  setOntologyPrefix,
  setSuperClass,
  setSuperObjectProperty,
  setUsageEndpoints,
  updateAnnotation,
} from './mutations';

export { ontologyToTriples, iri, literal } from './triples';
export type { Triple, TripleObject, SerializationOptions } from './triples';
