import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { chooseProjectAction, openApp, openExamples, readDownload } from './ontoschema';

/**
 * The backup is the one thing an RDF document cannot carry: a workspace is several ontologies
 * and a Turtle file is one. What is worth driving through a real browser is the part the unit
 * tests cannot reach — a download that actually lands, and a file picker that actually reads it.
 */

const projectNames = (page: Page) =>
  page.locator('select[aria-label="Active project"] option').allTextContents();

test('backs up every project and puts them all back', async ({ page }) => {
  await openApp(page);

  // Two projects, so the backup carries something a per-project file could not.
  await openExamples(page);
  await page.getByText('Music library').click();
  await expect(page.locator('[data-class-name="Album"]')).toBeVisible();
  await openExamples(page);
  await page.getByText('University').click();
  await expect(page.locator('[data-class-name="Course"]')).toBeVisible();

  const before = await projectNames(page);
  expect(before.length).toBeGreaterThanOrEqual(3);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    chooseProjectAction(page, 'back-up'),
  ]);
  const backup = await readDownload(download);
  expect(download.suggestedFilename()).toMatch(/^ontoschema-backup-\d{4}-\d{2}-\d{2}\.json$/);

  // Now wreck it: a new project, and one of the old ones deleted.
  await chooseProjectAction(page, 'new-project');
  await page.getByLabel('New project name').fill('Made after the backup');
  await page.getByTestId('confirm-new-project').click();
  await expect.poll(() => projectNames(page)).toContain('Made after the backup');

  await chooseProjectAction(page, 'restore-backup');
  await page.getByLabel('Restore a backup file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  });

  // Nothing happens until it is agreed to.
  await expect(page.getByRole('dialog', { name: /Replace everything/ })).toBeVisible();
  await expect.poll(() => projectNames(page)).toContain('Made after the backup');

  await page.getByTestId('confirm-restore').click();

  await expect.poll(() => projectNames(page)).toEqual(before);
  // The open project is part of the snapshot, and its classes came back with it.
  await expect(page.locator('[data-class-name="Course"]')).toBeVisible();
});

test('leaves the workspace alone when the answer is no', async ({ page }) => {
  await openApp(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    chooseProjectAction(page, 'back-up'),
  ]);
  const backup = await readDownload(download);

  await chooseProjectAction(page, 'new-project');
  await page.getByLabel('New project name').fill('Kept');
  await page.getByTestId('confirm-new-project').click();

  await chooseProjectAction(page, 'restore-backup');
  await page.getByLabel('Restore a backup file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  });
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect.poll(() => projectNames(page)).toContain('Kept');
});
