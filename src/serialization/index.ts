import type { Ontology } from '../ontologymodel';
import { serializeTurtle } from './turtle';
import { serializeRdfXml } from './rdfxml';
import { serializeJsonLd } from './jsonld';

/**
 * Public face of the serialization layer.
 *
 * `.rdf` and `.owl` are the same RDF/XML bytes under two file extensions, because both are
 * in common use and tools differ on which they expect.
 */
export type SerializationFormat = 'turtle' | 'rdfxml' | 'owl' | 'jsonld';

export interface SerializationDescriptor {
  format: SerializationFormat;
  label: string;
  extension: string;
  mimeType: string;
  description: string;
}

export const SERIALIZATION_FORMATS: readonly SerializationDescriptor[] = [
  {
    format: 'turtle',
    label: 'Turtle',
    extension: 'ttl',
    mimeType: 'text/turtle',
    description: 'Compact, human-readable RDF',
  },
  {
    format: 'rdfxml',
    label: 'RDF/XML',
    extension: 'rdf',
    mimeType: 'application/rdf+xml',
    description: 'The classic W3C interchange syntax',
  },
  {
    format: 'owl',
    label: 'RDF/XML (.owl)',
    extension: 'owl',
    mimeType: 'application/rdf+xml',
    description: 'Identical to .rdf, named for OWL tooling',
  },
  {
    format: 'jsonld',
    label: 'JSON-LD',
    extension: 'jsonld',
    mimeType: 'application/ld+json',
    description: 'RDF as JSON, for web APIs',
  },
];

export interface SerializedOntology {
  format: SerializationFormat;
  filename: string;
  mimeType: string;
  content: string;
}

export function describeFormat(format: SerializationFormat): SerializationDescriptor {
  const descriptor = SERIALIZATION_FORMATS.find((entry) => entry.format === format);
  if (!descriptor) throw new Error(`Unknown serialization format: ${format}`);
  return descriptor;
}

export function serialize(
  ontology: Ontology,
  format: SerializationFormat,
  baseFilename = 'ontology',
): SerializedOntology {
  const descriptor = describeFormat(format);
  const content =
    format === 'turtle'
      ? serializeTurtle(ontology)
      : format === 'jsonld'
        ? serializeJsonLd(ontology)
        : serializeRdfXml(ontology);

  return {
    format,
    filename: `${sanitizeFilename(baseFilename)}.${descriptor.extension}`,
    mimeType: descriptor.mimeType,
    content,
  };
}

/** Project names are free text; a download filename is not. */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'ontology';
}

export { serializeTurtle } from './turtle';
export { serializeRdfXml } from './rdfxml';
export { serializeJsonLd } from './jsonld';
export { prefixesFor, toCurie, namespaceOf, localNameOf } from './prefixes';
export type { PrefixTable } from './prefixes';
