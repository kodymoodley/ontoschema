import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Parser } from 'n3';
import {
  addAnnotation,
  addAttribute,
  chooseProjectAction,
  downloadExport,
  downloadShapes,
  dragFromPalette,
  openApp,
  openExport,
  closeMetadata,
  openMetadata,
  relate,
  renameClassOnCanvas,
  selectClass,
} from './ontoschema';

/** Two named classes on the canvas — the starting point for most of these workflows. */
async function twoClasses(page: Page, first: string, second: string) {
  await dragFromPalette(page, 'class', { x: 60, y: 120 });
  await page.locator('[data-class-node-id]').first().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill(first);
  await page.getByLabel('Class name').press('Enter');

  await dragFromPalette(page, 'class', { x: 380, y: 120 });
  await page.locator('[data-class-node-id]').last().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill(second);
  await page.getByLabel('Class name').press('Enter');
}

test('a taxonomy is built in the hierarchy panel and laid out in the taxonomy view', async ({
  page,
}) => {
  await openApp(page);
  await twoClasses(page, 'Vehicle', 'Car');
  await dragFromPalette(page, 'class', { x: 60, y: 340 });
  await page.locator('[data-class-node-id]').last().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Truck');
  await page.getByLabel('Class name').press('Enter');

  // Put Car and Truck under Vehicle using the inspector's superclass picker.
  await selectClass(page, 'Car');
  await page.getByLabel('Superclass').selectOption({ label: 'Vehicle' });
  await selectClass(page, 'Truck');
  await page.getByLabel('Superclass').selectOption({ label: 'Vehicle' });

  // The hierarchy tree nests them under their parent.
  const tree = page.getByRole('tree', { name: 'Class hierarchy' });
  await expect(tree.locator('[data-tree-item="Vehicle"]')).toBeVisible();
  await expect(tree.locator('[data-tree-item="Car"]')).toBeVisible();
  await expect(tree.locator('[data-tree-item="Truck"]')).toBeVisible();

  // The taxonomy view groups the whole hierarchy into one module box.
  await page.getByRole('tab', { name: 'Taxonomy' }).click();
  await expect(page.getByTestId('taxonomy-canvas')).toBeVisible();
  await expect(page.locator('[data-taxonomy-class="Vehicle"]')).toBeVisible();
  await expect(page.locator('[data-taxonomy-class="Car"]')).toBeVisible();
  await expect(page.locator('[data-taxonomy-class="Truck"]')).toBeVisible();
  // One module, rooted at Vehicle, holding all three classes.
  await expect(page.locator('[data-taxonomy-module]')).toHaveCount(1);
  await expect(page.locator('[data-taxonomy-module="Vehicle"]')).toHaveAttribute(
    'data-member-count',
    '3',
  );

  // Subclasses are drawn below their superclass, which is what makes the view readable.
  const vehicle = await page.locator('[data-taxonomy-class="Vehicle"]').boundingBox();
  const car = await page.locator('[data-taxonomy-class="Car"]').boundingBox();
  expect(vehicle && car && car.y).toBeGreaterThan(vehicle?.y ?? 0);

  const turtle = await downloadExport(page, 'ttl');
  expect(turtle).toMatch(/:Car a owl:Class;\s*rdfs:subClassOf \w*:Vehicle/);
  expect(turtle).toMatch(/:Truck a owl:Class;\s*rdfs:subClassOf \w*:Vehicle/);
});

test('a second root class becomes its own taxonomy module', async ({ page }) => {
  await openApp(page);
  await twoClasses(page, 'Vehicle', 'Car');
  await dragFromPalette(page, 'class', { x: 60, y: 340 });
  await page.locator('[data-class-node-id]').last().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Organization');
  await page.getByLabel('Class name').press('Enter');

  await selectClass(page, 'Car');
  await page.getByLabel('Superclass').selectOption({ label: 'Vehicle' });

  await page.getByRole('tab', { name: 'Taxonomy' }).click();
  // Two independent roots, so two labelled bounding boxes rather than one tangled graph.
  await expect(page.locator('[data-taxonomy-module]')).toHaveCount(2);
  await expect(page.locator('[data-taxonomy-module="Vehicle"]')).toHaveAttribute(
    'data-member-count',
    '2',
  );
  await expect(page.locator('[data-taxonomy-module="Organization"]')).toHaveAttribute(
    'data-member-count',
    '1',
  );

  // The modules are laid out side by side, so unrelated branches never cross.
  const vehicleBox = await page.locator('[data-taxonomy-module="Vehicle"]').boundingBox();
  const orgBox = await page.locator('[data-taxonomy-module="Organization"]').boundingBox();
  expect(vehicleBox && orgBox && orgBox.x).toBeGreaterThan(vehicleBox?.x ?? 0);
});

test('deleting a class removes its attributes and relations from the export', async ({ page }) => {
  await openApp(page);
  await twoClasses(page, 'Car', 'Dealership');

  await selectClass(page, 'Car');
  await addAttribute(page, 'make', 'string');
  await addAttribute(page, 'price', 'decimal');
  await relate(page, 'Car', 'Dealership', 'offeredBy');
  await expect(page.locator('[data-relation-name]')).toHaveCount(1);

  const before = await downloadExport(page, 'ttl');
  expect(before).toContain(':Car ');
  expect(before).toContain(':make');

  await selectClass(page, 'Car');
  await page.getByRole('button', { name: 'Delete class' }).click();

  await expect(page.locator('[data-class-name="Car"]')).toHaveCount(0);
  await expect(page.locator('[data-class-name="Dealership"]')).toBeVisible();
  await expect(page.locator('[data-relation-name]')).toHaveCount(0);

  const after = await downloadExport(page, 'ttl');
  expect(after).not.toContain(':Car ');
  expect(await downloadShapes(page)).not.toContain('CarShape');
  expect(after).toContain(':Dealership');
  // The properties survive in the pool; only their uses went with the class.
  expect(after).toContain(':make a owl:DatatypeProperty');
  expect(after).toContain(':offeredBy a owl:ObjectProperty');
  // Still a well-formed document after the cascade.
  expect(() => new Parser({ format: 'text/turtle' }).parse(after)).not.toThrow();
});

test('a name field can be cleared and retyped, and flags itself while empty', async ({ page }) => {
  await openApp(page);
  await dragFromPalette(page, 'class', { x: 60, y: 120 });
  await page.locator('[data-class-node-id]').first().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Car');
  await page.getByLabel('Class name').press('Enter');
  await selectClass(page, 'Car');

  const field = page.getByLabel('Class local name');

  // Clearing it must actually clear it rather than snapping the old name back.
  await field.fill('');
  await expect(field).toHaveValue('');
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('A class needs a name.')).toBeVisible();
  // Nothing invalid reaches the model.
  await expect(page.locator('[data-class-name="Car"]')).toBeVisible();

  // Typing a fresh name from empty works and clears the invalid state.
  await field.fill('Automobile');
  await expect(field).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('[data-class-name="Automobile"]')).toBeVisible();

  const turtle = await downloadExport(page, 'ttl');
  expect(turtle).toContain(':Automobile a owl:Class');
});

test('renaming a class carries every reference with it', async ({ page }) => {
  await openApp(page);
  await twoClasses(page, 'Car', 'Dealership');
  await selectClass(page, 'Car');
  await addAttribute(page, 'make', 'string');
  await relate(page, 'Car', 'Dealership', 'offeredBy');

  await renameClassOnCanvas(page, 'Car', 'Automobile');

  const turtle = await downloadExport(page, 'ttl');
  expect(turtle).toContain(':Automobile a owl:Class');
  expect(turtle).not.toMatch(/:Car\b/);
  expect(turtle).toMatch(/rdfs:domain \w*:Automobile/);
  // The derived shapes follow the rename too.
  const shapes = await downloadShapes(page);
  expect(shapes).toContain(':AutomobileShape');
  expect(shapes).not.toContain(':CarShape');
});

test('a name with characters illegal in an IRI is corrected rather than exported broken', async ({
  page,
}) => {
  await openApp(page);
  await dragFromPalette(page, 'class', { x: 60, y: 120 });
  await page.locator('[data-class-node-id]').first().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Used Car/Model #1');
  await page.getByLabel('Class name').press('Enter');

  // Spaces and IRI-breaking characters are removed; the result is a legal local name.
  await expect(page.locator('[data-class-name="UsedCarModel1"]')).toBeVisible();

  const turtle = await downloadExport(page, 'ttl');
  expect(turtle).toContain(':UsedCarModel1');
  expect(() => new Parser({ format: 'text/turtle' }).parse(turtle)).not.toThrow();
});

test('an empty ontology exports a valid document containing only its header', async ({ page }) => {
  await openApp(page);
  await openExport(page);
  await expect(page.getByText(/no classes or properties yet/i)).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  const turtle = await downloadExport(page, 'ttl');
  const quads = new Parser({ format: 'text/turtle' }).parse(turtle);
  expect(quads).toHaveLength(1);
  expect(quads[0]?.object.value).toBe('http://www.w3.org/2002/07/owl#Ontology');
});

test('annotations in two languages survive a round trip through the export', async ({ page }) => {
  await openApp(page);
  await dragFromPalette(page, 'class', { x: 60, y: 120 });
  await page.locator('[data-class-node-id]').first().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Car');
  await page.getByLabel('Class name').press('Enter');

  await selectClass(page, 'Car');
  await addAnnotation(page, 'skos:prefLabel', 'Car', 'en');
  await addAnnotation(page, 'skos:prefLabel', 'Auto', 'nl');
  await addAnnotation(page, 'skos:definition', 'A road vehicle with four wheels.', 'en');
  await addAnnotation(page, 'dcterms:created', '2026-07-30');

  const turtle = await downloadExport(page, 'ttl');
  const quads = new Parser({ format: 'text/turtle' }).parse(turtle);

  const labels = quads.filter(
    (quad) => quad.predicate.value === 'http://www.w3.org/2004/02/skos/core#prefLabel',
  );
  expect(labels).toHaveLength(2);
  expect(
    labels.map((quad) => (quad.object.termType === 'Literal' ? quad.object.language : '')).sort(),
  ).toEqual(['en', 'nl']);

  // A date annotation is typed, not left as a plain string.
  const created = quads.find((quad) => quad.predicate.value === 'http://purl.org/dc/terms/created');
  expect(created?.object.termType).toBe('Literal');
  expect(turtle).toContain('xsd:date');
});

test('ontology-level metadata is exported on the ontology header', async ({ page }) => {
  await openApp(page);
  await openMetadata(page);
  await page.getByLabel('Base IRI').fill('https://example.org/auto/');
  await page.getByLabel('Prefix').fill('auto');

  await page.getByLabel('Annotation term to add').selectOption('dcterms:title');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page
    .locator('[data-annotation-term="dcterms:title"]')
    .getByLabel('dcterms:title value')
    .fill('Automotive Schema');
  await closeMetadata(page);

  const turtle = await downloadExport(page, 'ttl');
  expect(turtle).toContain('<https://example.org/auto> a owl:Ontology');
  expect(turtle).toContain('"Automotive Schema"');
});

test('undo and redo step through the edit history', async ({ page }) => {
  await openApp(page);
  await dragFromPalette(page, 'class', { x: 60, y: 120 });
  await dragFromPalette(page, 'class', { x: 380, y: 120 });
  await expect(page.locator('[data-class-node-id]')).toHaveCount(2);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('[data-class-node-id]')).toHaveCount(1);

  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.locator('[data-class-node-id]')).toHaveCount(2);
});

test('projects are independent and can be switched between', async ({ page }) => {
  await openApp(page);
  await dragFromPalette(page, 'class', { x: 60, y: 120 });
  await page.locator('[data-class-node-id]').first().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Car');
  await page.getByLabel('Class name').press('Enter');
  await page.getByLabel('Project name').fill('Automotive');

  await chooseProjectAction(page, 'new-project');
  await page.getByLabel('New project name').fill('Library');
  await page.getByTestId('confirm-new-project').click();

  // The new project starts empty rather than inheriting the previous ontology.
  await expect(page.locator('[data-class-node-id]')).toHaveCount(0);
  await dragFromPalette(page, 'class', { x: 60, y: 120 });
  await page.locator('[data-class-node-id]').first().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Book');
  await page.getByLabel('Class name').press('Enter');

  await expect(page.locator('[data-class-name="Book"]')).toBeVisible();
  await expect(page.locator('[data-class-name="Car"]')).toHaveCount(0);

  // Switching back restores the first ontology intact.
  await page.getByLabel('Active ontology project').selectOption({ label: 'Automotive' });
  await expect(page.locator('[data-class-name="Car"]')).toBeVisible();
  await expect(page.locator('[data-class-name="Book"]')).toHaveCount(0);

  const turtle = await downloadExport(page, 'ttl');
  expect(turtle).toContain(':Car');
  expect(turtle).not.toContain(':Book');
});

test('work survives a page reload', async ({ page }) => {
  await openApp(page);
  await dragFromPalette(page, 'class', { x: 60, y: 120 });
  await page.locator('[data-class-node-id]').first().locator('header [title]').dblclick();
  await page.getByLabel('Class name').fill('Car');
  await page.getByLabel('Class name').press('Enter');
  await selectClass(page, 'Car');
  await addAttribute(page, 'make', 'string');

  await page.reload();

  await expect(page.locator('[data-class-name="Car"]')).toBeVisible();
  await expect(page.locator('[data-class-name="Car"] [data-attribute-name]')).toHaveCount(1);
});

/**
 * A class created from the palette lands where you are looking.
 *
 * It used to go into the next free slot of a grid starting at the top left of an unbounded
 * canvas, so on a schema of any size the new class appeared somewhere off screen and the palette
 * seemed to do nothing at all.
 */
async function centreOffsetOf(page: Page, className: string) {
  const node = await page.locator(`[data-class-name="${className}"]`).boundingBox();
  const canvas = await page.getByTestId('schema-canvas').boundingBox();
  if (!node || !canvas) throw new Error('could not measure');
  return {
    x: Math.abs(node.x + node.width / 2 - (canvas.x + canvas.width / 2)) / canvas.width,
    y: Math.abs(node.y + node.height / 2 - (canvas.y + canvas.height / 2)) / canvas.height,
  };
}

test('a class created from the palette lands in the middle of the view', async ({ page }) => {
  await openApp(page);
  await page.locator('[data-palette-kind="class"]').click();

  const offset = await centreOffsetOf(page, 'NewClass');
  expect(offset.x, 'horizontally centred').toBeLessThan(0.1);
  expect(offset.y, 'vertically centred').toBeLessThan(0.1);
});

test('and follows the view after it has been panned', async ({ page }) => {
  await openApp(page);
  await page.locator('[data-palette-kind="class"]').click();
  await renameClassOnCanvas(page, 'NewClass', 'First');

  // Drag the canvas itself, so the middle of the view is somewhere else entirely.
  const canvas = await page.getByTestId('schema-canvas').boundingBox();
  if (!canvas) throw new Error('no canvas');
  await page.mouse.move(canvas.x + canvas.width * 0.8, canvas.y + canvas.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width * 0.2, canvas.y + canvas.height * 0.2, {
    steps: 12,
  });
  await page.mouse.up();

  await page.locator('[data-palette-kind="class"]').click();

  const offset = await centreOffsetOf(page, 'NewClass');
  expect(offset.x, 'still centred after panning').toBeLessThan(0.1);
  expect(offset.y, 'still centred after panning').toBeLessThan(0.1);

  // The first class is left where it was rather than being shuffled aside.
  await expect(page.locator('[data-class-name="First"]')).toHaveCount(1);
});

/**
 * A class is often two things at once — a LeaseAgreement is a Contract and a
 * FinancialInstrument — and the exporters have always written one `rdfs:subClassOf` per parent.
 * The inspector was the only thing that could not say so: a single select that replaced one
 * parent with the other, discarding the modelling decision without a word.
 */
test('a class can have two superclasses, and both are exported', async ({ page }) => {
  await openApp(page);
  // Dropped at known spots rather than clicked from the palette, which stacks them around the
  // middle of the view and left the third one obscured on Firefox and WebKit.
  const spots: [string, number, number][] = [
    ['Contract', 40, 40],
    ['FinancialInstrument', 40, 220],
    ['LeaseAgreement', 40, 400],
  ];
  for (const [name, x, y] of spots) {
    await dragFromPalette(page, 'class', { x, y });
    await renameClassOnCanvas(page, 'NewClass', name);
  }

  await selectClass(page, 'LeaseAgreement');
  await page.getByLabel('Add a superclass').selectOption({ label: 'Contract' });
  await page.getByLabel('Add a superclass').selectOption({ label: 'FinancialInstrument' });

  await expect(page.getByLabel(/Remove Contract as a superclass/)).toBeVisible();
  await expect(page.getByLabel(/Remove FinancialInstrument as a superclass/)).toBeVisible();

  const turtle = await downloadExport(page, 'ttl');
  const quads = new Parser({ format: 'text/turtle' }).parse(turtle);
  const parents = quads
    .filter(
      (quad) =>
        quad.subject.value.endsWith('/LeaseAgreement') &&
        quad.predicate.value === 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
    )
    .map((quad) => quad.object.value.split('/').pop());

  expect(parents.sort()).toEqual(['Contract', 'FinancialInstrument']);
});

test('where the classes were dropped is saved with them, as one annotation', async ({ page }) => {
  await openApp(page);
  await dragFromPalette(page, 'class', { x: 160, y: 160 });
  await dragFromPalette(page, 'class', { x: 520, y: 380 });
  await expect(page.locator('[data-class-node-id]')).toHaveCount(2);

  for (const [position, name] of [
    ['first', 'Car'],
    ['last', 'Wheel'],
  ] as const) {
    await page.locator('[data-class-node-id]')[position]().locator('header [title]').dblclick();
    await page.getByLabel('Class name').fill(name);
    await page.getByLabel('Class name').press('Enter');
  }

  const turtle = await downloadExport(page, 'ttl');
  const quads = new Parser({ format: 'text/turtle' }).parse(turtle);

  const [annotation] = quads.filter((quad) => quad.predicate.value.endsWith('/ns#layout'));
  expect(annotation, 'the layout should be written').toBeDefined();

  /*
   * One annotation on the ontology carrying every class, rather than a position on each: a
   * triple-level diff can ignore the whole layout by predicate, and a document that was never
   * opened here carries nothing at all.
   */
  expect(annotation!.subject.value).not.toMatch(/\/(Car|Wheel)$/);
  const layout = JSON.parse(annotation!.object.value) as Record<string, [number, number]>;
  const keys = Object.keys(layout);
  expect(keys.some((iri) => iri.endsWith('/Car'))).toBe(true);
  expect(keys.some((iri) => iri.endsWith('/Wheel'))).toBe(true);

  // Dropped in different places, so they are recorded in different places.
  const car = layout[keys.find((iri) => iri.endsWith('/Car'))!]!;
  const wheel = layout[keys.find((iri) => iri.endsWith('/Wheel'))!]!;
  expect(wheel[0]).toBeGreaterThan(car[0]);
  expect(wheel[1]).toBeGreaterThan(car[1]);

  // Declared, so what is written is still a valid OWL document.
  expect(turtle).toMatch(/ontoschema:layout a owl:AnnotationProperty/);
});
