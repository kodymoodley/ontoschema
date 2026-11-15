import { useCallback, useRef, useState } from 'react';
import { createPreference, useOntology, useProjectStore } from '../projectstore';
import { schemaGraph } from './arrange';
import { shuffleInBackground } from './backgroundshuffle';
import { frameAll } from './framing';
import { glideClasses } from './glide';
import type { Direction } from './layeredlayout';

/**
 * The Shuffle button and the one that turns the layout on its side, as a hook for the toolbar.
 *
 * A press works out a new layout in the background (`backgroundshuffle`), then commits the new
 * places as one step, so a single undo puts back what was there, and glides the classes there.
 *
 * Top to bottom unless turned. The turn is remembered in this browser, like the theme: it is how
 * this person likes to read a schema, not part of the schema.
 */

const direction = createPreference<Direction>(
  'ontoschema.shuffleDirection',
  (stored) => (stored === 'TB' || stored === 'LR' ? stored : undefined),
  (value) => value,
  () => 'TB',
);

/**
 * How long the worker keeps trying. Small schemas finish all their tries well inside it; past
 * about sixty classes, a single try can take longer than this, and one try is still made.
 */
const BUDGET_MS = 300;

export function useShuffle() {
  const ontology = useOntology();
  const placeClassesById = useProjectStore((state) => state.placeClassesById);
  const current = direction.use();
  const [busy, setBusy] = useState(false);
  // The state is for drawing; this is for refusing a second press before the first has drawn.
  const running = useRef(false);

  const run = useCallback(
    async (towards: Direction) => {
      running.current = true;
      setBusy(true);
      try {
        const result = await shuffleInBackground({
          graph: schemaGraph(ontology),
          current: new Map(ontology.classes.map((entity) => [entity.id, entity.position])),
          direction: towards,
          seed: Math.floor(Math.random() * 2 ** 31),
          budgetMs: BUDGET_MS,
        });
        if (!result.changed) return;
        await glideClasses(() => {
          placeClassesById(result.positions);
          // As Tidy up does: the new layout is a different shape, and the camera follows it.
          window.setTimeout(frameAll, 0);
        });
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [ontology, placeClassesById],
  );

  return {
    busy,
    direction: current,
    shuffle: () => {
      if (!running.current) void run(direction.get());
    },
    /** Turns the ranks the other way, and shuffles in the new direction. */
    turn: () => {
      if (running.current) return;
      const next: Direction = direction.get() === 'TB' ? 'LR' : 'TB';
      direction.set(next);
      void run(next);
    },
  };
}
