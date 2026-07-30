import { RDF_TYPE } from '../annotationvocabulary';
import { ontologyToTriples } from '../ontologymodel';
import type { Ontology, TripleObject } from '../ontologymodel';
import { prefixesFor, toCurie } from './prefixes';
import type { PrefixTable } from './prefixes';

/**
 * JSON-LD writer.
 *
 * Hand-written for the same reason as RDF/XML: the full `jsonld` library exists to do
 * expansion, compaction and framing against arbitrary remote contexts, none of which this
 * app needs. Our triples have no blank nodes and no lists, so a compacted `@graph`
 * document with a flat prefix `@context` is a faithful, and much cheaper, rendering.
 * Validity is checked by parsing the output with a real JSON-LD parser in the tests.
 */

type JsonLdValue = { '@id': string } | { '@value': string; '@language'?: string; '@type'?: string };

interface JsonLdNode {
  '@id': string;
  '@type'?: string | string[];
  [predicate: string]: unknown;
}

export function serializeJsonLd(ontology: Ontology): string {
  const triples = ontologyToTriples(ontology);
  const prefixes = prefixesFor(ontology, triples);

  const nodes = new Map<string, JsonLdNode>();
  const nodeFor = (subject: string): JsonLdNode => {
    const existing = nodes.get(subject);
    if (existing) return existing;
    const created: JsonLdNode = { '@id': compactIri(subject, prefixes) };
    nodes.set(subject, created);
    return created;
  };

  for (const triple of triples) {
    const node = nodeFor(triple.subject);

    if (triple.predicate === RDF_TYPE && triple.object.type === 'iri') {
      appendType(node, compactIri(triple.object.value, prefixes));
      continue;
    }

    const key = compactIri(triple.predicate, prefixes);
    appendValue(node, key, toJsonLdValue(triple.object, prefixes));
  }

  const document = {
    '@context': Object.fromEntries(Object.entries(prefixes).sort(([a], [b]) => a.localeCompare(b))),
    '@graph': [...nodes.values()],
  };

  return `${JSON.stringify(document, null, 2)}\n`;
}

function toJsonLdValue(object: TripleObject, prefixes: PrefixTable): JsonLdValue {
  if (object.type === 'iri') return { '@id': compactIri(object.value, prefixes) };
  if (object.language) return { '@value': object.value, '@language': object.language };
  if (object.datatype)
    return { '@value': object.value, '@type': compactIri(object.datatype, prefixes) };
  return { '@value': object.value };
}

function appendType(node: JsonLdNode, type: string): void {
  const current = node['@type'];
  if (current === undefined) node['@type'] = type;
  else if (Array.isArray(current)) {
    if (!current.includes(type)) current.push(type);
  } else if (current !== type) {
    node['@type'] = [current, type];
  }
}

/** A predicate asserted more than once becomes an array, which is what JSON-LD expects. */
function appendValue(node: JsonLdNode, key: string, value: JsonLdValue): void {
  const current = node[key];
  if (current === undefined) node[key] = value;
  else if (Array.isArray(current)) current.push(value);
  else node[key] = [current, value];
}

function compactIri(iri: string, prefixes: PrefixTable): string {
  return toCurie(iri, prefixes) ?? iri;
}
