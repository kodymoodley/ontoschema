import { describe, expect, it } from 'vitest';
import { EXAMPLES } from './index';
import { readableName } from './builder';
import type { Annotation, Ontology } from '../ontologymodel';

/**
 * Every term in every example carries all four Documentation fields.
 *
 * These schemas exist to be opened and read. Someone meeting the tool for the first time opens
 * one, clicks a class, and what the inspector shows them is the answer to "what am I supposed to
 * put here" — a panel of empty boxes teaches nothing, and four filled ones teach the difference
 * between a definition, a note and an example. The same four terms are also what a published
 * vocabulary is expected to carry, so an export from an example is worth looking at.
 *
 * Enforced here rather than trusted, because the failure is silent: an example with three of the
 * four looks completely normal until someone clicks the one term that is missing something.
 */

/** The Documentation section's text fields, in the order the inspector shows them. */
const FIELDS = ['rdfs:label', 'skos:definition', 'rdfs:comment', 'skos:example'] as const;

interface Term {
  what: string;
  localName: string;
  annotations: readonly Annotation[];
}

/** Every class, relation and attribute in one schema. */
function terms(ontology: Ontology): Term[] {
  return [
    ...ontology.classes.map((entity) => ({
      what: 'class',
      localName: entity.localName,
      annotations: entity.annotations,
    })),
    ...ontology.relations.map((entity) => ({
      what: 'relation',
      localName: entity.localName,
      annotations: entity.annotations,
    })),
    ...ontology.attributes.map((entity) => ({
      what: 'attribute',
      localName: entity.localName,
      annotations: entity.annotations,
    })),
  ];
}

const valueOf = (term: Term, field: string) =>
  term.annotations.find((annotation) => annotation.term === field)?.value ?? '';

describe.each(EXAMPLES.map((example) => [example.key, example] as const))(
  'the %s example',
  (_key, example) => {
    const built = example.build();
    const all = terms(built);

    it('has terms to document', () => {
      expect(all.length).toBeGreaterThan(20);
    });

    it.each(FIELDS)('fills in %s on every term', (field) => {
      const missing = all
        .filter((term) => valueOf(term, field).trim() === '')
        .map((term) => `${term.what} ${term.localName}`);
      expect(missing, `${field} is empty on: ${missing.join(', ')}`).toEqual([]);
    });

    /*
     * Prose, not a placeholder. A definition that repeats the name back teaches nothing, and it
     * is the shape an unfinished one takes: "Track title" defined as "The track title".
     */
    it('says something in each definition beyond the name', () => {
      const thin = all
        .filter((term) => {
          const definition = valueOf(term, 'skos:definition');
          const words = definition.split(/\s+/).filter(Boolean);
          return words.length < 4;
        })
        .map((term) => `${term.what} ${term.localName}`);
      expect(thin, `too short to be a definition: ${thin.join(', ')}`).toEqual([]);
    });

    /* An example has to be an instance, not the definition again in other words. */
    it('gives an example that is not the definition', () => {
      const echoes = all
        .filter((term) => valueOf(term, 'skos:example') === valueOf(term, 'skos:definition'))
        .map((term) => `${term.what} ${term.localName}`);
      expect(echoes).toEqual([]);
    });

    it('tags every piece of prose as English', () => {
      const untagged = all.flatMap((term) =>
        term.annotations
          .filter(
            (annotation) =>
              (FIELDS as readonly string[]).includes(annotation.term) && !annotation.language,
          )
          .map((annotation) => `${term.what} ${term.localName}: ${annotation.term}`),
      );
      expect(untagged).toEqual([]);
    });

    /* One value per field. A second would fall through to "Other properties" unexplained. */
    it('writes each field once', () => {
      const doubled = all.flatMap((term) =>
        FIELDS.filter(
          (field) => term.annotations.filter((annotation) => annotation.term === field).length > 1,
        ).map((field) => `${term.what} ${term.localName}: ${field}`),
      );
      expect(doubled).toEqual([]);
    });
  },
);

/**
 * The derived label is what a person would have typed, so it has to survive the shapes real
 * names take. Initialisms are the case the obvious rule gets wrong.
 */
describe('turning a local name into a label', () => {
  it.each([
    ['trackTitle', 'Track title'],
    ['durationSeconds', 'Duration seconds'],
    ['city', 'City'],
    ['Artist', 'Artist'],
    ['RecordLabel', 'Record label'],
    ['isSoldOut', 'Is sold out'],
    ['co2Emissions', 'Co2 emissions'],
    ['ISRC', 'ISRC'],
    ['httpEndpoint', 'Http endpoint'],
  ])('reads %s as "%s"', (name, expected) => {
    expect(readableName(name)).toBe(expected);
  });
});
