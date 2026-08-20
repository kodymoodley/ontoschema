import { describe, expect, it } from 'vitest';
import { createEmptyOntology } from '../ontologymodel';
import type { ImportReport, Ontology } from '../ontologymodel';
import { projectNameFromFilename, summariseImport, worthReporting } from './importSummary';

const nothingDropped: ImportReport = {
  individuals: 0,
  classExpressions: 0,
  relationsWithoutBothEnds: 0,
  datatypesRewritten: 0,
};

const ontologyWith = (classes: number, relations: number, attributes: number): Ontology => ({
  ...createEmptyOntology('https://example.org/x/', 'x'),
  classes: Array.from({ length: classes }, (_, index) => ({
    id: `c${index}`,
    localName: `C${index}`,
    superClassIds: [],
    annotations: [],
    position: { x: 0, y: 0 },
  })),
  relations: Array.from({ length: relations }, (_, index) => ({
    id: `r${index}`,
    localName: `r${index}`,
    superPropertyIds: [],
    annotations: [],
  })),
  attributes: Array.from({ length: attributes }, (_, index) => ({
    id: `a${index}`,
    localName: `a${index}`,
    range: 'string' as const,
    superPropertyIds: [],
    annotations: [],
  })),
});

describe('what arrived', () => {
  it('counts the three kinds in one sentence', () => {
    const summary = summariseImport(ontologyWith(15, 6, 12), nothingDropped);
    expect(summary.kept).toBe('15 classes, 6 relations and 12 attributes.');
  });

  it('says one class rather than 1 classes', () => {
    const summary = summariseImport(ontologyWith(1, 1, 1), nothingDropped);
    expect(summary.kept).toBe('1 class, 1 relation and 1 attribute.');
  });

  it('is not worth showing when the whole file fitted', () => {
    expect(worthReporting(summariseImport(ontologyWith(3, 1, 2), nothingDropped))).toBe(false);
  });
});

describe('what was left behind', () => {
  it('names each kind, in words rather than vocabulary', () => {
    const summary = summariseImport(ontologyWith(2, 0, 0), {
      ...nothingDropped,
      individuals: 3,
      classExpressions: 1,
      relationsWithoutBothEnds: 2,
    });

    expect(summary.dropped).toHaveLength(3);
    expect(summary.dropped.join(' ')).toContain('3 individuals');
    expect(summary.dropped.join(' ')).toContain('2 relations that did not say which classes');
    // No jargon: someone who knows the term does not need it, and someone who does not is
    // helped by the description instead.
    expect(summary.dropped.join(' ')).not.toMatch(/owl:|rdfs:|Restriction|axiom/);
  });

  it('says nothing about a kind that was not dropped', () => {
    const summary = summariseImport(ontologyWith(2, 0, 0), {
      ...nothingDropped,
      individuals: 1,
    });
    expect(summary.dropped).toEqual([expect.stringContaining('1 individual')]);
  });
});

/*
 * A rewrite is not a drop, and reporting it as one would understate it. Something missing is
 * noticed; something quietly different is not, and is the thing that surprises people later.
 */
describe('what changed rather than went', () => {
  it('is kept apart from what was dropped', () => {
    const summary = summariseImport(ontologyWith(2, 0, 4), {
      ...nothingDropped,
      datatypesRewritten: 4,
    });

    expect(summary.dropped).toEqual([]);
    expect(summary.changed).toEqual([expect.stringContaining('4 attributes')]);
    expect(summary.changed[0]).toContain('text');
    expect(worthReporting(summary)).toBe(true);
  });
});

describe('naming the project after the file', () => {
  it.each([
    ['car-dealership.ttl', 'car-dealership'],
    ['Music library.rdf', 'Music library'],
    ['/home/kody/schemas/university.owl', 'university'],
    ['C:\\Users\\kody\\insurance.ttl', 'insurance'],
    ['no-extension', 'no-extension'],
    ['.ttl', '.ttl'],
  ])('turns %s into %s', (filename, expected) => {
    expect(projectNameFromFilename(filename)).toBe(expected);
  });

  it('falls back rather than naming a project nothing at all', () => {
    expect(projectNameFromFilename('   .ttl')).toBe('Untitled ontology');
  });
});
