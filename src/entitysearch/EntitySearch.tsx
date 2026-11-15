import { useState } from 'react';
import { usagesOfProperty } from '../ontologymodel';
import type { EntityRef } from '../ontologymodel';
import { searchEntities } from '../search';
import type { EntityMatch } from '../search';
import { useOntology, useProjectStore } from '../projectstore';
import { EmptyState, SearchPicker } from '../designsystem';

/**
 * Finding a class, relation or attribute by name or description.
 *
 * Past about thirty classes the taxonomy tree stops being a way to find anything — you have to
 * know where a thing is before you can use it — and every bundled example is already past
 * fifteen.
 *
 * A dialog rather than a box in a panel, because there was nowhere to put a box. The header is
 * full and the left panel is already cramped enough to have its own roadmap entry; a dialog
 * costs no permanent space and `Ctrl`+`K` is where people look for it anyway.
 *
 * Choosing a result selects the entity, and selecting is what opens the inspector, so the
 * result lands with its details already showing. That fell out of the rule rather than needing
 * arranging, which is a sign the rule was the right one. The best match is highlighted, so
 * Enter goes to it, and the arrows to any other.
 */

interface EntitySearchProps {
  /** Called once a result is chosen, so the dialog around this can close itself. */
  onChoose: () => void;
}

export function EntitySearch({ onChoose }: EntitySearchProps) {
  const ontology = useOntology();
  const select = useProjectStore((state) => state.select);
  const focusClass = useProjectStore((state) => state.focusClass);
  const [query, setQuery] = useState('');

  /*
   * Choosing a result takes you to the thing, rather than only telling you about it. `focusClass`
   * selects as well as moving the viewport, so a class needs nothing else.
   *
   * A relation or an attribute has no box of its own on the canvas — it is an edge, or a row
   * inside a class — so the nearest thing to zoom to is a class that carries it. The first is
   * used, which for a property used once is the only one. The property itself stays selected, so
   * the inspector shows what was searched for rather than the class it was found through.
   */
  const reveal = (ref: EntityRef) => {
    if (ref.kind === 'class') {
      focusClass(ref.id);
      return;
    }
    const [usage] = usagesOfProperty(ontology, ref.id);
    if (usage) focusClass(usage.subjectClassId);
    select(ref);
  };

  const results = query.trim() ? searchEntities(ontology, query) : [];
  const byKey = new Map(results.map((result) => [keyOf(result), result]));

  return (
    <SearchPicker
      query={query}
      onQueryChange={setQuery}
      placeholder="Find a class, relation or attribute…"
      // Distinct from the dialog's own name and the trigger's, or all three answer to one.
      inputLabel="Search by name or description"
      rowsLabel="Search results"
      rows={results.map((result) => ({
        key: keyOf(result),
        name: result.localName,
        tone: result.kind,
        badge: KIND_LABEL[result.kind],
        detail: result.context,
      }))}
      highlight={0}
      onPick={(row) => {
        const result = byKey.get(row.key);
        if (!result) return;
        reveal(result.ref);
        onChoose();
      }}
      empty={
        query.trim() === '' ? (
          <EmptyState>
            Type a name, or a word from a label or description. Both halves of a name work on their
            own, so <code>wheel</code> finds <code>hasWheel</code>.
          </EmptyState>
        ) : (
          <EmptyState>Nothing matches {query.trim()}.</EmptyState>
        )
      }
    />
  );
}

const keyOf = (result: EntityMatch) => `${result.kind}:${result.ref.id}`;

const KIND_LABEL = {
  class: 'Class',
  relation: 'Relation',
  attribute: 'Attribute',
} as const;
