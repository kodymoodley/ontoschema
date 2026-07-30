import { expect, test } from '@playwright/test';
import { Parser } from 'n3';
import {
  addAnnotation,
  addAttribute,
  connectClasses,
  dragFromPalette,
  downloadExport,
  openApp,
  openInspectorTab,
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
  await page.locator('[data-class-node-id]').first().locator('header').dblclick();
  await page.getByLabel('Class name').fill('Car');
  await page.getByLabel('Class name').press('Enter');
  await page.locator('[data-class-node-id]').last().locator('header').dblclick();
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

  // 5. Connect Car -> Dealership; the direction sets domain and range.
  await connectClasses(page, 'Car', 'Dealership');
  const relationLabel = page.locator('[data-relation-name]');
  await expect(relationLabel).toHaveCount(1);
  await relationLabel.click();
  await page.getByLabel('Object property local name').fill('offeredBy');
  await expect(page.locator('[data-relation-name="offeredBy"]')).toBeVisible();
  await expect(page.getByLabel('Relation domain')).toHaveValue(/.+/);

  // 6. Annotate Car with skos:prefLabel in two languages.
  await selectClass(page, 'Car');
  await addAnnotation(page, 'skos:prefLabel', 'Car', 'en');
  await addAnnotation(page, 'skos:prefLabel', 'Auto', 'nl');

  // 7. Export Turtle and assert on the actual triples in the downloaded file.
  const turtle = await downloadExport(page, 'ttl');

  expect(turtle).toContain('@prefix auto: <https://example.org/auto/>');
  expect(turtle).toContain('auto:Car a owl:Class');
  expect(turtle).toContain('auto:Dealership a owl:Class');
  expect(turtle).toMatch(/auto:offeredBy[\s\S]*rdfs:domain auto:Car/);
  expect(turtle).toMatch(/auto:offeredBy[\s\S]*rdfs:range auto:Dealership/);
  expect(turtle).toMatch(/auto:year[\s\S]*rdfs:range xsd:integer/);
  expect(turtle).toMatch(/auto:price[\s\S]*rdfs:range xsd:decimal/);
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

  expect(
    has(
      'https://example.org/auto/offeredBy',
      'http://www.w3.org/2000/01/rdf-schema#domain',
      'https://example.org/auto/Car',
    ),
  ).toBe(true);
  expect(
    has(
      'https://example.org/auto/make',
      'http://www.w3.org/2000/01/rdf-schema#domain',
      'https://example.org/auto/Car',
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
  await page.locator('[data-class-node-id]').first().locator('header').dblclick();
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

  // Every format carries the same class and attribute.
  for (const content of [turtle, rdf, jsonld]) {
    expect(content).toContain('Car');
    expect(content).toContain('make');
  }
});

test('a generic object property is created from the palette and exported without domain or range', async ({
  page,
}) => {
  await openApp(page);
  await dragFromPalette(page, 'class', { x: 220, y: 160 });
  await dragFromPalette(page, 'genericProperty', { x: 220, y: 420 });

  const pill = page.locator('[data-generic-property-id]');
  await expect(pill).toHaveCount(1);
  await expect(pill).toContainText('generic · no domain or range');

  await pill.dblclick();
  await page.getByLabel('Generic property name').fill('hasPart');
  await page.getByLabel('Generic property name').press('Enter');

  const turtle = await downloadExport(page, 'ttl');
  expect(turtle).toMatch(/:hasPart a owl:ObjectProperty/);

  const hasPartBlock = turtle.slice(turtle.indexOf(':hasPart'));
  const statement = hasPartBlock.slice(0, hasPartBlock.indexOf('.') + 1);
  expect(statement).not.toContain('rdfs:domain');
  expect(statement).not.toContain('rdfs:range');
});

test('a datatype property dropped onto a class attaches to it', async ({ page }) => {
  await openApp(page);
  await dragFromPalette(page, 'class', { x: 260, y: 200 });
  await page.locator('[data-class-node-id]').first().locator('header').dblclick();
  await page.getByLabel('Class name').fill('Car');
  await page.getByLabel('Class name').press('Enter');

  await dragFromPalette(page, 'attribute', { onClass: 'Car' });

  const carNode = page.locator('[data-class-name="Car"]');
  await expect(carNode.locator('[data-attribute-name]')).toHaveCount(1);
  await expect(carNode.getByText('xsd:string')).toBeVisible();
});
