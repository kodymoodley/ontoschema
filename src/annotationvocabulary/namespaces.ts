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

/** Expand a CURIE such as `skos:prefLabel` against the known namespace table. */
export function expandCurie(curie: string): string | null {
  const separator = curie.indexOf(':');
  if (separator < 0) return null;
  const prefix = curie.slice(0, separator);
  const local = curie.slice(separator + 1);
  const namespace = NAMESPACES[prefix as KnownPrefix];
  return namespace ? `${namespace}${local}` : null;
}
