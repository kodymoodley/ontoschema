import { describe, expect, it } from 'vitest';
import {
  ENTITY_FIELDS,
  SCHEMA_FIELDS,
  isNamedTerm,
  namedValue,
  unnamedAnnotations,
} from './namedfields';
import type { Annotation } from '../ontologymodel';

/**
 * Which annotation a form field is editing, and what is left over for the list behind it.
 *
 * The rule with a decision behind it is the second one: a named field takes the *first*
 * annotation with its term and leaves any others alone, so nothing becomes uneditable just
 * because it was written twice.
 */

let counter = 0;
const annotation = (term: string, value: string): Annotation => ({
  id: `a${(counter += 1)}`,
  term,
  value,
});

describe('what a named field edits', () => {
  it('finds nothing when the term has not been used', () => {
    expect(namedValue([annotation('rdfs:label', 'Car')], 'skos:definition')).toBeUndefined();
  });

  it('takes the first annotation with its term', () => {
    const first = annotation('skos:example', 'a hatchback');
    const second = annotation('skos:example', 'an estate');

    expect(namedValue([first, second], 'skos:example')).toBe(first);
  });
});

describe('what is left for the list behind the fields', () => {
  it('is everything when no field claims anything', () => {
    const spare = [annotation('skos:altLabel', 'Motorcar'), annotation('dcterms:source', 'x')];

    expect(unnamedAnnotations(spare, ENTITY_FIELDS)).toEqual(spare);
  });

  it('drops exactly what the fields are showing', () => {
    const label = annotation('rdfs:label', 'Car');
    const alt = annotation('skos:altLabel', 'Motorcar');

    expect(unnamedAnnotations([label, alt], ENTITY_FIELDS)).toEqual([alt]);
  });

  /*
   * The case the owner decided: `skos:example` earns a field and is also the term most likely
   * to be written more than once. The field shows the first; the rest have to remain editable.
   */
  it('keeps every repeat beyond the one a field is showing', () => {
    const first = annotation('skos:example', 'a hatchback');
    const second = annotation('skos:example', 'an estate');
    const third = annotation('skos:example', 'a coupé');

    expect(unnamedAnnotations([first, second, third], ENTITY_FIELDS)).toEqual([second, third]);
  });

  it('leaves the order they were written in alone', () => {
    const spare = [
      annotation('skos:altLabel', 'one'),
      annotation('rdfs:label', 'claimed'),
      annotation('dcterms:source', 'two'),
      annotation('skos:altLabel', 'three'),
    ];

    expect(unnamedAnnotations(spare, ENTITY_FIELDS).map((item) => item.value)).toEqual([
      'one',
      'two',
      'three',
    ]);
  });

  /* The two surfaces promote different terms, so the leftovers differ with them. */
  it('is judged against the fields actually on the form', () => {
    const title = annotation('dcterms:title', 'Vehicles');

    expect(unnamedAnnotations([title], SCHEMA_FIELDS)).toEqual([]);
    expect(unnamedAnnotations([title], ENTITY_FIELDS)).toEqual([title]);
  });
});

describe('the two sets of fields', () => {
  it('promote a term at most once each', () => {
    for (const fields of [SCHEMA_FIELDS, ENTITY_FIELDS]) {
      const terms = fields.map((field) => field.term);
      expect(new Set(terms).size).toBe(terms.length);
    }
  });

  it('can say whether a term has a field of its own', () => {
    expect(isNamedTerm('rdfs:label', ENTITY_FIELDS)).toBe(true);
    expect(isNamedTerm('rdfs:label', SCHEMA_FIELDS)).toBe(false);
  });
});
