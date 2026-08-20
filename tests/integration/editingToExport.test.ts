import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORAGE_KEY,
  clearWorkspace,
  flushWorkspace,
  useProjectStore,
} from '../../src/projectstore';
import {
  attributeUsagesOfClass,
  classForest,
  findClass,
  findRelation,
  relationUsagesTouchingClass,
  taxonomyModules,
  usagesOfProperty,
} from '../../src/ontologymodel';
import { serialize } from '../../src/serialization';
import {
  canonicalize,
  parseJsonLd,
  parseRdfXml,
  parseTurtle,
  unionMembers,
} from '../fixtures/parseRdf';
import { RDFS_DOMAIN, RDFS_RANGE } from '../../src/annotationvocabulary';

/** The namespace `buildAutomotiveProject` sets. */
const AUTO = 'https://example.org/auto/';

/**
 * Integration across the real module boundary: the store is driven exactly as the UI drives
 * it, the resulting model is projected to triples, and all four serializations are parsed
 * back with real parsers. Nothing is mocked — this is the pipeline the app actually runs.
 */

const store = () => useProjectStore.getState();
const ontology = () => {
  const state = useProjectStore.getState();
  const project = state.projects.find((candidate) => candidate.id === state.activeProjectId);
  if (!project) throw new Error('no active project');
  return project.ontology;
};

/** Builds the Car/Dealership scenario through store actions, as a user would. */
function buildAutomotiveProject() {
  store().newProject('Automotive Schema');
  store().setBaseIri('https://example.org/auto/');
  store().setPrefix('auto');

  const vehicle = store().createClass({ localName: 'Vehicle', position: { x: 0, y: 0 } });
  const car = store().createClass({ localName: 'Car', position: { x: 0, y: 200 } });
  const truck = store().createClass({ localName: 'Truck', position: { x: 260, y: 200 } });
  const dealership = store().createClass({ localName: 'Dealership', position: { x: 560, y: 200 } });

  store().reparentClass(car, vehicle);
  store().reparentClass(truck, vehicle);

  const make = store().createAttributeOn(car, { localName: 'make', range: 'string' });
  store().createAttributeOn(car, { localName: 'model', range: 'string' });
  const year = store().createAttributeOn(car, { localName: 'year', range: 'integer' });
  store().createAttributeOn(car, { localName: 'engine', range: 'string' });
  const price = store().createAttributeOn(car, { localName: 'price', range: 'decimal' });

  // Drawing an edge asks which property it is; here the user creates a new one.
  store().beginConnection({ subjectClassId: car, objectClassId: dealership });
  store().completeConnectionWithNewProperty('offeredBy');
  const offeredBy = ontology().relations.find((p) => p.localName === 'offeredBy')?.id ?? '';

  // Declared but never drawn, so it lives only in the property list.
  const hasPart = store().createRelation({ localName: 'hasPart' });

  store().annotate({ kind: 'class', id: car }, 'skos:prefLabel', 'Car', 'en');
  store().annotate({ kind: 'class', id: car }, 'skos:prefLabel', 'Auto', 'nl');
  store().annotate({ kind: 'ontology', id: '' }, 'dcterms:title', 'Automotive Schema', 'en');

  return { vehicle, car, truck, dealership, make, year, price, offeredBy, hasPart };
}

/**
 * The Turtle statement for one subject, up to its terminating period. Matching against the
 * whole document with a greedy pattern would happily run past the end of the statement and
 * pick up a predicate belonging to something else entirely.
 */
function statementFor(turtle: string, subject: string): string {
  const start = turtle.indexOf(`\n${subject} `);
  if (start < 0) return '';
  const end = turtle.indexOf('.\n', start);
  return turtle.slice(start, end < 0 ? undefined : end + 1);
}

beforeEach(() => {
  clearWorkspace();
  store().newProject('Test project');
  const stale = useProjectStore
    .getState()
    .projects.filter((project) => project.id !== useProjectStore.getState().activeProjectId);
  for (const project of stale) store().deleteProject(project.id);
});

describe('editing through the store reaches the model', () => {
  it('builds the Car/Dealership scenario end to end', () => {
    const ids = buildAutomotiveProject();
    const model = ontology();

    expect(model.classes.map((entity) => entity.localName).sort()).toEqual([
      'Car',
      'Dealership',
      'Truck',
      'Vehicle',
    ]);
    expect(attributeUsagesOfClass(model, ids.car)).toHaveLength(5);
    expect(usagesOfProperty(model, ids.offeredBy)).toHaveLength(1);
    expect(usagesOfProperty(model, ids.hasPart)).toHaveLength(0);

    const forest = classForest(model);
    expect(forest.map((node) => node.entity.localName).sort()).toEqual(['Dealership', 'Vehicle']);
    expect(taxonomyModules(model)).toHaveLength(2);
  });

  it('a drawn connection stays pending until a property is chosen', () => {
    const ids = buildAutomotiveProject();
    store().beginConnection({ subjectClassId: ids.dealership, objectClassId: ids.car });

    expect(useProjectStore.getState().pendingConnection).not.toBeNull();
    const before = ontology().usages.length;

    store().cancelConnection();
    expect(useProjectStore.getState().pendingConnection).toBeNull();
    expect(ontology().usages).toHaveLength(before);
  });

  it('reuses an existing relation rather than minting another one', () => {
    const ids = buildAutomotiveProject();
    const propertyCount = ontology().relations.length;

    store().beginConnection({ subjectClassId: ids.truck, objectClassId: ids.dealership });
    store().completeConnectionWith(ids.hasPart);

    expect(ontology().relations).toHaveLength(propertyCount);
    expect(usagesOfProperty(ontology(), ids.hasPart)).toHaveLength(1);
  });

  it('reuses a attribute on a second class', () => {
    const ids = buildAutomotiveProject();
    store().attachPropertyToClass(ids.price, ids.truck);

    expect(usagesOfProperty(ontology(), ids.price)).toHaveLength(2);
    expect(attributeUsagesOfClass(ontology(), ids.truck)).toHaveLength(1);
    // One property, not a copy.
    expect(ontology().attributes.filter((p) => p.localName === 'price')).toHaveLength(1);
  });

  it('detaching a property from a class leaves it in the pool', () => {
    const ids = buildAutomotiveProject();
    const usage = attributeUsagesOfClass(ontology(), ids.car).find(
      (entry) => entry.propertyId === ids.make,
    );
    store().detachUsageById(usage?.id ?? '');

    expect(attributeUsagesOfClass(ontology(), ids.car)).toHaveLength(4);
    expect(ontology().attributes.some((p) => p.id === ids.make)).toBe(true);
  });
});

describe('exports of a store-built ontology', () => {
  it('produces the same graph in all four serializations', async () => {
    buildAutomotiveProject();
    const model = ontology();

    const turtle = canonicalize(parseTurtle(serialize(model, 'turtle').content));
    const rdfxml = canonicalize(await parseRdfXml(serialize(model, 'rdfxml').content));
    const owl = canonicalize(await parseRdfXml(serialize(model, 'owl').content));
    const jsonld = canonicalize(await parseJsonLd(serialize(model, 'jsonld').content));

    expect(rdfxml).toEqual(turtle);
    expect(owl).toEqual(turtle);
    expect(jsonld).toEqual(turtle);
  });

  it('contains the axioms the workflow implies', () => {
    buildAutomotiveProject();
    const turtle = serialize(ontology(), 'turtle', 'auto', { includeShapes: false }).content;

    expect(turtle).toContain('auto:Car a owl:Class');
    expect(turtle).toMatch(/auto:Car[\s\S]*rdfs:subClassOf auto:Vehicle/);
    expect(turtle).toMatch(/auto:offeredBy[\s\S]*rdfs:domain auto:Car/);
    expect(turtle).toMatch(/auto:offeredBy[\s\S]*rdfs:range auto:Dealership/);
    expect(turtle).toMatch(/auto:year[\s\S]*rdfs:range xsd:integer/);
    expect(turtle).toContain('"Car"@en');
    expect(turtle).toContain('"Auto"@nl');
  });

  it('contains a SHACL shape for every usage', () => {
    const ids = buildAutomotiveProject();
    void ids;
    const turtle = serialize(ontology(), 'turtle', 'auto', { includeAxioms: false }).content;

    expect(turtle).toContain('auto:CarShape a sh:NodeShape');
    expect(turtle).toMatch(/sh:targetClass auto:Car/);
    expect(turtle).toMatch(/auto:Car_offeredBy[\s\S]*sh:class auto:Dealership/);
    expect(turtle).toMatch(/auto:Car_price[\s\S]*sh:datatype xsd:decimal/);
  });

  it('exports an empty project as a valid document with only the header', async () => {
    store().newProject('Empty');
    store().setBaseIri('https://example.org/empty/');
    const quads = parseTurtle(serialize(ontology(), 'turtle').content);
    expect(quads).toHaveLength(1);
    expect(quads[0]?.object.value).toBe('http://www.w3.org/2002/07/owl#Ontology');
  });
});

describe('reuse is expressed by shapes, not by contradictory axioms', () => {
  it('unions the domain once a property is used twice, and keeps a shape per class', async () => {
    const ids = buildAutomotiveProject();
    store().attachPropertyToClass(ids.price, ids.truck);
    const model = ontology();

    const axioms = serialize(model, 'turtle', 'auto', { includeShapes: false }).content;
    const priceStatement = statementFor(axioms, 'auto:price');
    // Saying it twice would mean intersection: every Car is also a Truck. A union is true.
    expect(priceStatement).toMatch(/rdfs:domain _:/);
    expect(axioms).toMatch(/owl:unionOf/);
    expect(unionMembers(parseTurtle(axioms), `${AUTO}price`, RDFS_DOMAIN)).toEqual([
      `${AUTO}Car`,
      `${AUTO}Truck`,
    ]);
    // The xsd range is the same wherever the property is used, so it survives.
    expect(priceStatement).toContain('rdfs:range xsd:decimal');

    const shapes = serialize(model, 'turtle', 'auto', { includeAxioms: false }).content;
    expect(shapes).toContain('auto:Car_price');
    expect(shapes).toContain('auto:Truck_price');

    // The whole thing is still one coherent graph in every format.
    const turtle = canonicalize(parseTurtle(serialize(model, 'turtle').content));
    expect(canonicalize(await parseRdfXml(serialize(model, 'rdfxml').content))).toEqual(turtle);
    expect(canonicalize(await parseJsonLd(serialize(model, 'jsonld').content))).toEqual(turtle);
  });

  it('keeps each class-to-class pairing distinct when a relation is reused', () => {
    const ids = buildAutomotiveProject();
    const garage = store().createClass({ localName: 'Garage' });
    store().beginConnection({ subjectClassId: ids.truck, objectClassId: garage });
    store().completeConnectionWith(ids.offeredBy);

    const shapes = serialize(ontology(), 'turtle', 'auto', { includeAxioms: false }).content;
    expect(shapes).toMatch(/auto:Car_offeredBy[\s\S]*sh:class auto:Dealership/);
    expect(shapes).toMatch(/auto:Truck_offeredBy[\s\S]*sh:class auto:Garage/);

    /*
     * The shapes above keep the pairings. The axioms cannot, and do not pretend to: the union
     * names both subjects and both objects, which licenses Car -> Garage as well. That loss is
     * the price of the ontology file standing on its own, and it is asserted here so it stays
     * a known cost rather than turning up later as a surprise.
     */
    const axioms = serialize(ontology(), 'turtle', 'auto', { includeShapes: false }).content;
    const statement = statementFor(axioms, 'auto:offeredBy');
    expect(statement).toContain('owl:ObjectProperty');
    const quads = parseTurtle(axioms);
    expect(unionMembers(quads, `${AUTO}offeredBy`, RDFS_DOMAIN)).toEqual([
      `${AUTO}Car`,
      `${AUTO}Truck`,
    ]);
    expect(unionMembers(quads, `${AUTO}offeredBy`, RDFS_RANGE)).toEqual([
      `${AUTO}Dealership`,
      `${AUTO}Garage`,
    ]);
  });
});

describe('destructive edits stay consistent all the way to the export', () => {
  it('deleting a class removes its usages but keeps the properties', async () => {
    const ids = buildAutomotiveProject();
    store().deleteClassById(ids.car);

    const model = ontology();
    expect(findClass(model, ids.car)).toBeUndefined();
    expect(usagesOfProperty(model, ids.offeredBy)).toHaveLength(0);
    expect(model.attributes).toHaveLength(5);

    const turtle = serialize(model, 'turtle').content;
    expect(turtle).not.toContain('auto:Car ');
    expect(turtle).toContain('auto:offeredBy');

    const parsed = canonicalize(parseTurtle(turtle));
    expect(canonicalize(await parseRdfXml(serialize(model, 'rdfxml').content))).toEqual(parsed);
    expect(canonicalize(await parseJsonLd(serialize(model, 'jsonld').content))).toEqual(parsed);
  });

  it('renaming a class rewrites every IRI that referred to it', () => {
    const ids = buildAutomotiveProject();
    store().renameClassById(ids.car, 'Automobile');

    const turtle = serialize(ontology(), 'turtle', 'auto', { includeShapes: false }).content;
    expect(turtle).toContain('auto:Automobile');
    expect(turtle).not.toMatch(/auto:Car\b/);
    expect(turtle).toMatch(/auto:offeredBy[\s\S]*rdfs:domain auto:Automobile/);
  });

  it('renaming a class renames the shapes derived from it', () => {
    const ids = buildAutomotiveProject();
    store().renameClassById(ids.car, 'Automobile');
    const shapes = serialize(ontology(), 'turtle', 'auto', { includeAxioms: false }).content;
    expect(shapes).toContain('auto:AutomobileShape');
    expect(shapes).not.toContain('auto:CarShape');
  });

  it('sanitises a name with invalid IRI characters', () => {
    const ids = buildAutomotiveProject();
    store().renameClassById(ids.car, 'Used Car/Model');
    expect(findClass(ontology(), ids.car)?.localName).toBe('UsedCarModel');
    expect(serialize(ontology(), 'turtle').content).toContain('auto:UsedCarModel');
  });

  it('keeps a rename that would collide unique', () => {
    const ids = buildAutomotiveProject();
    store().renameClassById(ids.truck, 'Car');
    expect(findClass(ontology(), ids.truck)?.localName).toBe('Car2');
    expect(findClass(ontology(), ids.car)?.localName).toBe('Car');
  });

  it('changing the base IRI moves every entity and shape to the new namespace', () => {
    buildAutomotiveProject();
    store().setBaseIri('https://acme.example/vehicles#');
    const turtle = serialize(ontology(), 'turtle').content;
    expect(turtle).toContain('https://acme.example/vehicles#');
    expect(turtle).not.toContain('https://example.org/auto/');
  });
});

describe('undo and redo', () => {
  it('reverses a class creation and puts it back', () => {
    buildAutomotiveProject();
    const before = ontology().classes.length;

    store().createClass({ localName: 'Motorcycle' });
    expect(ontology().classes).toHaveLength(before + 1);

    store().undo();
    expect(ontology().classes).toHaveLength(before);

    store().redo();
    expect(ontology().classes.map((c) => c.localName)).toContain('Motorcycle');
  });

  it('restores a deleted class together with its usages', () => {
    const ids = buildAutomotiveProject();
    store().deleteClassById(ids.car);
    expect(ontology().usages).toHaveLength(0);

    store().undo();
    const model = ontology();
    expect(findClass(model, ids.car)).toBeDefined();
    expect(attributeUsagesOfClass(model, ids.car)).toHaveLength(5);
    expect(relationUsagesTouchingClass(model, ids.car)).toHaveLength(1);
  });

  it('undoes attaching a property without deleting the property itself', () => {
    const ids = buildAutomotiveProject();
    store().attachPropertyToClass(ids.price, ids.truck);
    store().undo();
    expect(usagesOfProperty(ontology(), ids.price)).toHaveLength(1);
    expect(ontology().attributes.some((p) => p.id === ids.price)).toBe(true);
  });

  it('does nothing when there is nothing to undo', () => {
    store().newProject('Fresh');
    const before = serialize(ontology(), 'turtle').content;
    store().undo();
    store().undo();
    expect(serialize(ontology(), 'turtle').content).toBe(before);
  });

  it('drops the redo stack once a new edit is made', () => {
    buildAutomotiveProject();
    store().createClass({ localName: 'Motorcycle' });
    store().undo();
    expect(store().canRedo()).toBe(true);

    store().createClass({ localName: 'Scooter' });
    expect(store().canRedo()).toBe(false);
    expect(ontology().classes.map((c) => c.localName)).toContain('Scooter');
    expect(ontology().classes.map((c) => c.localName)).not.toContain('Motorcycle');
  });

  it('does not record node dragging as an undo step', () => {
    const ids = buildAutomotiveProject();
    const depth = store().history.past.length;
    store().moveClassById(ids.car, { x: 999, y: 999 });
    expect(store().history.past.length).toBe(depth);
    expect(findClass(ontology(), ids.car)?.position).toEqual({ x: 999, y: 999 });
  });

  /*
   * Fields commit as you type so the canvas keeps up. Without coalescing that meant one
   * undo entry per keystroke, and a single sentence typed into an annotation would push
   * past HISTORY_LIMIT and silently discard every real step behind it.
   */
  it('records a rename typed letter by letter as one undo step', () => {
    const ids = buildAutomotiveProject();
    const depth = store().history.past.length;

    for (const partial of ['A', 'Au', 'Aut', 'Auto', 'Autom', 'Automobile']) {
      store().renameClassById(ids.car, partial);
    }

    expect(findClass(ontology(), ids.car)?.localName).toBe('Automobile');
    expect(store().history.past.length).toBe(depth + 1);

    // And one undo returns to the name from before the user started typing.
    store().undo();
    expect(findClass(ontology(), ids.car)?.localName).toBe('Car');
  });

  it('records a long annotation value as one undo step, preserving earlier history', () => {
    const ids = buildAutomotiveProject();
    store().annotate({ kind: 'class', id: ids.car }, 'skos:definition', '', 'en');
    const annotationId =
      findClass(ontology(), ids.car)?.annotations.find((a) => a.term === 'skos:definition')?.id ??
      '';
    const depth = store().history.past.length;

    const sentence = 'A road vehicle with four wheels powered by an internal combustion engine.';
    for (let length = 1; length <= sentence.length; length += 1) {
      store().editAnnotation({ kind: 'class', id: ids.car }, annotationId, {
        value: sentence.slice(0, length),
      });
    }

    expect(store().history.past.length).toBe(depth + 1);
    // The 70-odd keystrokes have not pushed the earlier steps off the end of the stack.
    expect(store().history.past.length).toBeLessThan(50);
  });

  it('keeps edits to different targets as separate undo steps', () => {
    const ids = buildAutomotiveProject();
    const depth = store().history.past.length;

    store().renameClassById(ids.car, 'Automobile');
    store().renameClassById(ids.truck, 'Lorry');

    expect(store().history.past.length).toBe(depth + 2);
    store().undo();
    expect(findClass(ontology(), ids.truck)?.localName).toBe('Truck');
    expect(findClass(ontology(), ids.car)?.localName).toBe('Automobile');
  });

  it('starts a fresh undo step when typing resumes after a pause', async () => {
    const ids = buildAutomotiveProject();
    const depth = store().history.past.length;

    store().renameClassById(ids.car, 'Auto');
    await new Promise((resolve) => setTimeout(resolve, 750));
    store().renameClassById(ids.car, 'Automobile');

    expect(store().history.past.length).toBe(depth + 2);
  });
});

describe('multiple projects', () => {
  it('keeps ontologies separate and switches between them', () => {
    const ids = buildAutomotiveProject();
    const automotiveId = useProjectStore.getState().activeProjectId ?? '';

    const secondId = store().newProject('Library Schema');
    store().setBaseIri('https://example.org/library/');
    store().setPrefix('lib');
    store().createClass({ localName: 'Book' });

    expect(ontology().classes.map((c) => c.localName)).toEqual(['Book']);
    expect(serialize(ontology(), 'turtle').content).toContain('lib:Book');

    store().switchProject(automotiveId);
    expect(findClass(ontology(), ids.car)?.localName).toBe('Car');

    store().switchProject(secondId);
    expect(ontology().classes.map((c) => c.localName)).toEqual(['Book']);
  });

  it('clears undo history when crossing projects', () => {
    buildAutomotiveProject();
    expect(store().canUndo()).toBe(true);
    store().newProject('Other');
    expect(store().canUndo()).toBe(false);
  });

  it('round-trips a project, usages included, through its file format', () => {
    const ids = buildAutomotiveProject();
    const file = store().exportProjectFile();
    expect(file).toBeTruthy();

    const importedId = store().importProject(file ?? '');
    expect(importedId).toBeTruthy();

    const restored = ontology();
    expect(restored.classes.map((c) => c.localName).sort()).toEqual([
      'Car',
      'Dealership',
      'Truck',
      'Vehicle',
    ]);
    expect(restored.attributes).toHaveLength(5);
    expect(restored.usages).toHaveLength(6);
    expect(findRelation(restored, ids.offeredBy)).toBeDefined();
    expect(serialize(restored, 'turtle').content).toContain('"Auto"@nl');
  });

  it('refuses a file that is not a project', () => {
    expect(store().importProject('not json at all')).toBeNull();
    expect(store().importProject('{"nope":true}')).toBeNull();
  });

  it('always leaves at least one project to edit', () => {
    const only = useProjectStore.getState().activeProjectId ?? '';
    store().deleteProject(only);
    expect(useProjectStore.getState().projects.length).toBeGreaterThan(0);
  });
});

describe('persistence', () => {
  it('writes the whole edited workspace to localStorage', () => {
    buildAutomotiveProject();
    flushWorkspace();

    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    expect(raw).toContain('Automotive Schema');
    expect(raw).toContain('offeredBy');
    expect(raw).toContain('usages');
  });

  it('batches the writes rather than storing on every edit', () => {
    const { car } = buildAutomotiveProject();
    flushWorkspace();

    const writes: string[] = [];
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((_key, value) => {
      writes.push(String(value));
    });

    // A rename commits on every keystroke, which is what made this expensive.
    for (const name of ['A', 'Au', 'Aut', 'Auto', 'Autom']) store().renameClassById(car, name);
    expect(writes, 'edits should not each reach storage').toEqual([]);

    flushWorkspace();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain('Autom');

    setItem.mockRestore();
  });

  it('writes immediately when a project is created, so a commit point is never pending', () => {
    buildAutomotiveProject();
    flushWorkspace();

    store().newProject('Second schema');
    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toContain('Second schema');
  });

  it('writes what is outstanding when the page is hidden', () => {
    const { car } = buildAutomotiveProject();
    flushWorkspace();
    store().renameClassById(car, 'Automobile');

    expect(globalThis.localStorage.getItem(STORAGE_KEY)).not.toContain('Automobile');

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toContain('Automobile');
  });

  it('survives a corrupt stored workspace instead of failing to start', async () => {
    globalThis.localStorage.setItem(STORAGE_KEY, '{ this is not json');
    const { loadWorkspace } = await import('../../src/projectstore');
    const workspace = loadWorkspace();
    expect(workspace.projects.length).toBeGreaterThan(0);
  });

  /*
   * Unversioned on purpose. A file carrying `version: 1` is refused now, because 1 predates
   * relations and attributes being renamed. What is left of the pre-usage-model path is the
   * shape held in local storage, which has no version field at all, so that is what this drives.
   */
  it('reconstructs usages from a document written before the usage model existed', async () => {
    const legacy = {
      project: {
        id: 'p1',
        name: 'Legacy',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        ontology: {
          iri: 'https://example.org/legacy/',
          prefix: 'leg',
          annotations: [],
          classes: [
            {
              id: 'c1',
              localName: 'Car',
              superClassIds: [],
              annotations: [],
              position: { x: 0, y: 0 },
            },
            {
              id: 'c2',
              localName: 'Dealership',
              superClassIds: [],
              annotations: [],
              position: { x: 200, y: 0 },
            },
          ],
          relations: [
            {
              id: 'o1',
              localName: 'offeredBy',
              kind: 'scoped',
              domainClassId: 'c1',
              rangeClassId: 'c2',
              superPropertyIds: [],
              annotations: [],
            },
          ],
          attributes: [
            {
              id: 'd1',
              localName: 'make',
              domainClassId: 'c1',
              range: 'string',
              superPropertyIds: [],
              annotations: [],
            },
          ],
        },
      },
    };

    const id = store().importProject(JSON.stringify(legacy));
    expect(id).toBeTruthy();

    const model = ontology();
    expect(model.usages).toHaveLength(2);
    expect(attributeUsagesOfClass(model, 'c1')).toHaveLength(1);
    expect(usagesOfProperty(model, 'o1')[0]?.objectClassId).toBe('c2');
    expect(serialize(model, 'turtle').content).toMatch(/leg:offeredBy[\s\S]*rdfs:domain leg:Car/);
  });
});
