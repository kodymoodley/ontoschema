import { describe, expect, it } from 'vitest';
import { createEmptyOntology } from '../ontologymodel';
import { UNTITLED } from '../projectstore';
import type { ImportReport, Ontology } from '../ontologymodel';
import {
  projectNameFromFilename,
  savingWouldChange,
  summariseImport,
  worthReporting,
} from './importSummary';

const asWritten: ImportReport = { datatypesRewritten: 0, shapesNamed: [] };

const kept = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    subject: `https://example.org/x/thing${index}`,
    predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
    object: { type: 'iri' as const, value: 'https://example.org/x/Thing' },
  }));

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
    const summary = summariseImport(ontologyWith(15, 6, 12), asWritten);
    expect(summary.kept).toBe('15 classes, 6 relations and 12 attributes.');
  });

  it('says one class rather than 1 classes', () => {
    const summary = summariseImport(ontologyWith(1, 1, 1), asWritten);
    expect(summary.kept).toBe('1 class, 1 relation and 1 attribute.');
  });

  it('is not worth showing when the canvas shows the whole file', () => {
    expect(worthReporting(summariseImport(ontologyWith(3, 1, 2), asWritten))).toBe(false);
  });
});

describe('what the canvas does not show', () => {
  it('is counted in plain words, and said to be kept', () => {
    const summary = summariseImport({ ...ontologyWith(2, 0, 0), unmodelled: kept(3) }, asWritten);

    expect(summary.unshown).toContain('3 statements the canvas does not show');
    expect(summary.unshown).toContain('kept');
    // No jargon: someone who knows the term does not need it, and someone who does not is
    // helped by the description instead.
    expect(summary.unshown).not.toMatch(/owl:|rdfs:|Restriction|axiom|individual/);
  });

  it('says one statement rather than 1 statements', () => {
    const summary = summariseImport({ ...ontologyWith(1, 0, 0), unmodelled: kept(1) }, asWritten);
    expect(summary.unshown).toContain('1 statement the canvas');
  });

  it('is worth showing, but no reason to hold back saving, since saving writes it back', () => {
    const summary = summariseImport({ ...ontologyWith(1, 0, 0), unmodelled: kept(4) }, asWritten);

    expect(worthReporting(summary)).toBe(true);
    expect(savingWouldChange(summary)).toBe(false);
  });
});

/*
 * A shape written inline means the same once it has a name, but the new names show up in the
 * diff of the first save, and someone reviewing it should know why before they wonder.
 */
describe('shapes saved with a name they did not have', () => {
  it('are named, with what they are saved as, and said to mean the same', () => {
    const summary = summariseImport(ontologyWith(2, 1, 0), {
      ...asWritten,
      shapesNamed: ['Vehicle_ownedBy', 'Car_hasPart'],
    });

    expect(summary.named).toBe(
      '2 shapes written without a name are saved with one, such as Vehicle_ownedBy. What they check stays the same.',
    );
  });

  it('are worth showing, but no reason to hold back saving', () => {
    const summary = summariseImport(ontologyWith(2, 1, 0), {
      ...asWritten,
      shapesNamed: ['Vehicle_ownedBy'],
    });

    expect(summary.named).toContain('1 shape written without a name is saved with one');
    expect(worthReporting(summary)).toBe(true);
    expect(savingWouldChange(summary)).toBe(false);
  });
});

/*
 * A rewrite is not a drop, and reporting it as one would understate it. Something missing is
 * noticed; something quietly different is not, and is the thing that surprises people later.
 */
describe('what changed rather than stayed', () => {
  it('is kept apart from what the canvas does not show, and holds back saving', () => {
    const summary = summariseImport(ontologyWith(2, 0, 4), {
      ...asWritten,
      datatypesRewritten: 4,
    });

    expect(summary.unshown).toBeNull();
    expect(summary.changed).toEqual([expect.stringContaining('4 attributes')]);
    expect(summary.changed[0]).toContain('text');
    expect(worthReporting(summary)).toBe(true);
    expect(savingWouldChange(summary)).toBe(true);
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
    // The same default a new project gets, rather than a second spelling of it.
    expect(projectNameFromFilename('   .ttl')).toBe(UNTITLED);
  });
});
