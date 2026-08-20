import { useState } from 'react';
import { findClass, findAttribute, findRelation } from '../ontologymodel';
import type { EntityRef } from '../ontologymodel';
import { useOntology, useSelection } from '../projectstore';
import { AttributeDetails, ClassDetails } from '../classeditor';
import { RelationDetails } from '../relationeditor';
import { AnnotationEditor } from '../annotationpanel';
import { Badge, EmptyState, Tabs } from '../designsystem';
import styles from './appshell.module.css';

/**
 * The right-hand inspector. It decides *what* is being inspected and delegates the
 * rendering to the module that owns that concept — the shell knows the modules, the
 * modules do not know each other.
 *
 * Everything here describes the selection. The two tabs that did not — Export, then the
 * ontology's own metadata — have both left, for the same reason: clicking a class threw you
 * off them, which is what a tab that is not about the selection always does.
 */

type InspectorTab = 'details' | 'annotations';

const TABS = [
  { value: 'details' as const, label: 'Details' },
  { value: 'annotations' as const, label: 'Annotations' },
];

export function Inspector() {
  const ontology = useOntology();
  const selection = useSelection();
  const [tab, setTab] = useState<InspectorTab>('details');
  const [tabbedFor, setTabbedFor] = useState<string | null>(null);

  // Selecting something should show that thing, not whatever tab was left open. Adjusting
  // during render (rather than in an effect) avoids a second pass with the stale tab.
  if (selection && selection.id !== tabbedFor) setTabbedFor(selection.id);

  const name = selection ? displayName(selection) : null;

  function displayName(ref: EntityRef): string | null {
    switch (ref.kind) {
      case 'class':
        return findClass(ontology, ref.id)?.localName ?? null;
      case 'relation':
        return findRelation(ontology, ref.id)?.localName ?? null;
      case 'attribute':
        return findAttribute(ontology, ref.id)?.localName ?? null;
      case 'ontology':
        return 'Ontology';
    }
  }

  return (
    <aside id="ontoschema-inspector" className={styles.right} aria-label="Inspector">
      <div className={styles.inspectorTabs}>
        <Tabs options={TABS} value={tab} onChange={setTab} ariaLabel="Inspector section" />
      </div>

      {selection && name ? (
        <div className={styles.selectionHeader}>
          <Badge tone={toneFor(selection)}>{kindLabel(selection)}</Badge>
          <span className={styles.selectionName}>{name}</span>
        </div>
      ) : null}

      <div className={styles.scroll}>
        <div className={styles.sectionBody}>
          {tab === 'details' ? <DetailsFor selection={selection} /> : null}

          {tab === 'annotations' ? (
            selection ? (
              <AnnotationEditor target={selection} />
            ) : (
              <EmptyState>
                Select a class, relation or attribute to annotate it. The ontology's own metadata is
                under <strong>Metadata</strong> in the header.
              </EmptyState>
            )
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function DetailsFor({ selection }: { selection: EntityRef | null }) {
  if (!selection) {
    return (
      <EmptyState>
        Nothing selected. Click a class, relation or attribute — on the canvas or in the hierarchy —
        to edit it here.
      </EmptyState>
    );
  }
  if (selection.kind === 'class') return <ClassDetails classId={selection.id} />;
  if (selection.kind === 'relation') return <RelationDetails propertyId={selection.id} />;
  if (selection.kind === 'attribute') return <AttributeDetails propertyId={selection.id} />;
  return null;
}

function toneFor(ref: EntityRef): 'class' | 'relation' | 'attribute' | 'neutral' {
  if (ref.kind === 'class') return 'class';
  if (ref.kind === 'relation') return 'relation';
  if (ref.kind === 'attribute') return 'attribute';
  return 'neutral';
}

function kindLabel(ref: EntityRef): string {
  if (ref.kind === 'class') return 'Class';
  if (ref.kind === 'relation') return 'Relation';
  if (ref.kind === 'attribute') return 'Attribute';
  return 'Ontology';
}
