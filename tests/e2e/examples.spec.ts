import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Parser } from 'n3';
import { unionMembers } from '../fixtures/parseRdf';
import { downloadExport, openApp, openExamples, openInspectorTab, selectClass } from './ontoschema';

/**
 * The examples are most people's first contact with the editor, so these check the thing
 * that matters: open one and it is immediately a working, laid-out, exportable schema.
 */

async function openExample(page: Page, title: string) {
  await openExamples(page);
  await expect(page.getByRole('dialog', { name: 'Open an example' })).toBeVisible();
  await page.getByText(title, { exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('every example opens, draws and exports', async ({ page }) => {
  await openApp(page);

  for (const title of [
    'Music library',
    'Recipes and cooking',
    'Vehicle dealership',
    'University',
    'Insurance firm',
  ]) {
    await openExample(page, title);

    // Classes are on the canvas, laid out rather than piled at the origin.
    const nodes = page.locator('[data-class-node-id]');
    await expect(nodes).not.toHaveCount(0);
    const boxes = await nodes.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return `${Math.round(rect.x)},${Math.round(rect.y)}`;
      }),
    );
    expect(new Set(boxes).size, `${title} stacks its classes`).toBe(boxes.length);

    // Relations are drawn, and every box carries attributes.
    await expect(page.locator('[data-relation-name]')).not.toHaveCount(0);
    await expect(page.locator('[data-attribute-name]')).not.toHaveCount(0);

    const turtle = await downloadExport(page, 'ttl');
    expect(() => new Parser({ format: 'text/turtle' }).parse(turtle), title).not.toThrow();
    expect(turtle, title).toContain('a owl:Class');
    expect(turtle, title).toContain('sh:NodeShape');
  }
});

test('the music example is immediately editable', async ({ page }) => {
  await openApp(page);
  await openExample(page, 'Music library');

  // Its taxonomy shows up in the tree and on the taxonomy canvas.
  await expect(page.locator('[data-tree-item="Artist"]')).toBeVisible();
  await expect(page.locator('[data-tree-item="Band"]')).toBeVisible();

  await page.getByRole('tab', { name: 'Taxonomy' }).click();
  await expect(page.locator('[data-taxonomy-module]')).not.toHaveCount(0);
  await page.getByRole('tab', { name: 'Schema' }).click();

  // And it can be edited like anything else.
  await selectClass(page, 'Track');
  await page.getByLabel('New attribute name').fill('keySignature');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('[data-class-name="Track"] [data-attribute-name]')).toHaveCount(7);
});

test('a reused property unions its domain and keeps a shape per class', async ({ page }) => {
  await openApp(page);
  await openExample(page, 'Vehicle dealership');

  // `offeredBy` is drawn from Car, Truck and Motorcycle.
  await expect(page.locator('[data-relation-name="offeredBy"]')).toHaveCount(3);

  const turtle = await downloadExport(page, 'ttl');
  const quads = new Parser({ format: 'text/turtle' }).parse(turtle);

  /*
   * Three vehicle kinds offer, so the domain is the union of the three. It has to be an
   * anonymous class: a named one parses back as a class with no union in it at all.
   */
  const [domain] = quads.filter(
    (quad) =>
      quad.subject.value.endsWith('/offeredBy') &&
      quad.predicate.value === 'http://www.w3.org/2000/01/rdf-schema#domain',
  );
  expect(domain?.object.termType).toBe('BlankNode');
  expect(unionMembers(quads, domain!.subject.value, domain!.predicate.value)).toHaveLength(3);

  const shapes = quads.filter(
    (quad) =>
      quad.predicate.value === 'http://www.w3.org/ns/shacl#path' &&
      quad.object.value.endsWith('/offeredBy'),
  );
  expect(shapes).toHaveLength(3);
});

test('the university example draws a course pointing at itself', async ({ page }) => {
  await openApp(page);
  await openExample(page, 'University');

  await expect(page.locator('[data-relation-name="prerequisiteOf"]')).toBeVisible();

  const turtle = await downloadExport(page, 'ttl');
  const quads = new Parser({ format: 'text/turtle' }).parse(turtle);
  const domain = quads.find(
    (quad) =>
      quad.subject.value.endsWith('/prerequisiteOf') &&
      quad.predicate.value === 'http://www.w3.org/2000/01/rdf-schema#domain',
  );
  const range = quads.find(
    (quad) =>
      quad.subject.value.endsWith('/prerequisiteOf') &&
      quad.predicate.value === 'http://www.w3.org/2000/01/rdf-schema#range',
  );
  expect(domain?.object.value).toBe(range?.object.value);
});

test('an example carries its metadata and language tags', async ({ page }) => {
  await openApp(page);
  await openExample(page, 'Recipes and cooking');

  await openInspectorTab(page, 'Ontology');
  await expect(page.getByLabel('Base IRI')).toHaveValue('https://example.org/cooking/');
  await expect(page.getByLabel('Prefix')).toHaveValue('cook');

  const turtle = await downloadExport(page, 'ttl');
  expect(turtle).toContain('"Recipe Collection"@en');
  expect(turtle).toContain('"Recept"@nl');
  expect(turtle).toContain('"Rezept"@de');
});

test('two examples can be open at once without colliding', async ({ page }) => {
  await openApp(page);
  await openExample(page, 'Music library');
  await openExample(page, 'Insurance firm');

  const insurance = await downloadExport(page, 'ttl');
  expect(insurance).toContain('@prefix ins:');
  expect(insurance).not.toContain('@prefix mus:');

  await page.getByLabel('Active ontology project').selectOption({ label: 'Music library' });
  const music = await downloadExport(page, 'ttl');
  expect(music).toContain('@prefix mus:');
  expect(music).toContain('Album');
});

test('opening an example does not clear work already in progress', async ({ page }) => {
  await openApp(page);
  await page.getByLabel('Project name').fill('My schema');
  await page.locator('[data-palette-kind="class"]').click();
  await expect(page.locator('[data-class-node-id]')).toHaveCount(1);

  await openExample(page, 'University');
  await expect(page.locator('[data-class-name="Student"]')).toBeVisible();

  await page.getByLabel('Active ontology project').selectOption({ label: 'My schema' });
  await expect(page.locator('[data-class-node-id]')).toHaveCount(1);
});
