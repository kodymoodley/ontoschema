import { Parser as TurtleParser } from 'n3';
import type { Quad } from 'n3';
import { RdfXmlParser } from 'rdfxml-streaming-parser';
import { JsonLdParser } from 'jsonld-streaming-parser';

/**
 * Real parsers, no mocks. If a serializer emits anything these cannot read, the tests fail
 * for the same reason Protégé or rdflib would fail to open the file.
 */

export function parseTurtle(content: string): Quad[] {
  return new TurtleParser({ format: 'text/turtle' }).parse(content) as Quad[];
}

function parseStreaming(parser: NodeJS.WritableStream & NodeJS.ReadableStream, content: string) {
  return new Promise<Quad[]>((resolve, reject) => {
    const quads: Quad[] = [];
    parser.on('data', (quad: Quad) => quads.push(quad));
    parser.on('error', reject);
    parser.on('end', () => resolve(quads));
    parser.write(content);
    parser.end();
  });
}

export function parseRdfXml(content: string): Promise<Quad[]> {
  return parseStreaming(
    new RdfXmlParser() as unknown as NodeJS.WritableStream & NodeJS.ReadableStream,
    content,
  );
}

export function parseJsonLd(content: string): Promise<Quad[]> {
  return parseStreaming(
    new JsonLdParser() as unknown as NodeJS.WritableStream & NodeJS.ReadableStream,
    content,
  );
}

/**
 * Canonical N-Triples-ish form of a quad set, used to compare graphs across serializations.
 * Our graphs contain no blank nodes, so sorted string equality is exact graph equality —
 * no need for a full isomorphism algorithm.
 */
export function canonicalize(quads: readonly Quad[]): string[] {
  return quads
    .map((quad) => {
      const object =
        quad.object.termType === 'NamedNode'
          ? `<${quad.object.value}>`
          : quad.object.termType === 'Literal'
            ? formatLiteral(quad.object.value, quad.object.language, quad.object.datatype?.value)
            : `_:${quad.object.value}`;
      return `<${quad.subject.value}> <${quad.predicate.value}> ${object} .`;
    })
    .sort();
}

const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';
const RDF_LANG_STRING = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';

function formatLiteral(value: string, language: string, datatype?: string): string {
  const escaped = JSON.stringify(value);
  if (language) return `${escaped}@${language.toLowerCase()}`;
  // Parsers disagree on whether a plain literal carries an explicit xsd:string datatype;
  // both spellings denote the same RDF 1.1 term, so normalise them together.
  if (!datatype || datatype === XSD_STRING || datatype === RDF_LANG_STRING) return escaped;
  return `${escaped}^^<${datatype}>`;
}

export function hasBlankNodes(quads: readonly Quad[]): boolean {
  return quads.some(
    (quad) => quad.subject.termType === 'BlankNode' || quad.object.termType === 'BlankNode',
  );
}
