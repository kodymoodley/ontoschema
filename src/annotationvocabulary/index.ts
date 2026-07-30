export {
  NAMESPACES,
  expandCurie,
  RDF_TYPE,
  RDFS_SUBCLASS_OF,
  RDFS_SUBPROPERTY_OF,
  RDFS_DOMAIN,
  RDFS_RANGE,
  OWL_CLASS,
  OWL_OBJECT_PROPERTY,
  OWL_DATATYPE_PROPERTY,
  OWL_ONTOLOGY,
} from './namespaces';
export type { KnownPrefix } from './namespaces';

export {
  ANNOTATION_TERMS,
  ANNOTATION_PREFIX_ORDER,
  ONTOLOGY_ANNOTATION_TERMS,
  findAnnotationTerm,
  annotationTermIri,
} from './terms';
export type { AnnotationTerm, AnnotationValueKind } from './terms';

export {
  XSD_DATATYPES,
  DEFAULT_XSD_DATATYPE,
  xsdDatatypeIri,
  xsdDatatypeCurie,
  isXsdDatatype,
} from './datatypes';
export type { XsdDatatype } from './datatypes';

export { SUGGESTED_LANGUAGE_TAGS, isValidLanguageTag, normalizeLanguageTag } from './languages';
