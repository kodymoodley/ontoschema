import { describe, expect, it } from 'vitest';
import {
  ONTOSCHEMA_LAYOUT,
  ONTOSCHEMA_POSITION,
  OWL_ANNOTATION_PROPERTY,
  OWL_CLASS,
  OWL_ONTOLOGY,
  RDF_TYPE,
} from '../annotationvocabulary';
import { objectsOf } from '../../tests/fixtures/readTriples';
import { ontologyFromTriples } from './fromTriples';
import { addClass } from './mutations';
import { createEmptyOntology } from './ontology';
import { decodeLayout, decodePosition, encodePosition } from './layout';
import { iri, literal, ontologyToTriples } from './triples';
import type { Triple } from './triples';

const AUTO = 'https://example.org/auto/';
const HEADER = 'https://example.org/auto';

function ontologyWith(positions: Record<string, { x: number; y: number }>) {
  let ontology = createEmptyOntology(AUTO, 'auto');
  for (const [localName, position] of Object.entries(positions)) {
    ontology = addClass(ontology, { localName, position }).ontology;
  }
  return ontology;
}

describe('writing a position', () => {
  it('writes x and y either side of a comma', () => {
    expect(encodePosition({ x: 40, y: 120 })).toBe('40,120');
  });

  it('rounds to whole pixels, so a drag no one can see does not rewrite the line', () => {
    expect(encodePosition({ x: 40.4, y: 119.6 })).toBe('40,120');
  });

  it('keeps the sign of a class dragged above or left of the origin', () => {
    expect(encodePosition({ x: -80, y: -0.4 })).toBe('-80,0');
  });
});

describe('reading a position', () => {
  it.each([
    ['40,120', { x: 40, y: 120 }],
    [' 40 , 120 ', { x: 40, y: 120 }],
    ['-5.5,3', { x: -5.5, y: 3 }],
  ])('reads %j', (value, position) => {
    expect(decodePosition(value)).toEqual(position);
  });

  /*
   * A schema in git is edited by hand and resolved through merge conflicts. A position is the
   * least important thing in it, so nothing here may throw: the worst allowed outcome is a class
   * placed as though it were new.
   */
  it.each([
    ['an empty string', ''],
    ['one number', '40'],
    ['three numbers', '1,2,3'],
    ['words', 'over there'],
    ['the old JSON form', '[40,120]'],
    ['a conflict marker left in', '<<<<<<< HEAD'],
  ])('gives nothing for %s rather than failing', (_name, value) => {
    expect(decodePosition(value)).toBeNull();
  });
});

describe('the positions in a document', () => {
  const ontology = ontologyWith({ Car: { x: 40, y: 120 }, Wheel: { x: 300, y: 260 } });
  const triples = ontologyToTriples(ontology);

  it('hangs each position off its own class', () => {
    expect(objectsOf(triples, `${AUTO}Car`, ONTOSCHEMA_POSITION)).toEqual(['40,120']);
    expect(objectsOf(triples, `${AUTO}Wheel`, ONTOSCHEMA_POSITION)).toEqual(['300,260']);
  });

  it('no longer writes the single ontology-wide layout', () => {
    expect(triples.some((triple) => triple.predicate === ONTOSCHEMA_LAYOUT)).toBe(false);
  });

  it('declares the term once, so the document stays valid OWL', () => {
    expect(objectsOf(triples, ONTOSCHEMA_POSITION, RDF_TYPE)).toEqual([OWL_ANNOTATION_PROPERTY]);
  });

  /*
   * A Turtle writer groups a subject's triples only while they are adjacent. A position emitted
   * anywhere else would open a second block for the class, far from the first.
   */
  it('keeps each position inside its class block', () => {
    const subjects = triples.map((triple) => triple.subject);
    const carBlock = subjects.flatMap((subject, i) => (subject === `${AUTO}Car` ? [i] : []));
    expect(carBlock).toEqual(
      Array.from({ length: carBlock.length }, (_, i) => (carBlock[0] ?? 0) + i),
    );
  });

  it('writes positions even when the axioms are left out', () => {
    const layoutOnly = ontologyToTriples(ontology, {
      includeAxioms: false,
      includeShapes: false,
    });
    expect(objectsOf(layoutOnly, `${AUTO}Car`, ONTOSCHEMA_POSITION)).toEqual(['40,120']);
  });

  it('writes nothing, not even the declaration, for an ontology with no classes', () => {
    const empty = ontologyToTriples(createEmptyOntology(AUTO, 'auto'));
    expect(empty.some((triple) => triple.subject === ONTOSCHEMA_POSITION)).toBe(false);
  });

  it('writes nothing when the layout is switched off', () => {
    const noLayout = ontologyToTriples(ontology, { includeLayout: false });
    expect(noLayout.some((triple) => triple.predicate === ONTOSCHEMA_POSITION)).toBe(false);
  });
});

describe('reading positions back', () => {
  /** A class declared by hand, with whatever position triples a test wants beside it. */
  const documentWith = (extra: Triple[]): Triple[] => [
    { subject: HEADER, predicate: RDF_TYPE, object: iri(OWL_ONTOLOGY) },
    { subject: `${AUTO}Car`, predicate: RDF_TYPE, object: iri(OWL_CLASS) },
    ...extra,
  ];
  const positionOfCar = (triples: Triple[]) =>
    ontologyFromTriples(triples, { auto: AUTO }).ontology.classes[0]?.position;

  it('round-trips every class through a document', () => {
    const ontology = ontologyWith({ Car: { x: 40, y: 120 }, Wheel: { x: 300, y: 260 } });
    const read = ontologyFromTriples(ontologyToTriples(ontology), { auto: AUTO }).ontology;
    expect(read.classes.map((entity) => [entity.localName, entity.position])).toEqual([
      ['Car', { x: 40, y: 120 }],
      ['Wheel', { x: 300, y: 260 }],
    ]);
  });

  it('still reads files saved with the single ontology-wide layout', () => {
    const legacy = literal(JSON.stringify({ [`${AUTO}Car`]: [10, 20] }));
    expect(
      positionOfCar(
        documentWith([{ subject: HEADER, predicate: ONTOSCHEMA_LAYOUT, object: legacy }]),
      ),
    ).toEqual({ x: 10, y: 20 });
  });

  it('prefers the class’s own position when a file has both forms', () => {
    const legacy = literal(JSON.stringify({ [`${AUTO}Car`]: [10, 20] }));
    expect(
      positionOfCar(
        documentWith([
          { subject: HEADER, predicate: ONTOSCHEMA_LAYOUT, object: legacy },
          { subject: `${AUTO}Car`, predicate: ONTOSCHEMA_POSITION, object: literal('40,120') },
        ]),
      ),
    ).toEqual({ x: 40, y: 120 });
  });

  it('places a class with an unreadable position as though it were new', () => {
    expect(
      positionOfCar(
        documentWith([
          { subject: `${AUTO}Car`, predicate: ONTOSCHEMA_POSITION, object: literal('somewhere') },
        ]),
      ),
    ).toEqual({ x: 0, y: 0 });
  });

  it('does not mistake the position for an annotation the person wrote', () => {
    const ontology = ontologyWith({ Car: { x: 40, y: 120 } });
    const read = ontologyFromTriples(ontologyToTriples(ontology), { auto: AUTO }).ontology;
    expect(read.classes[0]?.annotations).toEqual([]);
  });
});

describe('reading the old ontology-wide layout', () => {
  it('reads every class it names', () => {
    const layout = decodeLayout(JSON.stringify({ [`${AUTO}Car`]: [40, 120] }));
    expect(layout.get(`${AUTO}Car`)).toEqual({ x: 40, y: 120 });
  });

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
