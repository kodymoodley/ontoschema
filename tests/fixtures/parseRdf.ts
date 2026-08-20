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
 *
 * Blank node labels are assigned by whichever parser read the file, so they differ between
 * Turtle, RDF/XML and JSON-LD for the same graph and cannot be compared directly. Each is
 * replaced by a signature of what it *says* — its outgoing triples, with nested blank nodes
 * expanded the same way — which makes equality here real graph equality rather than
 * string equality that happens to hold.
 *
 * This is not a general isomorphism algorithm and does not need to be: the only blank nodes
 * this app writes are OWL class expressions and their list cells, which form finite trees
 * hanging off named subjects. Two blank nodes with the same signature are interchangeable,
 * so collapsing them is exactly right.
 */
export function canonicalize(quads: readonly Quad[]): string[] {
  const signature = blankSignatures(quads);
  const format = (term: Quad['object']): string =>
    term.termType === 'BlankNode'
      ? `_:${signature.get(term.value) ?? term.value}`
      : term.termType === 'Literal'
        ? formatLiteral(term.value, term.language, term.datatype?.value)
        : `<${term.value}>`;

  return quads
    .map((quad) => `${format(quad.subject)} <${quad.predicate.value}> ${format(quad.object)} .`)
    .sort();
}

/** What each blank node says, as a string, with nested blank nodes expanded in place. */
function blankSignatures(quads: readonly Quad[]): Map<string, string> {
  const outgoing = new Map<string, Quad[]>();
  for (const quad of quads) {
    if (quad.subject.termType !== 'BlankNode') continue;
    const existing = outgoing.get(quad.subject.value);
    if (existing) existing.push(quad);
    else outgoing.set(quad.subject.value, [quad]);
  }

  const signatures = new Map<string, string>();
  const describe = (label: string, seen: ReadonlySet<string>): string => {
    // A cycle cannot occur in what this app writes, but a helper that hangs on bad input is
    // a worse failure than one that reports the cycle.
    if (seen.has(label)) return '<cycle>';
    const cached = signatures.get(label);
    if (cached !== undefined) return cached;

    const within = new Set([...seen, label]);
    const parts = (outgoing.get(label) ?? [])
      .map((quad) => {
        const object = quad.object;
        const rendered =
          object.termType === 'BlankNode'
            ? describe(object.value, within)
            : object.termType === 'Literal'
              ? formatLiteral(object.value, object.language, object.datatype?.value)
              : `<${object.value}>`;
        return `<${quad.predicate.value}> ${rendered}`;
      })
      .sort();

    const signature = `{${parts.join('; ')}}`;
    if (seen.size === 0) signatures.set(label, signature);
    return signature;
  };

  for (const label of outgoing.keys()) describe(label, new Set());
  return signatures;
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

/**
 * The blank nodes that are not OWL class expressions.
 *
 * A union domain has to be anonymous to be read as an expression at all, so blank nodes are
 * no longer forbidden outright — but they are still confined to that one job, and this is
 * what says so. A class expression is a blank node typed `owl:Class`, or a cell of the list
 * one of them owns.
 */
export function unexpectedBlankNodes(quads: readonly Quad[]): string[] {
  const OWL_CLASS = 'http://www.w3.org/2002/07/owl#Class';
  const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
  const RDF_FIRST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first';
  const RDF_REST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest';

  const expressions = new Set(
    quads
      .filter(
        (quad) =>
          quad.subject.termType === 'BlankNode' &&
          quad.predicate.value === RDF_TYPE &&
          quad.object.value === OWL_CLASS,
      )
      .map((quad) => quad.subject.value),
  );
  // List cells, reached from an expression and from each other.
  let grew = true;
  while (grew) {
    grew = false;
    for (const quad of quads) {
      if (quad.object.termType !== 'BlankNode') continue;
      if (quad.subject.termType === 'BlankNode' && !expressions.has(quad.subject.value)) continue;
      if (
        ![RDF_FIRST, RDF_REST, 'http://www.w3.org/2002/07/owl#unionOf'].includes(
          quad.predicate.value,
        )
      ) {
        continue;
      }
      if (expressions.has(quad.object.value)) continue;
      expressions.add(quad.object.value);
      grew = true;
    }
  }

  const labels = new Set<string>();
  for (const quad of quads) {
    for (const term of [quad.subject, quad.object]) {
      if (term.termType === 'BlankNode' && !expressions.has(term.value)) labels.add(term.value);
    }
  }
  return [...labels];
}

/**
 * The classes a property's union domain (or range) stands for, read out of parsed quads.
 *
 * Follows the reference rather than assuming what the blank nodes are called: the labels
 * belong to whichever writer or parser produced them.
 */
export function unionMembers(quads: readonly Quad[], subject: string, predicate: string): string[] {
  const objectOf = (subj: string, pred: string) =>
    quads.find((quad) => quad.subject.value === subj && quad.predicate.value === pred)?.object;

  const expression = objectOf(subject, predicate);
  if (!expression || expression.termType !== 'BlankNode') return [];

  const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
  let cell = objectOf(expression.value, 'http://www.w3.org/2002/07/owl#unionOf');
  const members: string[] = [];
  while (cell && cell.termType === 'BlankNode') {
    const first = objectOf(cell.value, `${RDF}first`);
    if (first) members.push(first.value);
    cell = objectOf(cell.value, `${RDF}rest`);
  }
  return members;
}
