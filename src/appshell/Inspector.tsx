import { useState } from 'react';
import { findClass, findDatatypeProperty, findObjectProperty } from '../ontologymodel';
import type { EntityRef } from '../ontologymodel';
import { useOntology, useSelection } from '../projectstore';
import { AttributeDetails, ClassDetails } from '../classeditor';
import { RelationDetails } from '../relationeditor';
import { AnnotationEditor } from '../annotationpanel';
import { OntologyMetadataForm } from '../ontologymetadata';
import { ExportPanel } from '../exportpanel';
import { Badge, EmptyState, Tabs } from '../designsystem';
import styles from './appshell.module.css';

/**
 * The right-hand inspector. It decides *what* is being inspected and delegates the
 * rendering to the module that owns that concept — the shell knows the modules, the
 * modules do not know each other.
 */

type InspectorTab = 'details' | 'annotations' | 'ontology' | 'export';

const TABS = [
  { value: 'details' as const, label: 'Details' },
  { value: 'annotations' as const, label: 'Annotations' },
  { value: 'ontology' as const, label: 'Ontology' },
  { value: 'export' as const, label: 'Export' },
];

export function Inspector() {
  const ontology = useOntology();
  const selection = useSelection();
  const [tab, setTab] = useState<InspectorTab>('details');
  const [tabbedFor, setTabbedFor] = useState<string | null>(null);

  // Selecting something should show that thing, not whatever tab was left open. Adjusting
  // during render (rather than in an effect) avoids a second pass with the stale tab.
  if (selection && selection.id !== tabbedFor) {
    setTabbedFor(selection.id);
    if (tab === 'ontology' || tab === 'export') setTab('details');
  }

  const name = selection ? displayName(selection) : null;

  function displayName(ref: EntityRef): string | null {
    switch (ref.kind) {
      case 'class':
        return findClass(ontology, ref.id)?.localName ?? null;
      case 'objectProperty':
        return findObjectProperty(ontology, ref.id)?.localName ?? null;
      case 'datatypeProperty':
        return findDatatypeProperty(ontology, ref.id)?.localName ?? null;
      case 'ontology':
        return 'Ontology';
    }
  }

  return (
    <aside className={styles.right} aria-label="Inspector">
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
                Select a class or property to annotate it, or use the Ontology tab for
                ontology-level metadata.
              </EmptyState>
            )
          ) : null}

          {tab === 'ontology' ? (
            <>
              <OntologyMetadataForm />
              <div style={{ height: 'var(--space-4)' }} />
              <AnnotationEditor target={{ kind: 'ontology', id: '' }} />
            </>
          ) : null}

          {tab === 'export' ? <ExportPanel /> : null}
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
  if (selection.kind === 'objectProperty') return <RelationDetails propertyId={selection.id} />;
  if (selection.kind === 'datatypeProperty') return <AttributeDetails propertyId={selection.id} />;
  return null;
}

function toneFor(ref: EntityRef): 'class' | 'relation' | 'attribute' | 'neutral' {
  if (ref.kind === 'class') return 'class';
  if (ref.kind === 'objectProperty') return 'relation';
  if (ref.kind === 'datatypeProperty') return 'attribute';
  return 'neutral';
}

function kindLabel(ref: EntityRef): string {
  if (ref.kind === 'class') return 'Class';
  if (ref.kind === 'objectProperty') return 'Object property';
  if (ref.kind === 'datatypeProperty') return 'Datatype property';
  return 'Ontology';
}
