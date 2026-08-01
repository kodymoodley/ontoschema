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
