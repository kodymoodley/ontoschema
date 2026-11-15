import { useMemo } from 'react';
import { relationsAtOrBelow } from '../ontologymodel';
import type { Ontology } from '../ontologymodel';
import { createPreference } from './preference';

/**
 * The relations put away on the schema canvas, per project, in this browser.
 *
 * A view of the schema rather than part of it: hiding a relation changes nothing in a saved file,
 * an export or the undo history. It is remembered here, beside the other things that belong to
 * the person at the keyboard, so it survives a reload; keyed by project, so putting relations
 * away in one schema leaves another as it was.
 *
 * What is kept is what was chosen. Hiding a relation also hides the relations under it, as a
 * hierarchy reads, and that is worked out from the schema as it stands, so a subrelation added
 * later is hidden with its parent without anything here changing.
 */

type Chosen = Readonly<Record<string, readonly string[]>>;

const chosen = createPreference<Chosen>(
  'ontoschema.hiddenRelations',
  (stored) => {
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
    return Object.fromEntries(
      Object.entries(parsed).map(([project, ids]) => [
        project,
        Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [],
      ]),
    );
  },
  (value) => JSON.stringify(value),
  () => ({}),
);

const NONE: readonly string[] = [];

const chosenFor = (projectId: string | null) => (projectId && chosen.get()[projectId]) || NONE;

const setChosen = (projectId: string, ids: readonly string[]) => {
  const { [projectId]: _old, ...others } = chosen.get();
  chosen.set(ids.length > 0 ? { ...others, [projectId]: ids } : others);
};

/**
 * The relations a person chose to hide, and every relation not drawn because of it: those, and
 * every relation under one of them.
 */
export function useHiddenRelations(
  ontology: Ontology,
  projectId: string | null,
): { chosen: ReadonlySet<string>; hidden: ReadonlySet<string> } {
  const all = chosen.use();
  const ids = (projectId && all[projectId]) || NONE;
  return useMemo(
    () => ({ chosen: new Set(ids), hidden: relationsAtOrBelow(ontology, ids) }),
    [ontology, ids],
  );
}

export function setRelationHidden(projectId: string, relationId: string, hide: boolean): void {
  const current = chosenFor(projectId).filter((id) => id !== relationId);
  setChosen(projectId, hide ? [...current, relationId] : current);
}

export function showAllRelations(projectId: string): void {
  setChosen(projectId, []);
}

/**
 * Brings a relation back into view, with whatever was hiding it: itself, or a relation above it.
 * Drawing a new line with a relation must not leave that line out of sight.
 */
export function revealRelation(ontology: Ontology, projectId: string, relationId: string): void {
  const current = chosenFor(projectId);
  const hiding = current.filter((id) => relationsAtOrBelow(ontology, [id]).has(relationId));
  if (hiding.length === 0) return;
  setChosen(
    projectId,
    current.filter((id) => !hiding.includes(id)),
  );
}
