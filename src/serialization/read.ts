import { Parser as TurtleParser } from 'n3';
import type { Quad } from 'n3';
import { blank, iri, literal, ontologyFromTriples } from '../ontologymodel';
import type { ImportResult, Triple, TripleObject } from '../ontologymodel';

/**
 * Reading a document from text.
 *
 * The syntax half of importing: text becomes triples, and `ontologyFromTriples` decides what
 * they mean. Split that way because the rules about what this app models are the same
 * whatever the file was written in, and only the parsing differs.
 *
 * Turtle is parsed by `n3`, which the app already ships for writing. RDF/XML is parsed by
 * `rdfxml-streaming-parser`, which it does **not** ship: measured at 45 kB gzipped, a quarter
 * of the whole app, for a parser most sessions never reach. It is loaded on demand instead, so
 * opening the app costs nothing and only opening an RDF/XML file pays for it.
 */

export type ImportFormat = 'turtle' | 'rdfxml';

export interface ParsedDocument {
  triples: Triple[];
  /** Prefix declarations, which carry the one thing the triples cannot: what to call things. */
  prefixes: Record<string, string>;
}

/** The formats `open` accepts, by the extension a file arrives with. */
const BY_EXTENSION: Record<string, ImportFormat> = {
  ttl: 'turtle',
  turtle: 'turtle',
  n3: 'turtle',
  nt: 'turtle',
  rdf: 'rdfxml',
  owl: 'rdfxml',
  xml: 'rdfxml',
};

export function formatForFilename(filename: string): ImportFormat | undefined {
  const extension = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  return BY_EXTENSION[extension];
}

export async function parseDocument(
  content: string,
  format: ImportFormat,
): Promise<ParsedDocument> {
  return format === 'turtle' ? parseTurtleDocument(content) : parseRdfXmlDocument(content);
}

/** Text in, model out — the whole of opening a document, in one call. */
export async function readOntology(content: string, format: ImportFormat): Promise<ImportResult> {
  const { triples, prefixes } = await parseDocument(content, format);
  return ontologyFromTriples(triples, prefixes);
}

/* ------------------------------------------------------------------------------- turtle */

function parseTurtleDocument(content: string): ParsedDocument {
  const prefixes: Record<string, string> = {};
  /*
   * The three-argument form: synchronous, and the only one that reports prefixes. Parsing
   * throws on a malformed document, which is what the caller wants — a file that is not
   * Turtle should be refused rather than read as an empty ontology.
   */
  const quads = new TurtleParser({ format: 'text/turtle' }).parse(content, null, (prefix, node) => {
    prefixes[prefix] = typeof node === 'string' ? node : node.value;
  });
  return { triples: quads.map(fromQuad), prefixes };
}

/* ------------------------------------------------------------------------------- rdf/xml */

async function parseRdfXmlDocument(content: string): Promise<ParsedDocument> {
  const { RdfXmlParser } = await import('rdfxml-streaming-parser');

  const quads = await new Promise<Quad[]>((resolve, reject) => {
    const collected: Quad[] = [];
    const parser = new RdfXmlParser();
    parser.on('data', (quad: Quad) => collected.push(quad));
    parser.on('error', reject);
    parser.on('end', () => resolve(collected));
    parser.write(content);
    parser.end();
  });

  return { triples: quads.map(fromQuad), prefixes: xmlnsDeclarations(content) };
}

/**
 * The `xmlns:` declarations, read from the text.
 *
 * The RDF/XML parser reports no prefixes — they are an XML feature it consumes rather than
 * something the RDF data model has — so they are taken from the source instead. That is
 * enough for what they are needed for: recognising which prefix the document chose for its
 * own namespace, so a reopened file keeps the name it was written with.
 */
function xmlnsDeclarations(content: string): Record<string, string> {
  const prefixes: Record<string, string> = {};
  const declaration = /xmlns:([A-Za-z_][\w.-]*)\s*=\s*"([^"]*)"/g;
  for (const [, prefix, namespace] of content.matchAll(declaration)) {
    if (prefix && namespace) prefixes[prefix] = namespace;
  }
  return prefixes;
}

/* ------------------------------------------------------------------------------- terms */

/** An RDF/JS quad as this app's own triple — the inverse of `toQuad`. */
export function fromQuad(quad: Quad): Triple {
  return {
    subject: quad.subject.termType === 'BlankNode' ? `_:${quad.subject.value}` : quad.subject.value,
    predicate: quad.predicate.value,
    object: fromTerm(quad.object),
  };
}

function fromTerm(term: Quad['object']): TripleObject {
  if (term.termType === 'BlankNode') return blank(`_:${term.value}`);
  if (term.termType !== 'Literal') return iri(term.value);
  if (term.language) return literal(term.value, { language: term.language });

  /*
   * A plain string carries `xsd:string` in RDF 1.1 and parsers differ on whether they say so.
   * Dropping it here keeps a document that spells it out and one that does not from becoming
   * two different models.
   */
  const datatype = term.datatype?.value;
  if (!datatype || datatype === XSD_STRING) return literal(term.value);
  return literal(term.value, { datatype });
}

const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';
