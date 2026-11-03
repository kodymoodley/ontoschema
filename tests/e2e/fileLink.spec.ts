import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { chooseProjectAction, dragFromPalette, openApp, openSave } from './ontoschema';

/**
 * Editing a schema file in place: open it, edit, and the file on disk keeps up, ready for
 * `git commit`.
 *
 * An automated browser cannot drive the native file pickers, so they are the one thing stubbed:
 * they hand back real file handles from the origin-private file system. Everything after the
 * picker is the genuine API — reading, writing through `createWritable`, the handle surviving a
 * reload in IndexedDB — which is exactly the part the app is responsible for.
 */

/** A schema written by hand, the way a colleague might commit one: no positions in it. */
const FLEET = [
  '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
  '@prefix fleet: <https://example.org/fleet/> .',
  '',
  '<https://example.org/fleet> a owl:Ontology .',
  'fleet:Vehicle a owl:Class .',
  '',
].join('\n');

async function writeOnDisk(page: Page, name: string, text: string) {
  await page.evaluate(
    async ([name, text]) => {
      const folder = await navigator.storage.getDirectory();
      const writer = await (await folder.getFileHandle(name, { create: true })).createWritable();
      await writer.write(text);
      await writer.close();
    },
    [name, text] as const,
  );
}

const readOnDisk = (page: Page, name: string) =>
  page.evaluate(async (name) => {
    const folder = await navigator.storage.getDirectory();
    return (await (await folder.getFileHandle(name)).getFile()).text();
  }, name);

/** What a `git pull` looks like from the tab: the window comes back into focus. */
const returnToTab = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event('focus')));

const status = (page: Page) => page.getByTestId('save-status');

test.describe('a schema linked to its file', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Only Chromium has the File System Access API; the other browsers are tested below.',
  );

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const folder = () => navigator.storage.getDirectory();
      const picker = window as unknown as Record<string, unknown>;
      picker.showOpenFilePicker = async () => [await (await folder()).getFileHandle('fleet.ttl')];
      picker.showSaveFilePicker = async (options?: { suggestedName?: string }) =>
        (await folder()).getFileHandle(options?.suggestedName ?? 'Untitled', { create: true });
    });
  });

  async function openFleet(page: Page) {
    await openApp(page);
    await writeOnDisk(page, 'fleet.ttl', FLEET);
    await page.getByTestId('file-menu').click();
    await page.getByRole('button', { name: 'Open…' }).click();
    await expect(page.locator('[data-class-name="Vehicle"]')).toBeVisible();
    await expect(status(page)).toHaveText('Saved to fleet.ttl');
  }

  test('leaves the file exactly as it was until something is edited', async ({ page }) => {
    await openFleet(page);

    // Long enough for an autosave to have gone out, had opening the file triggered one.
    await page.waitForTimeout(1_500);
    expect(await readOnDisk(page, 'fleet.ttl')).toBe(FLEET);
  });

  test('saves an edit into the file on its own', async ({ page }) => {
    await openFleet(page);

    await dragFromPalette(page, 'class', { x: 420, y: 160 });

    await expect.poll(() => readOnDisk(page, 'fleet.ttl')).toContain('fleet:NewClass a owl:Class');
    expect(await readOnDisk(page, 'fleet.ttl')).toContain('ontoschema:position');
  });

  test('reads the file back when something else changed it', async ({ page }) => {
    await openFleet(page);

    await writeOnDisk(page, 'fleet.ttl', `${FLEET}fleet:Garage a owl:Class .\n`);
    await returnToTab(page);

    await expect(page.locator('[data-class-name="Garage"]')).toBeVisible();
  });

  test('is still linked after a reload', async ({ page }) => {
    await openFleet(page);

    await page.reload();

    await expect(status(page)).toHaveText('Saved to fleet.ttl');
    await dragFromPalette(page, 'class', { x: 420, y: 160 });
    await expect.poll(() => readOnDisk(page, 'fleet.ttl')).toContain('fleet:NewClass a owl:Class');
  });

  test('saves a new schema into the file chosen with Save as, and keeps saving there', async ({
    page,
  }) => {
    await openApp(page);
    await dragFromPalette(page, 'class', { x: 300, y: 160 });

    await openSave(page);
    await page.getByTestId('download-ttl').click();
    await expect(status(page)).toHaveText(/^Saved to .+\.ttl$/);
    const name = (await status(page).textContent())?.replace('Saved to ', '') ?? '';
    await page
      .getByRole('dialog', { name: 'Save as' })
      .getByRole('button', { name: 'Close' })
      .click();

    await dragFromPalette(page, 'class', { x: 640, y: 160 });

    await expect.poll(() => readOnDisk(page, name)).toContain('NewClass2 a owl:Class');
  });

  test('writes at once on Ctrl+S', async ({ page }) => {
    await openFleet(page);
    await dragFromPalette(page, 'class', { x: 420, y: 160 });

    await page.keyboard.press('ControlOrMeta+s');

    await expect
      .poll(() => readOnDisk(page, 'fleet.ttl'), { timeout: 400 })
      .toContain('fleet:NewClass a owl:Class');
  });
});

test.describe('in a browser that cannot link files', () => {
  test.skip(
    ({ browserName }) => browserName === 'chromium',
    'Chromium can link files; this is for the browsers that cannot.',
  );

  test('says the work is kept in the browser', async ({ page }) => {
    await openApp(page);
    await expect(status(page)).toHaveText('In this browser');
  });

  test('offers Save as on Ctrl+S rather than the browser saving the page', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.getByRole('dialog', { name: 'Save as' })).toBeVisible();
  });
});

test('names the export item for what its files are for', async ({ page }) => {
  await openApp(page);
  await chooseProjectAction(page, 'open-export');
  await expect(page.getByRole('dialog', { name: 'Export for other tools' })).toBeVisible();
});
