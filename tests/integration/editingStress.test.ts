import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearWorkspace, useProjectStore } from '../../src/projectstore';
import { COALESCE_WINDOW_MS, HISTORY_LIMIT } from '../../src/projectstore/history';
import {
  classForest,
  entityIri,
  relationUsages,
  rootClasses,
  validateLocalName,
} from '../../src/ontologymodel';
import type { Ontology } from '../../src/ontologymodel';
import { findAnnotationTerm, isXsdDatatype } from '../../src/annotationvocabulary';
import { serialize } from '../../src/serialization';
import { canonicalize, parseJsonLd, parseRdfXml, parseTurtle } from '../fixtures/parseRdf';
import { pick, seededRandom } from '../fixtures/scenarios';

const store = () => useProjectStore.getState();
const ontology = (): Ontology => {
  const state = useProjectStore.getState();
  const project = state.projects.find((candidate) => candidate.id === state.activeProjectId);
  if (!project) throw new Error('no active project');
  return project.ontology;
};

beforeEach(() => {
  clearWorkspace();
  store().newProject('Stress');
  for (const project of store().projects.filter((p) => p.id !== store().activeProjectId)) {
    store().deleteProject(project.id);
  }
});

/**
 * Properties that must hold after *any* sequence of edits, however arrived at. These are
 * the things a user would call corruption.
 */
function assertConsistent(model: Ontology, context: string): void {
  const classIds = new Set(model.classes.map((entity) => entity.id));
  const propertyIds = new Set([
    ...model.objectProperties.map((entity) => entity.id),
    ...model.datatypeProperties.map((entity) => entity.id),
  ]);

  for (const usage of model.usages) {
    expect(propertyIds.has(usage.propertyId), `${context}: usage of a deleted property`).toBe(true);
    expect(classIds.has(usage.subjectClassId), `${context}: usage on a deleted class`).toBe(true);
    if (usage.objectClassId !== null) {
      expect(
        classIds.has(usage.objectClassId),
        `${context}: usage pointing at a deleted class`,
      ).toBe(true);
    }
  }

  for (const entity of model.classes) {
    for (const parentId of entity.superClassIds) {
      expect(classIds.has(parentId), `${context}: subclass of a deleted class`).toBe(true);
    }
    expect(entity.superClassIds).not.toContain(entity.id);
  }

  const names = [
    ...model.classes.map((e) => e.localName),
    ...model.objectProperties.map((e) => e.localName),
    ...model.datatypeProperties.map((e) => e.localName),
  ];
  for (const name of names) {
    expect(validateLocalName(name).valid, `${context}: illegal local name "${name}"`).toBe(true);
  }
  const iris = names.map((name) => entityIri(model.iri, name));
  expect(new Set(iris).size, `${context}: duplicate IRI`).toBe(iris.length);

  // The forest terminates and covers every class exactly once at the top level.
  expect(() => JSON.stringify(classForest(model))).not.toThrow();
  expect(classForest(model)).toHaveLength(rootClasses(model).length);

  /*
   * Every class appears in the forest, exactly once. Counting only the roots misses the
   * corruption that matters: two classes made parents of each other are neither roots nor
   * anyone's descendant, so they vanish from the tree while both counts still agree.
   */
  const seen: string[] = [];
  const walk = (nodes: { entity: { id: string }; children: unknown[] }[]) => {
    for (const node of nodes) {
      seen.push(node.entity.id);
      walk(node.children as { entity: { id: string }; children: unknown[] }[]);
    }
  };
  walk(classForest(model) as { entity: { id: string }; children: unknown[] }[]);
  expect(new Set(seen).size, `${context}: a class appears twice in the hierarchy`).toBe(
    seen.length,
  );
  expect(seen.length, `${context}: a class is missing from the hierarchy`).toBe(
    model.classes.length,
  );

  // A range the model does not recognise would export as a broken datatype IRI.
  for (const property of model.datatypeProperties) {
    expect(isXsdDatatype(property.range), `${context}: unknown range "${property.range}"`).toBe(
      true,
    );
  }

  // Annotations are addressed by term, so an unknown one has nowhere to go on export.
  const annotated = [
    ...model.classes,
    ...model.objectProperties,
    ...model.datatypeProperties,
    { annotations: model.annotations },
  ];
  for (const entity of annotated) {
    for (const annotation of entity.annotations) {
      expect(
        findAnnotationTerm(annotation.term),
        `${context}: unknown annotation term "${annotation.term}"`,
      ).toBeDefined();
    }
  }
}

/*
 * The values an edit can reach for. Terms from three vocabularies with three shapes between
 * them — plain text, a date, an IRI — because the writers treat those differently and a fuzz
 * run that only ever wrote plain text would never find out.
 */
const XSD_RANGES = [
  'string',
  'integer',
  'decimal',
  'date',
  'dateTime',
  'boolean',
  'anyURI',
] as const;
const ANNOTATION_TERMS = ['rdfs:label', 'skos:definition', 'dcterms:created', 'rdfs:seeAlso'];
const LANGUAGES = [undefined, 'en', 'nl', 'pt-BR'];

/** One random, always-legal editing action. */
function applyRandomEdit(random: () => number, step: number): void {
  const model = ontology();
  const classes = model.classes;
  const properties = model.objectProperties;
  const attributes = model.datatypeProperties;
  const roll = random();

  if (roll < 0.18 || classes.length < 2) {
    store().createClass({ localName: `Class${step}` });
  } else if (roll < 0.34) {
    const target = pick(random, classes);
    if (target) store().createAttributeOn(target.id, { localName: `field${step}` });
  } else if (roll < 0.46) {
    store().createObjectProperty({ localName: `rel${step}` });
  } else if (roll < 0.6) {
    const subject = pick(random, classes);
    const object = pick(random, classes);
    const property = pick(random, properties);
    if (subject && object && property) {
      store().attachPropertyToClass(property.id, subject.id, object.id);
    }
  } else if (roll < 0.7) {
    const child = pick(random, classes);
    const parent = pick(random, classes);
    // Re-parenting refuses a cycle rather than creating one; either outcome is legal.
    if (child && parent) store().reparentClass(child.id, parent.id);
  } else if (roll < 0.76) {
    const target = pick(random, classes);
    if (target) store().renameClassById(target.id, `Renamed${step}`);
  } else if (roll < 0.8) {
    // Renaming a property reaches every class using it, which is why it is worth fuzzing.
    const target = pick(random, [...properties, ...attributes]);
    if (!target) return;
    if (properties.some((one) => one.id === target.id)) {
      store().renameObjectPropertyById(target.id, `renamed${step}`);
    } else {
      store().renameDatatypePropertyById(target.id, `renamed${step}`);
    }
  } else if (roll < 0.83) {
    const target = pick(random, attributes);
    const range = pick(random, XSD_RANGES);
    if (target && range) store().setAttributeRange(target.id, range);
  } else if (roll < 0.87) {
    const subject = pick(random, [
      ...classes.map((entity) => ({ kind: 'class' as const, id: entity.id })),
      ...properties.map((entity) => ({ kind: 'objectProperty' as const, id: entity.id })),
      ...attributes.map((entity) => ({ kind: 'datatypeProperty' as const, id: entity.id })),
    ]);
    const term = pick(random, ANNOTATION_TERMS);
    if (subject && term) store().annotate(subject, term, `note ${step}`, pick(random, LANGUAGES));
  } else if (roll < 0.9) {
    const usage = pick(random, model.usages);
    if (usage) store().detachUsageById(usage.id);
  } else if (roll < 0.95) {
    const target = pick(random, classes);
    if (target && classes.length > 1) store().deleteClassById(target.id);
  } else {
    const target = pick(random, [...properties, ...attributes]);
    if (!target) return;
    if (properties.some((p) => p.id === target.id)) store().deleteObjectPropertyById(target.id);
    else store().deleteDatatypePropertyById(target.id);
  }
}

describe('a fuzzed editing session', () => {
  // Fixed seeds: a failure has to be replayable, or it is just noise.
  it.each([1, 7, 42, 1337, 90210])('stays consistent under seed %i', (seed) => {
    const random = seededRandom(seed);
    store().setBaseIri('https://example.org/fuzz/');
    store().setPrefix('fz');

    for (let step = 0; step < 120; step += 1) {
      applyRandomEdit(random, step);
      assertConsistent(ontology(), `seed ${seed} step ${step}`);
    }

    // A fuzz run that quietly did nothing would satisfy every invariant above, so check it
    // actually built a schema of some substance.
    const model = ontology();
    expect(model.classes.length, `seed ${seed} built nothing`).toBeGreaterThan(3);
    expect(model.usages.length, `seed ${seed} attached nothing`).toBeGreaterThan(3);
    expect(model.classes.some((entity) => entity.superClassIds.length > 0)).toBe(true);

    /*
     * A branch of the edit generator that never fires proves nothing, and the odds of one
     * going cold are easy to change by accident when the roll thresholds move. Annotations
     * are the rarest of them, so they stand in for the rest.
     */
    const annotations = [
      ...model.annotations,
      ...model.classes.flatMap((entity) => entity.annotations),
      ...model.objectProperties.flatMap((entity) => entity.annotations),
      ...model.datatypeProperties.flatMap((entity) => entity.annotations),
    ];
    expect(annotations.length, `seed ${seed} annotated nothing`).toBeGreaterThan(0);
    expect(
      annotations.some((annotation) => annotation.language !== undefined),
      `seed ${seed} never wrote a language tag`,
    ).toBe(true);

    // Whatever it built, it must still export as readable RDF.
    expect(() => parseTurtle(serialize(model, 'turtle').content)).not.toThrow();
  });

  it('exports the same graph in every format after a fuzzed session', async () => {
    const random = seededRandom(2024);
    for (let step = 0; step < 80; step += 1) applyRandomEdit(random, step);

    const model = ontology();
    const turtle = canonicalize(parseTurtle(serialize(model, 'turtle').content));
    expect(canonicalize(await parseRdfXml(serialize(model, 'rdfxml').content))).toEqual(turtle);
    expect(canonicalize(await parseJsonLd(serialize(model, 'jsonld').content))).toEqual(turtle);
  });

  it('round-trips a fuzzed project through its file format unchanged', () => {
    const random = seededRandom(555);
    for (let step = 0; step < 60; step += 1) applyRandomEdit(random, step);

    const before = serialize(ontology(), 'turtle').content;
    const file = store().exportProjectFile();
    expect(store().importProject(file ?? '')).toBeTruthy();

    expect(serialize(ontology(), 'turtle').content).toBe(before);
    assertConsistent(ontology(), 'after re-import');
  });
});

describe('undo and redo under stress', () => {
  it('walks all the way back to the start and forward again', () => {
    const random = seededRandom(31);
    const initial = serialize(ontology(), 'turtle').content;

    for (let step = 0; step < 40; step += 1) applyRandomEdit(random, step);
    const built = serialize(ontology(), 'turtle').content;
    expect(built).not.toBe(initial);

    let guard = 0;
    while (store().canUndo() && guard < 500) {
      store().undo();
      guard += 1;
      assertConsistent(ontology(), `undo ${guard}`);
    }
    expect(serialize(ontology(), 'turtle').content).toBe(initial);

    guard = 0;
    while (store().canRedo() && guard < 500) {
      store().redo();
      guard += 1;
      assertConsistent(ontology(), `redo ${guard}`);
    }
    expect(serialize(ontology(), 'turtle').content).toBe(built);
  });

  it('drops the redo branch when a new edit follows an undo', () => {
    const random = seededRandom(88);
    for (let step = 0; step < 20; step += 1) applyRandomEdit(random, step);

    store().undo();
    store().undo();
    expect(store().canRedo()).toBe(true);

    store().createClass({ localName: 'Branch' });
    expect(store().canRedo()).toBe(false);
    assertConsistent(ontology(), 'after branching');
  });
});

describe('destructive storms', () => {
  it('survives deleting every class one at a time', () => {
    const random = seededRandom(9);
    for (let step = 0; step < 60; step += 1) applyRandomEdit(random, step);

    let guard = 0;
    while (ontology().classes.length > 0 && guard < 200) {
      store().deleteClassById(ontology().classes[0]!.id);
      guard += 1;
      assertConsistent(ontology(), `delete ${guard}`);
    }

    const model = ontology();
    expect(model.classes).toHaveLength(0);
    // Usages cannot outlive their classes; the properties themselves remain in the pool.
    expect(model.usages).toHaveLength(0);
    expect(relationUsages(model)).toHaveLength(0);
    expect(() => parseTurtle(serialize(model, 'turtle').content)).not.toThrow();
  });

  it('survives renaming every class to the same thing', () => {
    for (let index = 0; index < 12; index += 1) {
      store().createClass({ localName: `Seed${index}` });
    }
    for (const entity of ontology().classes) {
      store().renameClassById(entity.id, 'Collide');
    }

    const names = ontology().classes.map((entity) => entity.localName);
    expect(new Set(names).size).toBe(names.length);
    assertConsistent(ontology(), 'after a rename storm');
  });

  it('keeps one property usable across many classes', () => {
    const shared = store().createObjectProperty({ localName: 'isRelatedTo' });
    const ids = Array.from({ length: 15 }, (_, index) =>
      store().createClass({ localName: `Node${index}` }),
    );
    for (let index = 0; index + 1 < ids.length; index += 1) {
      store().attachPropertyToClass(shared, ids[index]!, ids[index + 1]!);
    }

    assertConsistent(ontology(), 'after fanning one property out');
    const axioms = serialize(ontology(), 'turtle', 'x', { includeShapes: false }).content;
    // Used fourteen times, so RDFS cannot state a domain without lying.
    expect(axioms).not.toMatch(/isRelatedTo[\s\S]{0,80}rdfs:domain/);

    const shapes = serialize(ontology(), 'turtle', 'x', { includeAxioms: false }).content;
    expect((shapes.match(/sh:path/g) ?? []).length).toBe(14);
  });
});

/**
 * Typing commits on every keystroke, so the history merges a burst of them into one entry
 * rather than filling itself with a step per character. That merging is the subtlest part of
 * the undo stack: it has to leave one entry that restores the name as it was *before* the
 * burst, not as it was one character ago, and it must stop merging once the burst ends or a
 * different thing is renamed.
 */
describe('undo across a burst of typing', () => {
  const nameOf = (classId: string) =>
    ontology().classes.find((entity) => entity.id === classId)?.localName;

  it('takes one undo to reverse a name typed one character at a time', () => {
    const car = store().createClass({ localName: 'Car' });
    const before = store().canUndo();
    expect(before).toBe(true);

    for (const name of ['A', 'Au', 'Aut', 'Auto', 'Autom', 'Automo']) {
      store().renameClassById(car, name);
    }
    expect(nameOf(car)).toBe('Automo');

    store().undo();
    // Back to the name it had before the burst, not to 'Autom'.
    expect(nameOf(car)).toBe('Car');
  });

  it('keeps the bursts apart when two classes are renamed in turn', () => {
    const car = store().createClass({ localName: 'Car' });
    const van = store().createClass({ localName: 'Van' });

    for (const name of ['A', 'Au', 'Aut']) store().renameClassById(car, name);
    for (const name of ['B', 'Bu', 'Bus']) store().renameClassById(van, name);
    expect([nameOf(car), nameOf(van)]).toEqual(['Aut', 'Bus']);

    store().undo();
    expect([nameOf(car), nameOf(van)]).toEqual(['Aut', 'Van']);

    store().undo();
    expect([nameOf(car), nameOf(van)]).toEqual(['Car', 'Van']);
  });

  it('starts a new entry once the burst has stopped', () => {
    vi.useFakeTimers();
    try {
      const car = store().createClass({ localName: 'Car' });
      for (const name of ['A', 'Au', 'Aut']) store().renameClassById(car, name);

      // Long enough that the next keystroke reads as a fresh edit rather than the same one.
      vi.advanceTimersByTime(COALESCE_WINDOW_MS + 50);
      for (const name of ['Auto', 'Autom']) store().renameClassById(car, name);

      store().undo();
      expect(nameOf(car)).toBe('Aut');
      store().undo();
      expect(nameOf(car)).toBe('Car');
    } finally {
      vi.useRealTimers();
    }
  });

  it('rewinds a fuzzed session that includes bursts, all the way to the start', () => {
    const random = seededRandom(4242);
    const initial = serialize(ontology(), 'turtle').content;

    // Short enough to stay inside the history limit, so "all the way back" is reachable at all.
    for (let step = 0; step < 20; step += 1) {
      applyRandomEdit(random, step);
      // Every so often, type into whatever is there, the way a person renaming something does.
      const target = pick(random, ontology().classes);
      if (target && random() < 0.3) {
        for (const suffix of ['T', 'Ty', 'Typ', 'Type']) {
          store().renameClassById(target.id, `Step${step}${suffix}`);
        }
      }
    }
    const built = serialize(ontology(), 'turtle').content;
    expect(built).not.toBe(initial);

    let guard = 0;
    while (store().canUndo() && guard < 800) {
      store().undo();
      guard += 1;
      assertConsistent(ontology(), `burst undo ${guard}`);
    }
    expect(serialize(ontology(), 'turtle').content).toBe(initial);
  });

  it('keeps the most recent edits once the history is full, and stays consistent', () => {
    const random = seededRandom(555);
    for (let step = 0; step < HISTORY_LIMIT * 2; step += 1) applyRandomEdit(random, step);

    /*
     * Undo is bounded. Past the limit the oldest entries are dropped, so rewinding lands on
     * whatever the schema looked like `HISTORY_LIMIT` edits ago rather than on an empty
     * project — worth stating, because a test that only ever ran short sessions would leave
     * the impression that undo reaches the beginning of time.
     */
    let steps = 0;
    while (store().canUndo() && steps < HISTORY_LIMIT * 4) {
      store().undo();
      steps += 1;
      assertConsistent(ontology(), `bounded undo ${steps}`);
    }

    expect(steps).toBe(HISTORY_LIMIT);
    expect(
      ontology().classes.length,
      'rewound past the limit into an empty project',
    ).toBeGreaterThan(0);
  });
});
