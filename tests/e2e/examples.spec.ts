import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Parser } from 'n3';
import {
  downloadExport,
  downloadShapes,
  openApp,
  openExamples,
  closeMetadata,
  openMetadata,
  openSection,
  selectClass,
} from './ontoschema';

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
    expect(await downloadShapes(page), title).toContain('sh:NodeShape');
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
  await page.getByRole('button', { name: 'Add attribute to this class' }).click();
  await expect(page.locator('[data-class-name="Track"] [data-attribute-name]')).toHaveCount(7);
});

test('a reused property is saved with the pairings that RDFS cannot state', async ({ page }) => {
  await openApp(page);
  await openExample(page, 'Vehicle dealership');

  // `offeredBy` is drawn from Car, Truck and Motorcycle.
  await expect(page.locator('[data-relation-name="offeredBy"]')).toHaveCount(3);

  const turtle = await downloadExport(page, 'ttl');
  const quads = new Parser({ format: 'text/turtle' }).parse(turtle);

  /*
   * No domain at all, and that is the point. Three vehicle kinds offer, and `rdfs:domain` can
   * only say "one of these three" -- which licenses pairings nobody drew and takes a blank node
   * and an `rdf:first` chain to say. The shapes in this same file say exactly what was drawn.
   */
  const endsOf = (predicate: string) =>
    quads.filter(
      (quad) =>
        quad.subject.value.endsWith('/offeredBy') &&
        quad.predicate.value === `http://www.w3.org/2000/01/rdf-schema#${predicate}`,
    );

  expect(endsOf('domain')).toHaveLength(0);
  /*
   * The range survives, and that is the rule rather than an oversight: each end is judged on
   * its own, and all three vehicles offer to the one Dealership. An exact end is worth stating;
   * only the end that would have to be approximated is left to the shapes.
   */
  expect(endsOf('range')).toHaveLength(1);
  expect(endsOf('range')[0]?.object.value).toMatch(/\/Dealership$/);

  expect(quads.some((quad) => quad.predicate.value.endsWith('#unionOf'))).toBe(false);
  expect(quads.some((quad) => quad.object.termType === 'BlankNode')).toBe(false);

  const shapesInTheSavedFile = quads.filter(
    (quad) =>
      quad.predicate.value === 'http://www.w3.org/ns/shacl#path' &&
      quad.object.value.endsWith('/offeredBy'),
  );
  expect(shapesInTheSavedFile).toHaveLength(3);

  // And the shapes-only export is still there, for a validator that wants them alone.
  const shapeQuads = new Parser({ format: 'text/turtle' }).parse(await downloadShapes(page));
  const shapes = shapeQuads.filter(
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

  await openMetadata(page);
  await expect(page.getByLabel('Base IRI')).toHaveValue('https://example.org/cooking/');
  await expect(page.getByLabel('Prefix')).toHaveValue('cook');
  await closeMetadata(page);

  const turtle = await downloadExport(page, 'ttl');
  expect(turtle).toContain('"Recipe Collection"@en');
  expect(turtle).toContain('"Recept"@nl');
  expect(turtle).toContain('"Rezept"@de');
});

/*
 * The four Documentation fields, in the panel a newcomer actually reads.
 *
 * A unit test already holds every term in every example to having all four, but it checks the
 * model. What is being promised here is what the inspector shows: someone opens an example,
 * clicks a class, opens Documentation, and finds four filled boxes that demonstrate the
 * difference between a definition, a note and an example. Only a browser can answer that the
 * named fields read the terms the builder writes.
 */
test('an example fills in every documentation field, on a class and on an attribute', async ({
  page,
}) => {
  await openApp(page);
  await openExample(page, 'Music library');
  await selectClass(page, 'Track');
  await openSection(page, 'Documentation');

  const filled = async (label: string) => {
    const field = page.getByLabel(label, { exact: true });
    await expect(field).toBeVisible();
    return (await field.inputValue()).trim();
  };

  for (const label of ['Label', 'Definition', 'Comment', 'Example']) {
    expect(await filled(label), `${label} was empty on the Track class`).not.toBe('');
  }
  // The prose is about this class, not a placeholder repeated everywhere.
  expect(await filled('Definition')).toContain('recorded');

  // An attribute too, which is where the volume of this is and where it was missing entirely.
  await page.getByRole('button', { name: 'durationSeconds', exact: true }).click();
  await openSection(page, 'Documentation');
  for (const label of ['Label', 'Definition', 'Comment', 'Example']) {
    expect(await filled(label), `${label} was empty on the durationSeconds attribute`).not.toBe('');
  }
  // The label is the readable form of the name, which is what the builder derives.
  expect(await filled('Label')).toBe('Duration seconds');
});

test('two examples can be open at once without colliding', async ({ page }) => {
  await openApp(page);
  await openExample(page, 'Music library');
  await openExample(page, 'Insurance firm');

  const insurance = await downloadExport(page, 'ttl');
  expect(insurance).toContain('@prefix ins:');
  expect(insurance).not.toContain('@prefix mus:');

  await page.getByLabel('Active project').selectOption({ label: 'Music library' });
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

  await page.getByLabel('Active project').selectOption({ label: 'My schema' });
  await expect(page.locator('[data-class-node-id]')).toHaveCount(1);
});
