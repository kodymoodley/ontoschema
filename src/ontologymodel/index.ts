export type {
  Annotation,
  AnnotatableEntity,
  DatatypeProperty,
  EntityKind,
  EntityRef,
  ObjectProperty,
  ObjectPropertyKind,
  Ontology,
  OntologyClass,
  Position,
  Project,
} from './types';

export {
  DEFAULT_NAMESPACE_IRI,
  DEFAULT_PREFIX,
  attributesOfClass,
  classLocalNames,
  connectedRelations,
  createAnnotation,
  createEmptyOntology,
  createId,
  createProject,
  findClass,
  findDatatypeProperty,
  findObjectProperty,
  isOntologyEmpty,
  allLocalNames,
  propertyLocalNames,
  relationsTouchingClass,
} from './ontology';

export {
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
  objectPropertyForest,
  rootClasses,
  subClassEdges,
  taxonomyModules,
} from './taxonomy';
export type { TaxonomyNode } from './taxonomy';

export {
  addAnnotation,
  addClass,
  addDatatypeProperty,
  addObjectProperty,
  addSubClassOf,
  deleteClass,
  deleteDatatypeProperty,
  deleteObjectProperty,
  moveClass,
  moveDatatypeProperty,
  moveObjectProperty,
  removeAnnotation,
  removeSubClassOf,
  renameClass,
  renameDatatypeProperty,
  renameObjectProperty,
  setDatatypePropertyDomain,
  setDatatypePropertyRange,
  setObjectPropertyEndpoints,
  setOntologyIri,
  setOntologyPrefix,
  setSuperClass,
  setSuperObjectProperty,
  updateAnnotation,
} from './mutations';

export { ontologyToTriples, iri, literal } from './triples';
export type { Triple, TripleObject } from './triples';
