/**
 * The fixed namespaces OntoSchema knows about. The ontology's own namespace is supplied
 * by the user at runtime and is therefore not part of this table.
 */
export const NAMESPACES = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl: 'http://www.w3.org/2002/07/owl#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  dcterms: 'http://purl.org/dc/terms/',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  prov: 'http://www.w3.org/ns/prov#',
  vann: 'http://purl.org/vocab/vann/',
  sh: 'http://www.w3.org/ns/shacl#',
  /*
   * This app's own namespace, for the one term it has to invent: where the classes sit on the
   * canvas. Resolvable, and pointing at the app that wrote the file, so anyone who meets the
   * term in a document has somewhere to go. Nothing here is offered as an annotation the user
   * can choose — that list is explicit, elsewhere — and nothing else will be added.
   */
  ontoschema: 'https://kodymoodley.github.io/ontoschema-site/ns#',
} as const;

export type KnownPrefix = keyof typeof NAMESPACES;

/** Terms used structurally by the serializers (not user-selectable annotations). */
export const RDF_TYPE = `${NAMESPACES.rdf}type`;
export const RDFS_SUBCLASS_OF = `${NAMESPACES.rdfs}subClassOf`;
export const RDFS_SUBPROPERTY_OF = `${NAMESPACES.rdfs}subPropertyOf`;
export const RDFS_DOMAIN = `${NAMESPACES.rdfs}domain`;
export const RDFS_RANGE = `${NAMESPACES.rdfs}range`;
export const OWL_CLASS = `${NAMESPACES.owl}Class`;
export const OWL_OBJECT_PROPERTY = `${NAMESPACES.owl}ObjectProperty`;
export const OWL_DATATYPE_PROPERTY = `${NAMESPACES.owl}DatatypeProperty`;
export const OWL_ONTOLOGY = `${NAMESPACES.owl}Ontology`;
/** The one OWL construct that can state a domain of several classes without lying about it. */
export const OWL_UNION_OF = `${NAMESPACES.owl}unionOf`;
export const OWL_ANNOTATION_PROPERTY = `${NAMESPACES.owl}AnnotationProperty`;

/**
 * Where the classes sit on the canvas, as one annotation on the ontology.
 *
 * One term rather than a position on each class, so a layout is a single line that a
 * triple-level diff can ignore by predicate, and so a document that has never been opened
 * here carries nothing at all.
 */
export const ONTOSCHEMA_LAYOUT = `${NAMESPACES.ontoschema}layout`;

export const RDF_FIRST = `${NAMESPACES.rdf}first`;
export const RDF_REST = `${NAMESPACES.rdf}rest`;
export const RDF_NIL = `${NAMESPACES.rdf}nil`;

/** SHACL terms used to express a usage as a property shape. */
export const SH_NODE_SHAPE = `${NAMESPACES.sh}NodeShape`;
export const SH_PROPERTY_SHAPE = `${NAMESPACES.sh}PropertyShape`;
export const SH_TARGET_CLASS = `${NAMESPACES.sh}targetClass`;
export const SH_PROPERTY = `${NAMESPACES.sh}property`;
export const SH_PATH = `${NAMESPACES.sh}path`;
export const SH_CLASS = `${NAMESPACES.sh}class`;
export const SH_DATATYPE = `${NAMESPACES.sh}datatype`;
export const SH_OR = `${NAMESPACES.sh}or`;
export const SH_NAME = `${NAMESPACES.sh}name`;

/** Expand a CURIE such as `skos:prefLabel` against the known namespace table. */
export function expandCurie(curie: string): string | null {
  const separator = curie.indexOf(':');
  if (separator < 0) return null;
  const prefix = curie.slice(0, separator);
  const local = curie.slice(separator + 1);
  const namespace = NAMESPACES[prefix as KnownPrefix];
  return namespace ? `${namespace}${local}` : null;
}
