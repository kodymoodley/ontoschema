import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { downloadExport, openApp, openExamples } from './ontoschema';

/**
 * Opening a document, in a real browser.
 *
 * The unit tests already parse both syntaxes. What only a browser can answer is whether the
 * RDF/XML parser *runs* there: it is loaded on demand, and it is a Node-shaped streaming
 * library bundled for the web. Whether that survives the trip is not something a Node test
 * can tell us.
 *
 * The shape of each test is a full circle — export what the app is showing, open the file it
 * just wrote, and check the schema came back — which is the actual promise of saving as RDF.
 */

const projectNames = (page: Page) =>
  page.locator('select[aria-label="Active ontology project"] option').allTextContents();

async function openDocument(page: Page, name: string, content: string) {
  await page
    .locator('input[aria-label="Open project file"]')
    .setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(content) });
}

test('exports Turtle and opens it again as a project of its own', async ({ page }) => {
  await openApp(page);
  await openExamples(page);
  await page.getByText('Music library').click();
  await expect(page.locator('[data-class-name="Album"]')).toBeVisible();

  const turtle = await downloadExport(page, 'ttl');
  await openDocument(page, 'music-library.ttl', turtle);

  await expect.poll(() => projectNames(page)).toContain('music-library');
  // The schema is on the canvas, and where it was: positions ride in the file too.
  await expect(page.locator('[data-class-name="Album"]')).toBeVisible();
  await expect(page.locator('[data-class-name="Track"]')).toBeVisible();
});

/*
 * The one that could only fail in a browser. `rdfxml-streaming-parser` is fetched as its own
 * chunk the first time an RDF/XML file is opened, and it brings a stream implementation with
 * it; if any of that does not survive bundling, this is where it shows.
 */
test('loads the RDF/XML parser on demand and reads the file with it', async ({ page }) => {
  await openApp(page);
  await openExamples(page);
  await page.getByText('University').click();
  await expect(page.locator('[data-class-name="Course"]')).toBeVisible();

  const rdfxml = await downloadExport(page, 'rdf');
  expect(rdfxml).toContain('<rdf:RDF');

  await openDocument(page, 'university.rdf', rdfxml);

  await expect.poll(() => projectNames(page)).toContain('university');
  await expect(page.locator('[data-class-name="Course"]')).toBeVisible();
});

test('reports what it left behind, and opens the file anyway', async ({ page }) => {
  await openApp(page);

  const foreign = `
    @prefix owl: <http://www.w3.org/2002/07/owl#>.
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
    @prefix ex: <https://example.org/zoo/>.
    ex:Animal a owl:Class; rdfs:label "Animal".
    ex:Keeper a owl:Class.
    ex:kept a owl:ObjectProperty; rdfs:domain ex:Animal; rdfs:range ex:Keeper.
    ex:leo a ex:Animal.
    ex:vague a owl:ObjectProperty.
    ex:nickname a owl:DatatypeProperty; rdfs:domain ex:Animal; rdfs:range rdfs:Literal.
  `;
  await openDocument(page, 'zoo.ttl', foreign);

  const report = page.getByRole('dialog', { name: /left behind/ });
  await expect(report).toBeVisible();
  await expect(report).toContainText('1 individual');
  await expect(report).toContainText('1 relation that did not say');
  await expect(report).toContainText('Saving from here writes what OntoSchema kept');

  await page.getByTestId('import-report-ok').click();
  await expect(report).toBeHidden();

  // Reported, not refused: the schema is open behind it.
  await expect(page.locator('[data-class-name="Animal"]')).toBeVisible();
  await expect(page.locator('[data-class-name="Keeper"]')).toBeVisible();
});

test('refuses a file whose contents are not what its name claims', async ({ page }) => {
  await openApp(page);
  const before = await projectNames(page);

  await openDocument(page, 'broken.ttl', 'this is certainly not turtle {{{');

  await expect(page.getByRole('dialog', { name: /Could not open/ })).toContainText('broken.ttl');
  expect(await projectNames(page)).toEqual(before);
});
