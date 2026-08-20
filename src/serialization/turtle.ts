import { DataFactory, Writer } from 'n3';
import type { Quad } from 'n3';
import { blankLabel, isBlankNode, ontologyToTriples } from '../ontologymodel';
import type { Ontology, SerializationOptions, Triple } from '../ontologymodel';
import { prefixesFor } from './prefixes';

const { blankNode, namedNode, literal, quad, defaultGraph } = DataFactory;

/** Converts our serializer-agnostic triple into an RDF/JS quad for N3. */
export function toQuad(triple: Triple): Quad {
  const object =
    triple.object.type === 'iri'
      ? namedNode(triple.object.value)
      : triple.object.type === 'blank'
        ? blankNode(blankLabel(triple.object.value))
        : triple.object.language
          ? literal(triple.object.value, triple.object.language)
          : triple.object.datatype
            ? literal(triple.object.value, namedNode(triple.object.datatype))
            : literal(triple.object.value);
  const subject = isBlankNode(triple.subject)
    ? blankNode(blankLabel(triple.subject))
    : namedNode(triple.subject);
  return quad(subject, namedNode(triple.predicate), object, defaultGraph());
}

/**
 * Turtle output. N3's writer handles escaping, literal forms and prefix folding, which is
 * exactly the fiddly part worth taking a dependency for.
 */
export function serializeTurtle(ontology: Ontology, options: SerializationOptions = {}): string {
  const triples = ontologyToTriples(ontology, options);
  const writer = new Writer({ prefixes: prefixesFor(ontology, triples), format: 'text/turtle' });
  for (const triple of triples) writer.addQuad(toQuad(triple));

  let output = '';
  let failure: Error | null = null;
  // N3's callback is invoked synchronously on end() for the string writer.
  writer.end((error, result: string) => {
    if (error) failure = error;
    else output = result;
  });
  if (failure) throw failure;
  return output;
}
