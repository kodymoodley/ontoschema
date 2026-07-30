import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from '../../src/projectstore';
import { clearWorkspace } from '../../src/projectstore';
import {
  attributesOfClass,
  classForest,
  findClass,
  findObjectProperty,
  relationsTouchingClass,
  taxonomyModules,
} from '../../src/ontologymodel';
import { serialize } from '../../src/serialization';
import { canonicalize, parseJsonLd, parseRdfXml, parseTurtle } from '../fixtures/parseRdf';

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

  const make = store().createDatatypeProperty({
    localName: 'make',
    domainClassId: car,
    range: 'string',
  });
  store().createDatatypeProperty({ localName: 'model', domainClassId: car, range: 'string' });
  const year = store().createDatatypeProperty({
    localName: 'year',
    domainClassId: car,
    range: 'integer',
  });
  store().createDatatypeProperty({ localName: 'engine', domainClassId: car, range: 'string' });
  const price = store().createDatatypeProperty({
    localName: 'price',
    domainClassId: car,
    range: 'decimal',
  });

  const offeredBy = store().createObjectProperty({
    localName: 'offeredBy',
    kind: 'scoped',
    domainClassId: car,
    rangeClassId: dealership,
  });
  const hasPart = store().createObjectProperty({ localName: 'hasPart', kind: 'generic' });

  store().annotate({ kind: 'class', id: car }, 'skos:prefLabel', 'Car', 'en');
  store().annotate({ kind: 'class', id: car }, 'skos:prefLabel', 'Auto', 'nl');
  store().annotate({ kind: 'ontology', id: '' }, 'dcterms:title', 'Automotive Schema', 'en');

  return { vehicle, car, truck, dealership, make, year, price, offeredBy, hasPart };
}

beforeEach(() => {
  clearWorkspace();
  // A fresh project per test; the store is a module singleton, as it is in the browser.
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
    expect(attributesOfClass(model, ids.car).map((a) => a.localName)).toEqual([
      'make',
      'model',
      'year',
      'engine',
      'price',
    ]);
    expect(findObjectProperty(model, ids.offeredBy)).toMatchObject({
      kind: 'scoped',
      domainClassId: ids.car,
      rangeClassId: ids.dealership,
    });
    expect(findObjectProperty(model, ids.hasPart)).toMatchObject({
      kind: 'generic',
      domainClassId: null,
      rangeClassId: null,
    });

    const forest = classForest(model);
    expect(forest.map((node) => node.entity.localName).sort()).toEqual(['Dealership', 'Vehicle']);
    expect(taxonomyModules(model)).toHaveLength(2);
  });

  it('a connection drawn on the canvas sets domain and range from its direction', () => {
    const ids = buildAutomotiveProject();
    const drawn = store().createObjectProperty({
      kind: 'scoped',
      domainClassId: ids.dealership,
      rangeClassId: ids.car,
    });
    expect(findObjectProperty(ontology(), drawn)).toMatchObject({
      domainClassId: ids.dealership,
      rangeClassId: ids.car,
    });
  });

  it('attaching a floating attribute to a class gives it a domain', () => {
    const ids = buildAutomotiveProject();
    const floating = store().createDatatypeProperty({ localName: 'vin' });
    expect(ontology().datatypeProperties.find((p) => p.id === floating)?.domainClassId).toBeNull();

    store().setAttributeDomain(floating, ids.car);
    expect(attributesOfClass(ontology(), ids.car).map((a) => a.localName)).toContain('vin');
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

  it('contains the triples the workflow implies', () => {
    buildAutomotiveProject();
    const turtle = serialize(ontology(), 'turtle').content;

    expect(turtle).toContain('auto:Car a owl:Class');
    expect(turtle).toMatch(/auto:Car[\s\S]*rdfs:subClassOf auto:Vehicle/);
    expect(turtle).toMatch(/auto:offeredBy[\s\S]*rdfs:domain auto:Car/);
    expect(turtle).toMatch(/auto:offeredBy[\s\S]*rdfs:range auto:Dealership/);
    expect(turtle).toMatch(/auto:year[\s\S]*rdfs:range xsd:integer/);
    expect(turtle).toContain('"Car"@en');
    expect(turtle).toContain('"Auto"@nl');
  });

  it('names downloads after the project', () => {
    buildAutomotiveProject();
    const model = ontology();
    expect(serialize(model, 'turtle', 'Automotive Schema').filename).toBe('Automotive-Schema.ttl');
    expect(serialize(model, 'owl', 'Automotive Schema').filename).toBe('Automotive-Schema.owl');
  });

  it('exports an empty project as a valid document with only the header', async () => {
    store().newProject('Empty');
    store().setBaseIri('https://example.org/empty/');
    const quads = parseTurtle(serialize(ontology(), 'turtle').content);
    expect(quads).toHaveLength(1);
    expect(quads[0]?.object.value).toBe('http://www.w3.org/2002/07/owl#Ontology');
  });
});

describe('destructive edits stay consistent all the way to the export', () => {
  it('deleting a class removes it, its attributes and its relations from the output', async () => {
    const ids = buildAutomotiveProject();
    store().deleteClassById(ids.car);

    const model = ontology();
    expect(findClass(model, ids.car)).toBeUndefined();
    expect(model.datatypeProperties).toHaveLength(0);
    expect(findObjectProperty(model, ids.offeredBy)).toBeUndefined();
    // The generic property never referenced Car, so it survives.
    expect(findObjectProperty(model, ids.hasPart)).toBeDefined();

    const turtle = serialize(model, 'turtle').content;
    expect(turtle).not.toContain('auto:Car');
    expect(turtle).not.toContain('auto:offeredBy');
    expect(turtle).toContain('auto:hasPart');

    // Still a valid, consistent graph in every format.
    const parsed = canonicalize(parseTurtle(turtle));
    expect(canonicalize(await parseRdfXml(serialize(model, 'rdfxml').content))).toEqual(parsed);
    expect(canonicalize(await parseJsonLd(serialize(model, 'jsonld').content))).toEqual(parsed);
  });

  it('renaming a class rewrites every IRI that referred to it', () => {
    const ids = buildAutomotiveProject();
    store().renameClassById(ids.car, 'Automobile');

    const turtle = serialize(ontology(), 'turtle').content;
    expect(turtle).toContain('auto:Automobile');
    expect(turtle).not.toMatch(/auto:Car\b/);
    expect(turtle).toMatch(/auto:offeredBy[\s\S]*rdfs:domain auto:Automobile/);
    expect(turtle).toMatch(/auto:make[\s\S]*rdfs:domain auto:Automobile/);
  });

  it('rejects a name with invalid IRI characters by sanitising it', () => {
    const ids = buildAutomotiveProject();
    store().renameClassById(ids.car, 'Used Car/Model');
    expect(findClass(ontology(), ids.car)?.localName).toBe('UsedCarModel');

    const turtle = serialize(ontology(), 'turtle').content;
    expect(turtle).toContain('auto:UsedCarModel');
  });

  it('keeps a rename that would collide unique', () => {
    const ids = buildAutomotiveProject();
    store().renameClassById(ids.truck, 'Car');
    expect(findClass(ontology(), ids.truck)?.localName).toBe('Car2');
    expect(findClass(ontology(), ids.car)?.localName).toBe('Car');
  });

  it('changing the base IRI moves every entity to the new namespace', () => {
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

  it('restores a deleted class together with its attributes and relations', () => {
    const ids = buildAutomotiveProject();
    store().deleteClassById(ids.car);
    expect(ontology().datatypeProperties).toHaveLength(0);

    store().undo();
    const model = ontology();
    expect(findClass(model, ids.car)).toBeDefined();
    expect(attributesOfClass(model, ids.car)).toHaveLength(5);
    expect(relationsTouchingClass(model, ids.car)).toHaveLength(1);
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
    expect(serialize(ontology(), 'turtle').content).toContain('auto:Car');

    store().switchProject(secondId);
    expect(ontology().classes.map((c) => c.localName)).toEqual(['Book']);
  });

  it('clears undo history when crossing projects, so undo cannot reach into another ontology', () => {
    buildAutomotiveProject();
    expect(store().canUndo()).toBe(true);
    store().newProject('Other');
    expect(store().canUndo()).toBe(false);
  });

  it('round-trips a project through its file format', () => {
    const ids = buildAutomotiveProject();
    const file = store().exportProjectFile();
    expect(file).toBeTruthy();

    const importedId = store().importProject(file ?? '');
    expect(importedId).toBeTruthy();
    // A fresh id, so re-importing never overwrites the original.
    expect(importedId).not.toBe(ids.car);

    const restored = ontology();
    expect(restored.classes.map((c) => c.localName).sort()).toEqual([
      'Car',
      'Dealership',
      'Truck',
      'Vehicle',
    ]);
    expect(restored.datatypeProperties).toHaveLength(5);
    expect(restored.objectProperties.find((p) => p.kind === 'generic')?.localName).toBe('hasPart');
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
    expect(useProjectStore.getState().activeProjectId).not.toBeNull();
  });
});

describe('persistence', () => {
  it('writes the workspace to localStorage as edits happen', () => {
    buildAutomotiveProject();
    const raw = globalThis.localStorage.getItem('ontoschema.workspace.v1');
    expect(raw).toBeTruthy();
    expect(raw).toContain('Automotive Schema');
    expect(raw).toContain('offeredBy');
  });

  it('survives a corrupt stored workspace instead of failing to start', async () => {
    globalThis.localStorage.setItem('ontoschema.workspace.v1', '{ this is not json');
    const { loadWorkspace } = await import('../../src/projectstore');
    const workspace = loadWorkspace();
    expect(workspace.projects.length).toBeGreaterThan(0);
    expect(workspace.activeProjectId).toBeTruthy();
  });
});
