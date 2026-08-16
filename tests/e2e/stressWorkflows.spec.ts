import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Parser } from 'n3';
import {
  addAnnotation,
  addAttribute,
  chooseExistingProperty,
  connectClasses,
  createObjectProperty,
  dragFromPalette,
  dragPropertyOntoClass,
  downloadExport,
  openApp,
  openInspectorTab,
  relate,
  selectClass,
} from './ontoschema';

/**
 * The awkward shapes, built through the real interface rather than assembled in memory:
 * a deep hierarchy, a diamond, one property pointing at several classes, a schema in many
 * scripts, and names chosen to collide.
 */

async function newClass(page: Page, name: string, x: number, y: number) {
  await dragFromPalette(page, 'class', { x, y });
  await page.locator('[data-class-node-id]').last().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill(name);
  await page.getByLabel('Class name').press('Enter');
  await expect(page.locator(`[data-class-name="${name}"]`)).toBeVisible();
}

async function setSuperclass(page: Page, child: string, parent: string) {
  await selectClass(page, child);
  await page.getByLabel('Superclass').selectOption({ label: parent });
}

test('builds a six-level hierarchy and lays it out as one module', async ({ page }) => {
  await openApp(page);

  const levels = ['Thing', 'Vehicle', 'MotorVehicle', 'Car', 'Hatchback', 'SuperMini'];
  for (const [index, name] of levels.entries()) {
    await newClass(page, name, 40 + (index % 3) * 260, 100 + Math.floor(index / 3) * 200);
  }
  for (let index = 1; index < levels.length; index += 1) {
    await setSuperclass(page, levels[index]!, levels[index - 1]!);
  }

  await page.getByRole('tab', { name: 'Taxonomy' }).click();
  // One root means one module box holding the whole spine.
  await expect(page.locator('[data-taxonomy-module]')).toHaveCount(1);
  await expect(page.locator('[data-taxonomy-module="Thing"]')).toHaveAttribute(
    'data-member-count',
    '6',
  );

  // Each level is laid out below the one above it.
  const tops: number[] = [];
  for (const name of levels) {
    const box = await page.locator(`[data-taxonomy-class="${name}"]`).boundingBox();
    tops.push(box?.y ?? 0);
  }
  for (let index = 1; index < tops.length; index += 1) {
    expect(tops[index], `${levels[index]} sits below ${levels[index - 1]}`).toBeGreaterThan(
      tops[index - 1]!,
    );
  }

  const turtle = await downloadExport(page, 'ttl');
  expect((turtle.match(/rdfs:subClassOf/g) ?? []).length).toBe(5);
});

test('refuses a superclass that would close a cycle', async ({ page }) => {
  await openApp(page);
  await newClass(page, 'Vehicle', 40, 100);
  await newClass(page, 'Car', 340, 100);
  await setSuperclass(page, 'Car', 'Vehicle');

  // Vehicle is above Car, so Car must not be offered as Vehicle's parent.
  await selectClass(page, 'Vehicle');
  const options = await page.getByLabel('Superclass').locator('option').allTextContents();
  expect(options).not.toContain('Car');

  const turtle = await downloadExport(page, 'ttl');
  expect((turtle.match(/rdfs:subClassOf/g) ?? []).length).toBe(1);
});

test('builds a diamond and keeps both inheritance paths', async ({ page }) => {
  await openApp(page);
  for (const [index, name] of ['Vehicle', 'Car', 'Boat', 'Amphibious'].entries()) {
    await newClass(page, name, 40 + (index % 2) * 300, 100 + Math.floor(index / 2) * 220);
  }

  await setSuperclass(page, 'Car', 'Vehicle');
  await setSuperclass(page, 'Boat', 'Vehicle');
  await setSuperclass(page, 'Amphibious', 'Car');

  // The picker sets a single parent; the tree panel is where a second one is added.
  await page.getByRole('tab', { name: 'Classes' }).click();
  await expect(page.locator('[data-tree-item="Amphibious"]')).toBeVisible();

  await page.getByRole('tab', { name: 'Taxonomy' }).click();
  await expect(page.locator('[data-taxonomy-module="Vehicle"]')).toHaveAttribute(
    'data-member-count',
    '4',
  );
});

test('points one property at three different classes and exports a disjunction', async ({
  page,
}) => {
  await openApp(page);
  for (const [index, name] of ['Car', 'Wheel', 'Door', 'Engine'].entries()) {
    await newClass(page, name, 40 + (index % 2) * 320, 100 + Math.floor(index / 2) * 220);
  }

  await createObjectProperty(page, 'hasPart');
  for (const target of ['Wheel', 'Door', 'Engine']) {
    await connectClasses(page, 'Car', target);
    await chooseExistingProperty(page, 'hasPart');
  }

  await expect(page.locator('[data-relation-name="hasPart"]')).toHaveCount(3);

  const turtle = await downloadExport(page, 'ttl');
  const quads = new Parser({ format: 'text/turtle' }).parse(turtle);

  // Three separate property shapes on one path would be conjunctive; one sh:or is correct.
  const paths = quads.filter(
    (quad) =>
      quad.predicate.value === 'http://www.w3.org/ns/shacl#path' &&
      quad.object.value.endsWith('/hasPart'),
  );
  expect(paths).toHaveLength(1);
  expect(quads.some((quad) => quad.predicate.value === 'http://www.w3.org/ns/shacl#or')).toBe(true);

  // Reused, so RDFS states no domain rather than an intersection.
  const domains = quads.filter(
    (quad) =>
      quad.subject.value.endsWith('/hasPart') &&
      quad.predicate.value === 'http://www.w3.org/2000/01/rdf-schema#domain',
  );
  expect(domains).toHaveLength(0);
});

test('annotates in eight languages and round-trips every one', async ({ page }) => {
  await openApp(page);
  await newClass(page, 'Car', 60, 120);
  await selectClass(page, 'Car');

  const labels: [string, string][] = [
    ['Car', 'en'],
    ['Auto', 'nl'],
    ['Wagen', 'de'],
    ['Voiture', 'fr'],
    ['سيارة', 'ar'],
    ['מכונית', 'he'],
    ['汽車', 'zh'],
    ['車', 'ja'],
  ];
  for (const [value, language] of labels) {
    await addAnnotation(page, 'skos:altLabel', value, language);
  }

  const turtle = await downloadExport(page, 'ttl');
  const quads = new Parser({ format: 'text/turtle' }).parse(turtle);
  const altLabels = quads.filter(
    (quad) => quad.predicate.value === 'http://www.w3.org/2004/02/skos/core#altLabel',
  );

  expect(altLabels).toHaveLength(labels.length);
  for (const [value] of labels) {
    expect(
      altLabels.some((quad) => quad.object.value === value),
      `lost ${value}`,
    ).toBe(true);
  }
  // Tags are case-insensitive in RDF, so compare folded.
  const tags = altLabels.map((quad) =>
    quad.object.termType === 'Literal' ? quad.object.language.toLowerCase() : '',
  );
  // One tag per script the test carries, which is what it exists to stress: a language written in
  // Han characters and one written right to left.
  expect(tags).toContain('zh');
  expect(tags).toContain('ar');
});

test('survives text that would break a naive writer', async ({ page }) => {
  await openApp(page);
  await newClass(page, 'Car', 60, 120);
  await selectClass(page, 'Car');

  const awkward = 'A <heavy> "goods" vehicle & trailer — naïve café 汉字 🚗';
  await addAnnotation(page, 'skos:note', awkward, 'en');

  for (const extension of ['ttl', 'rdf', 'jsonld']) {
    const content = await downloadExport(page, extension);
    if (extension === 'rdf') {
      expect(content).toContain('&lt;heavy&gt;');
      expect(content).toContain('&amp;');
    }
    if (extension === 'ttl') {
      const quads = new Parser({ format: 'text/turtle' }).parse(content);
      expect(quads.some((quad) => quad.object.value === awkward)).toBe(true);
    }
  }
});

test('resolves names that collide once sanitised', async ({ page }) => {
  await openApp(page);

  for (const [index, typed] of ['Used Car', 'used car', 'used_car'].entries()) {
    await dragFromPalette(page, 'class', { x: 40 + index * 260, y: 120 });
    await page.locator('[data-class-node-id]').last().locator('header [title]').dblclick();
    await page.getByLabel('Class name').fill(typed);
    await page.getByLabel('Class name').press('Enter');
  }

  await expect(page.locator('[data-class-node-id]')).toHaveCount(3);
  const names = await page
    .locator('[data-class-node-id]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-class-name')));
  // All three normalise to UsedCar, so two must have been given distinct names.
  expect(new Set(names).size).toBe(3);
  expect(names).toContain('UsedCar');

  const turtle = await downloadExport(page, 'ttl');
  const subjects = new Parser({ format: 'text/turtle' })
    .parse(turtle)
    .filter((quad) => quad.predicate.value.endsWith('22-rdf-syntax-ns#type'))
    .map((quad) => quad.subject.value);
  expect(new Set(subjects).size).toBe(subjects.length);
});

test('reuses one datatype property across five classes', async ({ page }) => {
  await openApp(page);
  await newClass(page, 'Car', 40, 120);
  await selectClass(page, 'Car');
  await addAttribute(page, 'price', 'decimal');

  const others = ['Boat', 'Bicycle', 'House', 'Painting'];
  for (const [index, name] of others.entries()) {
    await newClass(
      page,
      name,
      40 + ((index + 1) % 3) * 260,
      120 + Math.floor((index + 1) / 3) * 200,
    );
    await dragPropertyOntoClass(page, 'price', name);
  }

  await expect(page.locator('[data-datatype-property="price"]')).toContainText('5×');

  const turtle = await downloadExport(page, 'ttl');
  const quads = new Parser({ format: 'text/turtle' }).parse(turtle);

  // One property, five shapes, no domain.
  expect(
    quads.filter(
      (quad) =>
        quad.predicate.value === 'http://www.w3.org/ns/shacl#path' &&
        quad.object.value.endsWith('/price'),
    ),
  ).toHaveLength(5);
  expect(
    quads.filter(
      (quad) =>
        quad.subject.value.endsWith('/price') &&
        quad.predicate.value === 'http://www.w3.org/2000/01/rdf-schema#domain',
    ),
  ).toHaveLength(0);
  // The xsd range is the same wherever it is used, so that one survives.
  expect(
    quads.some(
      (quad) =>
        quad.subject.value.endsWith('/price') &&
        quad.predicate.value === 'http://www.w3.org/2000/01/rdf-schema#range',
    ),
  ).toBe(true);
});

test('deleting a class in the middle of a hierarchy re-roots its children', async ({ page }) => {
  await openApp(page);
  for (const [index, name] of ['Thing', 'Vehicle', 'Car'].entries()) {
    await newClass(page, name, 40 + index * 260, 120);
  }
  await setSuperclass(page, 'Vehicle', 'Thing');
  await setSuperclass(page, 'Car', 'Vehicle');

  await selectClass(page, 'Vehicle');
  await page.getByRole('button', { name: 'Delete class' }).click();

  await expect(page.locator('[data-class-name="Vehicle"]')).toHaveCount(0);
  await expect(page.locator('[data-class-name="Car"]')).toBeVisible();

  // Car loses its parent rather than dangling off a class that no longer exists.
  await page.getByRole('tab', { name: 'Taxonomy' }).click();
  await expect(page.locator('[data-taxonomy-module]')).toHaveCount(2);

  const turtle = await downloadExport(page, 'ttl');
  expect(turtle).not.toContain(':Vehicle');
  expect((turtle.match(/rdfs:subClassOf/g) ?? []).length).toBe(0);
});

test('a long editing session stays coherent and undoes cleanly', async ({ page }) => {
  await openApp(page);
  await openInspectorTab(page, 'Ontology');
  await page.getByLabel('Base IRI').fill('https://example.org/long/');

  await newClass(page, 'Car', 40, 120);
  await newClass(page, 'Dealership', 340, 120);
  await selectClass(page, 'Car');
  for (const [name, range] of [
    ['make', 'string'],
    ['year', 'integer'],
    ['price', 'decimal'],
  ] as const) {
    await addAttribute(page, name, range);
  }
  await relate(page, 'Car', 'Dealership', 'offeredBy');

  const built = await downloadExport(page, 'ttl');
  expect(built).toContain(':offeredBy');

  // Undo the relation, then the three attributes.
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole('button', { name: 'Undo' }).click();
  }
  await expect(page.locator('[data-class-name="Car"] [data-attribute-name]')).toHaveCount(0);
  await expect(page.locator('[data-relation-name]')).toHaveCount(0);

  for (let step = 0; step < 4; step += 1) {
    await page.getByRole('button', { name: 'Redo' }).click();
  }
  await expect(page.locator('[data-class-name="Car"] [data-attribute-name]')).toHaveCount(3);
  expect(await downloadExport(page, 'ttl')).toBe(built);
});
