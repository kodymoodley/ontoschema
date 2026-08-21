import { describe, expect, it } from 'vitest';
import { createEmptyOntology } from '../ontologymodel';
import type { Annotation, Ontology } from '../ontologymodel';
import { search, tokenize } from './bm25';
import { searchEntities } from './entities';

/**
 * Ranking, tested by ordering rather than by score.
 *
 * A BM25 score is a number nobody can check by eye, and asserting on one would fix the
 * constants rather than the behaviour. What is worth pinning down is which result comes first
 * and why, because that is the whole of what a search is for.
 */

describe('splitting text into terms', () => {
  it('breaks a camel-cased name apart, so half a name finds it', () => {
    expect(tokenize('hasWheel')).toEqual(['has', 'wheel']);
    expect(tokenize('offeredByDealership')).toEqual(['offered', 'by', 'dealership']);
  });

  it('ignores punctuation and case', () => {
    expect(tokenize('A road-vehicle, with four wheels.')).toEqual([
      'a',
      'road',
      'vehicle',
      'with',
      'four',
      'wheels',
    ]);
  });

  it('keeps letters that are not English', () => {
    expect(tokenize('Straße für Fahrzeuge')).toEqual(['straße', 'für', 'fahrzeuge']);
  });

  it('finds nothing in nothing', () => {
    expect(tokenize('   ,. ')).toEqual([]);
  });
});

describe('ranking documents', () => {
  const doc = (id: string, name: string, prose = '') => ({
    id,
    fields: [
      { text: name, weight: 3 },
      { text: prose, weight: 1 },
    ],
    value: id,
  });

  it("puts a name match above a mention in someone else's prose", () => {
    const hits = search(
      [
        doc('mentions', 'Dealership', 'Every car is sold by a dealership somewhere'),
        doc('named', 'Car'),
      ],
      'car',
    );
    expect(hits.map((hit) => hit.value)).toEqual(['named', 'mentions']);
  });

  /*
   * The point of `idf`. A word in every document distinguishes nothing, so the one document
   * that also matches the rare word has to win, however often the common one appears.
   */
  it('discounts a word that everything contains', () => {
    const hits = search(
      [
        doc('a', 'Vehicle', 'thing thing thing thing'),
        doc('b', 'Wheel', 'thing thing thing thing'),
        doc('c', 'Engine', 'thing rare'),
      ],
      'thing rare',
    );
    expect(hits[0]?.value).toBe('c');
  });

  /*
   * Found in a real schema, not imagined. Searching `venue` put the attribute `venueName`
   * above the class `Venue`, because the class had a paragraph of definition and the attribute
   * had nothing, so the class counted as the "longer" document and was penalised for having
   * been explained. Length is averaged per field now, which asks whether this is a long *name*
   * rather than a long anything.
   */
  it('does not punish a document for having a description, when both match on the name', () => {
    const hits = search(
      [
        {
          id: 'attr',
          fields: [
            { text: 'venueName', weight: 3 },
            { text: '', weight: 1 },
          ],
          value: 'attr',
        },
        {
          id: 'class',
          fields: [
            { text: 'Venue', weight: 3 },
            {
              text: 'A place where a concert is performed, with a capacity and an address',
              weight: 1,
            },
          ],
          value: 'class',
        },
      ],
      'venue',
    );
    expect(hits[0]?.value).toBe('class');
  });

  it('requires every term, so a second word narrows rather than widens', () => {
    const hits = search([doc('a', 'Car'), doc('b', 'Car', 'a red car')], 'car red');
    expect(hits.map((hit) => hit.value)).toEqual(['b']);
  });

  it('matches a prefix, so results appear while the word is still being typed', () => {
    expect(search([doc('a', 'Dealership')], 'deal').map((h) => h.value)).toEqual(['a']);
  });

  it('says which text matched, so a result can explain itself', () => {
    const [hit] = search([doc('a', 'Car', 'A road vehicle with four wheels')], 'wheels');
    expect(hit?.matched).toBe('A road vehicle with four wheels');
  });

  it.each([
    ['an empty query', ''],
    ['only punctuation', '   ...  '],
    ['a word nothing has', 'aardvark'],
  ])('returns nothing for %s', (_name, query) => {
    expect(search([doc('a', 'Car')], query)).toEqual([]);
  });

  it('returns nothing from an empty corpus rather than dividing by zero', () => {
    expect(search([], 'car')).toEqual([]);
  });

  it('honours the limit', () => {
    const many = Array.from({ length: 50 }, (_, index) => doc(`d${index}`, `Car${index}`));
    expect(search(many, 'car', 5)).toHaveLength(5);
  });
});

/* --------------------------------------------------------------- over a schema */

const annotation = (term: string, value: string): Annotation => ({ id: term, term, value });

function schema(): Ontology {
  const base = createEmptyOntology('https://example.org/auto/', 'auto');
  return {
    ...base,
    classes: [
      {
        id: 'car',
        localName: 'Car',
        superClassIds: [],
        position: { x: 0, y: 0 },
        annotations: [annotation('skos:definition', 'A road vehicle with four wheels')],
      },
      {
        id: 'dealership',
        localName: 'Dealership',
        superClassIds: [],
        position: { x: 0, y: 0 },
        annotations: [annotation('rdfs:label', 'Car dealer')],
      },
    ],
    relations: [{ id: 'offeredBy', localName: 'offeredBy', superPropertyIds: [], annotations: [] }],
    attributes: [
      {
        id: 'price',
        localName: 'price',
        range: 'decimal',
        superPropertyIds: [],
        annotations: [annotation('dcterms:description', 'What the car costs')],
      },
    ],
  };
}

describe('finding something in the open schema', () => {
  it('finds every kind of entity, not only classes', () => {
    expect(searchEntities(schema(), 'offered').map((hit) => hit.kind)).toEqual(['relation']);
    expect(searchEntities(schema(), 'price').map((hit) => hit.kind)).toEqual(['attribute']);
  });

  it('ranks the class called Car above the ones that merely mention a car', () => {
    const found = searchEntities(schema(), 'car');
    expect(found[0]?.localName).toBe('Car');
    expect(found.map((hit) => hit.localName)).toContain('Dealership');
  });

  it('finds a class by its definition when the name gives nothing away', () => {
    const found = searchEntities(schema(), 'wheels');
    expect(found.map((hit) => hit.localName)).toEqual(['Car']);
  });

  it('finds a relation by half its name', () => {
    expect(searchEntities(schema(), 'by').map((hit) => hit.localName)).toEqual(['offeredBy']);
  });

  it('carries a reference the app can select', () => {
    const [hit] = searchEntities(schema(), 'dealership');
    expect(hit?.ref).toEqual({ kind: 'class', id: 'dealership' });
  });

  it('shows the text that explains the hit, and not the name twice', () => {
    expect(searchEntities(schema(), 'wheels')[0]?.context).toBe('A road vehicle with four wheels');
    // Matched on the name itself, so there is nothing to add.
    expect(searchEntities(schema(), 'car')[0]?.context).toBeNull();
  });

  it('finds nothing in an empty schema without complaint', () => {
    const empty = createEmptyOntology('https://example.org/x/', 'x');
    expect(searchEntities(empty, 'car')).toEqual([]);
  });
});
