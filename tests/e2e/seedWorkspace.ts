import type { Page } from '@playwright/test';
import { STORAGE_KEY } from '../../src/projectstore';
import type { Ontology } from '../../src/ontologymodel';

/**
 * Puts an ontology into browser storage before the app boots, so a test can start from a
 * schema far larger than it could reasonably build by hand.
 *
 * This writes the real persisted format rather than reaching into the store, which means a
 * test using it also exercises the load path — the same one a returning user takes.
 */

/** Classes are created at the origin, so they are spread over a grid to be worth rendering. */
const COLUMNS = 15;
const COLUMN_WIDTH = 300;
const ROW_HEIGHT = 240;

export async function seedWorkspace(page: Page, name: string, ontology: Ontology): Promise<void> {
  const stamp = new Date().toISOString();
  const workspace = {
    activeProjectId: 'project-seeded',
    projects: [
      {
        id: 'project-seeded',
        name,
        createdAt: stamp,
        updatedAt: stamp,
        ontology: onAGrid(ontology),
      },
    ],
  };

  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key as string, value as string),
    [STORAGE_KEY, JSON.stringify(workspace)] as const,
  );
}

/** Lays every class out on a grid, leaving one that already has a position where it is. */
function onAGrid(ontology: Ontology): Ontology {
  const placed = ontology.classes.some(
    (entity) => entity.position.x !== 0 || entity.position.y !== 0,
  );
  if (placed) return ontology;

  return {
    ...ontology,
    classes: ontology.classes.map((entity, index) => ({
      ...entity,
      position: {
        x: (index % COLUMNS) * COLUMN_WIDTH,
        y: Math.floor(index / COLUMNS) * ROW_HEIGHT,
      },
    })),
  };
}

/**
 * Where the classes are in the model, read back out of the persisted workspace.
 *
 * Not from the screen. Arranging frames the camera on the new drawing, so a screen coordinate
 * after an arrange is a fact about the camera as much as about the layout — which is exactly
 * what a test of the layout must not measure. Overlap is safe to read from the screen because
 * pan and zoom apply to every box equally; a coordinate is not.
 *
 * The workspace is written on a queue with a 500ms debounce, so a read taken straight after a
 * gesture is usually still showing the state before it. Every caller waits for the value
 * it expects rather than for the writing to stop — waiting for it to stop is not enough at this
 * sampling rate, because two reads 100ms apart are both stale while one write is pending.
 */
export async function savedPositions(page: Page): Promise<Record<string, string>> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const workspace = JSON.parse(raw) as {
      activeProjectId: string;
      projects: {
        id: string;
        ontology: { classes: { localName: string; position: { x: number; y: number } }[] };
      }[];
    };
    const project = workspace.projects.find((one) => one.id === workspace.activeProjectId);
    const out: Record<string, string> = {};
    for (const entity of project?.ontology.classes ?? []) {
      out[entity.localName] = `${Math.round(entity.position.x)},${Math.round(entity.position.y)}`;
    }
    return out;
  }, STORAGE_KEY);
}
