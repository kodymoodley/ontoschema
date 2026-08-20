import type { Ontology, SerializationOptions } from '../ontologymodel';
import { serializeTurtle } from './turtle';
import { serializeRdfXml } from './rdfxml';
import { serializeJsonLd } from './jsonld';
import { serializeMermaid } from './mermaid';

/**
 * Public face of the serialization layer.
 *
 * `.rdf` and `.owl` are the same RDF/XML bytes under two file extensions, because both are
 * in common use and tools differ on which they expect.
 */
export type SerializationFormat = 'turtle' | 'rdfxml' | 'owl' | 'jsonld' | 'mermaid';

export interface SerializationDescriptor {
  format: SerializationFormat;
  /**
   * `rdf` writers all render the same triples, so they can be checked against one another and
   * against a real parser. A `diagram` is a picture of the model and cannot be, which is worth
   * saying in the type rather than leaving to a list of exceptions in the tests.
   */
  kind: 'rdf' | 'diagram';
  label: string;
  extension: string;
  mimeType: string;
  description: string;
}

export const SERIALIZATION_FORMATS: readonly SerializationDescriptor[] = [
  {
    format: 'turtle',
    kind: 'rdf',
    label: 'Turtle',
    extension: 'ttl',
    mimeType: 'text/turtle',
    description: 'Compact, human-readable RDF',
  },
  {
    format: 'rdfxml',
    kind: 'rdf',
    label: 'RDF/XML',
    extension: 'rdf',
    mimeType: 'application/rdf+xml',
    description: 'The classic W3C interchange syntax',
  },
  {
    format: 'owl',
    kind: 'rdf',
    label: 'RDF/XML (.owl)',
    extension: 'owl',
    mimeType: 'application/rdf+xml',
    description: 'Identical to .rdf, named for OWL tooling',
  },
  {
    format: 'jsonld',
    kind: 'rdf',
    label: 'JSON-LD',
    extension: 'jsonld',
    mimeType: 'application/ld+json',
    description: 'RDF as JSON, for web APIs',
  },
  {
    format: 'mermaid',
    kind: 'diagram',
    label: 'Mermaid',
    extension: 'mmd',
    mimeType: 'text/vnd.mermaid',
    description: 'A class diagram to paste into a document — a picture, not RDF',
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
  options: SerializationOptions = {},
): SerializedOntology {
  const descriptor = describeFormat(format);
  const content =
    format === 'turtle'
      ? serializeTurtle(ontology, options)
      : format === 'jsonld'
        ? serializeJsonLd(ontology, options)
        : format === 'mermaid'
          ? serializeMermaid(ontology)
          : serializeRdfXml(ontology, options);

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
export { prefixesFor } from './prefixes';
export type { SerializationOptions } from '../ontologymodel';

export { formatForFilename, fromQuad, parseDocument, readOntology } from './read';
export type { ImportFormat, ParsedDocument } from './read';
