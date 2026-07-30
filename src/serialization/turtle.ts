import { DataFactory, Writer } from 'n3';
import type { Quad } from 'n3';
import { ontologyToTriples } from '../ontologymodel';
import type { Ontology, Triple } from '../ontologymodel';
import { prefixesFor } from './prefixes';

const { namedNode, literal, quad, defaultGraph } = DataFactory;

/** Converts our serializer-agnostic triple into an RDF/JS quad for N3. */
export function toQuad(triple: Triple): Quad {
  const object =
    triple.object.type === 'iri'
      ? namedNode(triple.object.value)
      : triple.object.language
        ? literal(triple.object.value, triple.object.language)
        : triple.object.datatype
          ? literal(triple.object.value, namedNode(triple.object.datatype))
          : literal(triple.object.value);
  return quad(namedNode(triple.subject), namedNode(triple.predicate), object, defaultGraph());
}

/**
 * Turtle output. N3's writer handles escaping, literal forms and prefix folding, which is
 * exactly the fiddly part worth taking a dependency for.
 */
export function serializeTurtle(ontology: Ontology): string {
  const triples = ontologyToTriples(ontology);
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
