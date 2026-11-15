import { useState } from 'react';
import {
  findClass,
  holderOfName,
  nameProblem,
  toPropertyLocalName,
  usageCount,
} from '../ontologymodel';
import type { Ontology } from '../ontologymodel';
import { useOntology, useProjectStore } from '../projectstore';
import type { PendingConnection } from '../projectstore';
import { Button, EmptyState, Field, Modal, SearchPicker } from '../designsystem';
import type { PickerRow } from '../designsystem';
import { searchEntities } from '../search';
import styles from './relationeditor.module.css';

/**
 * Shown when a line has been drawn but not yet given a relation: which relation is it?
 *
 * Drawing a connection is not the same as inventing a property. Choosing an existing one is what
 * makes a property reusable -- and what puts an otherwise-unused one onto the canvas for the
 * first time -- so the dialog is a search over the relations there are, the way finding an entity
 * is, with a button beside the box for when the name typed is a new one.
 *
 * Before anything is typed the list holds every relation, most used first, since the one wanted
 * is most often one already in use. Typing narrows it by name, label and description. Enter takes
 * a relation the arrows have highlighted, or one whose name was typed in full; otherwise it
 * creates the name typed, as "+ New" does. A name another kind of term holds is refused.
 */
export function ConnectionPicker() {
  const pending = useProjectStore((state) => state.pendingConnection);
  // Its own component, so each drawn line starts with an empty box.
  return pending ? <WhichRelation pending={pending} /> : null;
}

/** How many relations the list holds at once. Past that, typing narrows it. */
const SHOWN = 50;

function WhichRelation({ pending }: { pending: PendingConnection }) {
  const ontology = useOntology();
  const cancel = useProjectStore((state) => state.cancelConnection);
  const completeWith = useProjectStore((state) => state.completeConnectionWith);
  const completeWithNew = useProjectStore((state) => state.completeConnectionWithNewProperty);
  const [query, setQuery] = useState('');

  const subject = findClass(ontology, pending.subjectClassId);
  const object = findClass(ontology, pending.objectClassId);
  if (!subject || !object) return null;

  const typed = query.trim();
  const name = toPropertyLocalName(typed);
  const holder = name ? holderOfName(ontology, name) : undefined;
  const problem =
    typed && holder?.kind !== 'relation' ? nameProblem(ontology, 'relation', typed) : undefined;
  const canCreate = typed !== '' && holder === undefined && problem === undefined;
  const create = () => {
    if (canCreate) completeWithNew(typed);
  };

  const matches = relationsFor(ontology, typed);
  const rows: PickerRow[] = matches.slice(0, SHOWN).map((match) => {
    const uses = usageCount(ontology, match.id);
    return {
      key: match.id,
      name: match.name,
      tone: 'relation',
      badge: 'Relation',
      detail: [match.context, uses === 0 ? 'unused' : `used ${uses}×`].filter(Boolean).join(' · '),
    };
  });
  // A name typed in full is that relation, and comes first in the list: Enter takes it.
  const named = rows.findIndex((row) => row.name === name);

  return (
    <Modal
      title="Which relation?"
      open
      onClose={cancel}
      footer={
        <Button variant="subtle" onClick={cancel}>
          Cancel
        </Button>
      }
    >
      <p className={styles.pendingSummary}>
        <strong>{subject.localName}</strong> <span aria-hidden="true">→</span>{' '}
        <strong>{object.localName}</strong>
      </p>

      <Field
        error={problem}
        hint={named >= 0 ? `${name} already exists. Enter uses it.` : undefined}
      >
        <SearchPicker
          query={query}
          onQueryChange={setQuery}
          placeholder="Find a relation, or name a new one"
          inputLabel="Relation name"
          rowsLabel="Relations"
          rows={rows}
          highlight={named >= 0 ? named : null}
          onPick={(row) => completeWith(row.key)}
          onEnterWithoutRow={create}
          invalid={problem !== undefined}
          action={
            <Button
              variant="primary"
              onClick={create}
              disabled={!canCreate}
              aria-label={name ? `Create a new relation called ${name}` : 'Create a new relation'}
              data-testid="new-relation"
            >
              + New
            </Button>
          }
          empty={
            <EmptyState>
              {typed
                ? `No relation matches ${typed}.`
                : 'No relations yet. Type a name and press + New.'}
            </EmptyState>
          }
          note={
            matches.length > SHOWN ? (
              <p className={styles.unusedNote}>
                Showing {SHOWN} of {matches.length}. Type to narrow.
              </p>
            ) : undefined
          }
        />
      </Field>
    </Modal>
  );
}

/** The relations to list for what was typed: all of them, most used first, or those that match. */
function relationsFor(ontology: Ontology, typed: string) {
  if (typed) {
    return searchEntities(ontology, typed, {
      kinds: ['relation'],
      limit: ontology.relations.length,
    }).map((match) => ({ id: match.ref.id, name: match.localName, context: match.context }));
  }
  return [...ontology.relations]
    .sort(
      (a, b) =>
        usageCount(ontology, b.id) - usageCount(ontology, a.id) ||
        a.localName.localeCompare(b.localName),
    )
    .map((relation) => ({ id: relation.id, name: relation.localName, context: null }));
}
