import { describe, expect, it } from 'vitest';
import { ONTOSCHEMA_LAYOUT, OWL_ANNOTATION_PROPERTY, RDF_TYPE } from '../annotationvocabulary';
import { objectsOf } from '../../tests/fixtures/readTriples';
import { addClass, moveClass } from './mutations';
import { createEmptyOntology } from './ontology';
import { decodeLayout, encodeLayout } from './layout';
import { ontologyToTriples } from './triples';

const AUTO = 'https://example.org/auto/';

function ontologyWith(positions: Record<string, { x: number; y: number }>) {
  let ontology = createEmptyOntology(AUTO, 'auto');
  for (const [localName, position] of Object.entries(positions)) {
    ontology = addClass(ontology, { localName, position }).ontology;
  }
  return ontology;
}

describe('encoding where the classes sit', () => {
  it('keys positions by IRI, since an internal id means nothing in a file', () => {
    const ontology = ontologyWith({ Car: { x: 40, y: 120 } });
    expect(encodeLayout(ontology)).toBe(`{"${AUTO}Car":[40,120]}`);
  });

  it('rounds to whole pixels, so a drag no one can see does not rewrite the line', () => {
    const ontology = ontologyWith({ Car: { x: 40.4, y: 119.6 } });
    expect(encodeLayout(ontology)).toBe(`{"${AUTO}Car":[40,120]}`);
  });

  /*
   * The whole layout is one line, so any move rewrites all of it. Sorting is what keeps that
   * rewrite to the numbers that changed rather than reshuffling the entries as well.
   */
  it('orders entries by IRI rather than by when the class was made', () => {
    const ontology = ontologyWith({
      Wheel: { x: 1, y: 1 },
      Car: { x: 2, y: 2 },
      Engine: { x: 3, y: 3 },
    });
    const encoded = encodeLayout(ontology) ?? '';
    expect(Object.keys(JSON.parse(encoded))).toEqual([
      `${AUTO}Car`,
      `${AUTO}Engine`,
      `${AUTO}Wheel`,
    ]);
  });

  it('writes nothing at all for an ontology with no classes', () => {
    expect(encodeLayout(createEmptyOntology(AUTO, 'auto'))).toBeNull();
  });

  it('survives a move', () => {
    let ontology = ontologyWith({ Car: { x: 0, y: 0 } });
    const id = ontology.classes[0]!.id;
    ontology = moveClass(ontology, id, { x: 300, y: 40 });
    expect(decodeLayout(encodeLayout(ontology) ?? '').get(`${AUTO}Car`)).toEqual({ x: 300, y: 40 });
  });
});

describe('reading it back', () => {
  it('round-trips every class', () => {
    const ontology = ontologyWith({ Car: { x: 40, y: 120 }, Wheel: { x: 300, y: 260 } });
    const layout = decodeLayout(encodeLayout(ontology) ?? '');

    expect(layout.get(`${AUTO}Car`)).toEqual({ x: 40, y: 120 });
    expect(layout.get(`${AUTO}Wheel`)).toEqual({ x: 300, y: 260 });
  });

  /*
   * This value can come from a file another tool wrote, or one edited by hand. A layout is
   * the least important thing in the document, so nothing here may throw: the worst outcome
   * allowed is classes placed as though they were new.
   */
  it.each([
    ['not JSON at all', 'certainly not json'],
    ['an array', '[1, 2, 3]'],
    ['null', 'null'],
    ['a number', '42'],
    ['an empty string', ''],
  ])('yields no positions for %s rather than failing', (_name, value) => {
    expect(decodeLayout(value).size).toBe(0);
  });

  it('keeps the entries it understands and drops the ones it does not', () => {
    const layout = decodeLayout(
      JSON.stringify({
        [`${AUTO}Car`]: [10, 20],
        [`${AUTO}Wheel`]: 'over there',
        [`${AUTO}Door`]: [1],
        [`${AUTO}Engine`]: [1, 2, 3],
        [`${AUTO}Boot`]: ['x', 'y'],
      }),
    );
    expect([...layout.keys()]).toEqual([`${AUTO}Car`]);
  });
});

describe('the annotation in the document', () => {
  const ontology = ontologyWith({ Car: { x: 40, y: 120 } });
  const triples = ontologyToTriples(ontology);

  it('hangs the layout off the ontology, not off each class', () => {
    expect(objectsOf(triples, 'https://example.org/auto', ONTOSCHEMA_LAYOUT)).toEqual([
      `{"${AUTO}Car":[40,120]}`,
    ]);
    expect(
      triples.some(
        (triple) => triple.subject === `${AUTO}Car` && triple.predicate === ONTOSCHEMA_LAYOUT,
      ),
    ).toBe(false);
  });

  it('declares the term, so the document stays valid OWL', () => {
    expect(objectsOf(triples, ONTOSCHEMA_LAYOUT, RDF_TYPE)).toEqual([OWL_ANNOTATION_PROPERTY]);
  });
});
