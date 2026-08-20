import { expect, test } from '@playwright/test';
import { Parser } from 'n3';
import { unionMembers } from '../fixtures/parseRdf';
import {
  addAnnotation,
  addAttribute,
  chooseExistingProperty,
  connectClasses,
  createRelation,
  dragFromPalette,
  dragPropertyOntoClass,
  downloadExport,
  openApp,
  openInspectorTab,
  relate,
  renameClassOnCanvas,
  selectClass,
} from './ontoschema';

/**
 * The workflow from the product brief, performed the way a person would: drag shapes from
 * the palette, name them, add five typed attributes, draw a relation, annotate in two
 * languages, then download the Turtle and check the triples that come back out.
 */
test('build the Car/Dealership schema and export it as Turtle', async ({ page }) => {
  await openApp(page);

  // 1. Two classes, dragged from the palette onto the canvas.
  await dragFromPalette(page, 'class', { x: 60, y: 120 });
  await dragFromPalette(page, 'class', { x: 380, y: 120 });
  await expect(page.locator('[data-class-node-id]')).toHaveCount(2);

  // 2. Name them.
  await page.locator('[data-class-node-id]').first().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Car');
  await page.getByLabel('Class name').press('Enter');
  await page.locator('[data-class-node-id]').last().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Dealership');
  await page.getByLabel('Class name').press('Enter');

  await expect(page.locator('[data-class-name="Car"]')).toBeVisible();
  await expect(page.locator('[data-class-name="Dealership"]')).toBeVisible();

  // 3. Set the ontology namespace.
  await openInspectorTab(page, 'Ontology');
  await page.getByLabel('Base IRI').fill('https://example.org/auto/');
  await page.getByLabel('Prefix').fill('auto');

  // 4. Five typed attributes on Car.
  await selectClass(page, 'Car');
  await addAttribute(page, 'make', 'string');
  await addAttribute(page, 'model', 'string');
  await addAttribute(page, 'year', 'integer');
  await addAttribute(page, 'engine', 'string');
  await addAttribute(page, 'price', 'decimal');

  const carNode = page.locator('[data-class-name="Car"]');
  await expect(carNode.locator('[data-attribute-name]')).toHaveCount(5);
  await expect(carNode.getByText('xsd:integer')).toBeVisible();
  await expect(carNode.getByText('xsd:decimal')).toBeVisible();

  // 5. Connect Car -> Dealership and name the property.
  await relate(page, 'Car', 'Dealership', 'offeredBy');
  await expect(page.locator('[data-relation-name="offeredBy"]')).toBeVisible();

  // 6. Annotate Car with skos:prefLabel in two languages.
  await selectClass(page, 'Car');
  await addAnnotation(page, 'skos:prefLabel', 'Car', 'en');
  await addAnnotation(page, 'skos:prefLabel', 'Auto', 'nl');

  // 7. Export Turtle and assert on the actual triples in the downloaded file.
  const turtle = await downloadExport(page, 'ttl');

  expect(turtle).toContain('@prefix auto: <https://example.org/auto/>');
  expect(turtle).toContain('auto:Car a owl:Class');
  expect(turtle).toContain('auto:Dealership a owl:Class');
  expect(turtle).toContain('"Car"@en');
  expect(turtle).toContain('"Auto"@nl');

  // The file must be readable by a real RDF parser, not merely look right.
  const quads = new Parser({ format: 'text/turtle' }).parse(turtle);
  const has = (subject: string, predicate: string, object: string) =>
    quads.some(
      (quad) =>
        quad.subject.value === subject &&
        quad.predicate.value === predicate &&
        quad.object.value === object,
    );

  // Used once, so RDFS can state the domain and range truthfully.
  expect(
    has(
      'https://example.org/auto/offeredBy',
      'http://www.w3.org/2000/01/rdf-schema#domain',
      'https://example.org/auto/Car',
    ),
  ).toBe(true);
  expect(
    has(
      'https://example.org/auto/offeredBy',
      'http://www.w3.org/2000/01/rdf-schema#range',
      'https://example.org/auto/Dealership',
    ),
  ).toBe(true);
  expect(
    has(
      'https://example.org/auto/make',
      'http://www.w3.org/2000/01/rdf-schema#domain',
      'https://example.org/auto/Car',
    ),
  ).toBe(true);

  // And the same facts are carried precisely by the shapes.
  expect(
    has(
      'https://example.org/auto/CarShape',
      'http://www.w3.org/ns/shacl#targetClass',
      'https://example.org/auto/Car',
    ),
  ).toBe(true);
  expect(
    has(
      'https://example.org/auto/Car_offeredBy',
      'http://www.w3.org/ns/shacl#class',
      'https://example.org/auto/Dealership',
    ),
  ).toBe(true);

  const labels = quads.filter(
    (quad) => quad.predicate.value === 'http://www.w3.org/2004/02/skos/core#prefLabel',
  );
  expect(
    labels.map((quad) => (quad.object.termType === 'Literal' ? quad.object.language : '')).sort(),
  ).toEqual(['en', 'nl']);
});

test('all four serializations download and agree with each other', async ({ page }) => {
  await openApp(page);
  await dragFromPalette(page, 'class', { x: 240, y: 180 });
  await page.locator('[data-class-node-id]').first().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Car');
  await page.getByLabel('Class name').press('Enter');

  await selectClass(page, 'Car');
  await addAttribute(page, 'make', 'string');

  const turtle = await downloadExport(page, 'ttl');
  const rdf = await downloadExport(page, 'rdf');
  const owl = await downloadExport(page, 'owl');
  const jsonld = await downloadExport(page, 'jsonld');

  expect(turtle).toContain('a owl:Class');
  expect(rdf).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  expect(rdf).toContain('<owl:Class');
  // .rdf and .owl are the same bytes, offered under both extensions.
  expect(owl).toBe(rdf);

  const parsed = JSON.parse(jsonld) as { '@context': Record<string, string>; '@graph': unknown[] };
  expect(parsed['@graph'].length).toBeGreaterThan(0);
  expect(Object.keys(parsed['@context'])).toContain('owl');

  for (const content of [turtle, rdf, jsonld]) {
    expect(content).toContain('Car');
    expect(content).toContain('make');
  }
});

test('an relation stays off the canvas until it is used in a relation', async ({ page }) => {
  await openApp(page);
  await dragFromPalette(page, 'class', { x: 60, y: 120 });
  await page.locator('[data-class-node-id]').first().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Car');
  await page.getByLabel('Class name').press('Enter');
  await dragFromPalette(page, 'class', { x: 380, y: 120 });
  await page.locator('[data-class-node-id]').last().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Wheel');
  await page.getByLabel('Class name').press('Enter');

  await createRelation(page, 'hasPart');

  // It exists in the property list, marked unused, and nothing is drawn for it.
  await page.getByRole('tab', { name: 'Relation' }).click();
  await expect(page.locator('[data-tree-item="hasPart"]')).toBeVisible();
  await expect(page.locator('[data-tree-item="hasPart"]')).toContainText('unused');
  await expect(page.locator('[data-relation-name]')).toHaveCount(0);

  // Unused, so there is nothing to state a domain or a range from.
  const declaredOnly = await downloadExport(page, 'ttl');
  expect(declaredOnly).toContain(':hasPart a owl:ObjectProperty.');

  // Using it between two classes is what puts it on the canvas.
  await connectClasses(page, 'Car', 'Wheel');
  await chooseExistingProperty(page, 'hasPart');
  await expect(page.locator('[data-relation-name="hasPart"]')).toBeVisible();

  // Used exactly once, so RDFS can now state its domain and range truthfully.
  const used = await downloadExport(page, 'ttl');
  expect(used).toMatch(
    /:hasPart a owl:ObjectProperty;\s*rdfs:domain \w*:Car;\s*rdfs:range \w*:Wheel/,
  );
  expect(used).toMatch(/:Car_hasPart[\s\S]*sh:class \w*:Wheel/);
});

test('a attribute must be dropped onto a class, not onto empty canvas', async ({ page }) => {
  await openApp(page);
  await dragFromPalette(page, 'class', { x: 60, y: 120 });
  await page.locator('[data-class-node-id]').first().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Car');
  await page.getByLabel('Class name').press('Enter');

  // Dropping on empty canvas is refused and explained, and creates nothing.
  await dragFromPalette(page, 'attribute', { x: 520, y: 420 });
  await expect(page.getByTestId('drop-rejected')).toBeVisible();
  await expect(page.locator('[data-class-name="Car"] [data-attribute-name]')).toHaveCount(0);
  await expect(page.locator('[data-class-node-id]')).toHaveCount(1);

  // Dropping onto the class attaches it.
  await dragFromPalette(page, 'attribute', { onClass: 'Car' });
  await expect(page.locator('[data-class-name="Car"] [data-attribute-name]')).toHaveCount(1);
  await expect(page.locator('[data-class-name="Car"]').getByText('xsd:string')).toBeVisible();
});

test('a attribute is reused on a second class by dragging it from the list', async ({ page }) => {
  await openApp(page);
  await dragFromPalette(page, 'class', { x: 60, y: 120 });
  await page.locator('[data-class-node-id]').first().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Car');
  await page.getByLabel('Class name').press('Enter');
  await dragFromPalette(page, 'class', { x: 380, y: 120 });
  await page.locator('[data-class-node-id]').last().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Product');
  await page.getByLabel('Class name').press('Enter');

  await selectClass(page, 'Car');
  await addAttribute(page, 'price', 'decimal');

  await dragPropertyOntoClass(page, 'price', 'Product');

  // One property, used on two classes — not a duplicate.
  await expect(page.locator('[data-datatype-property="price"]')).toHaveCount(1);
  await expect(page.locator('[data-datatype-property="price"]')).toContainText('2×');
  await expect(page.locator('[data-class-name="Product"] [data-attribute-name]')).toHaveCount(1);

  const turtle = await downloadExport(page, 'ttl');
  const quads = new Parser({ format: 'text/turtle' }).parse(turtle);

  // Reused, so the domain is a union: repeating it would mean Car and Product are one thing.
  const [domain] = quads.filter(
    (quad) =>
      quad.subject.value.endsWith('/price') &&
      quad.predicate.value === 'http://www.w3.org/2000/01/rdf-schema#domain',
  );
  expect(domain?.object.termType).toBe('BlankNode');
  expect(unionMembers(quads, domain!.subject.value, domain!.predicate.value).sort()).toEqual([
    expect.stringContaining('/Car'),
    expect.stringContaining('/Product'),
  ]);

  // The per-class truth is in the shapes instead, one for each class.
  const paths = quads.filter(
    (quad) =>
      quad.predicate.value === 'http://www.w3.org/ns/shacl#path' &&
      quad.object.value.endsWith('/price'),
  );
  expect(paths).toHaveLength(2);
  expect(turtle).toContain('Car_price');
  expect(turtle).toContain('Product_price');
});

/**
 * The Mermaid export is the only one that is not RDF: a picture of the schema for pasting into a
 * document. It is checked here because a diagram that will not render is indistinguishable from
 * a correct one until something tries to draw it.
 */
test('the schema downloads as a Mermaid class diagram', async ({ page }) => {
  await openApp(page);
  await dragFromPalette(page, 'class', { x: 60, y: 120 });
  await renameClassOnCanvas(page, 'NewClass', 'Car');
  await selectClass(page, 'Car');
  await addAttribute(page, 'make', 'string');

  await dragFromPalette(page, 'class', { x: 420, y: 120 });
  await renameClassOnCanvas(page, 'NewClass', 'Dealership');
  await relate(page, 'Car', 'Dealership', 'offeredBy');

  const diagram = await downloadExport(page, 'mmd');

  expect(diagram.split('\n')[0]).toBe('classDiagram');
  expect(diagram).toContain('class Car {');
  expect(diagram).toContain('+string make');
  expect(diagram).toContain('Car --> Dealership : offeredBy');
  // No RDF leaks into the picture: it has no namespaces, prefixes or triples.
  expect(diagram).not.toContain('@prefix');
  expect(diagram).not.toContain('owl:');
});
