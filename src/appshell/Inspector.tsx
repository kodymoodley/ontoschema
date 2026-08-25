import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { findClass, findAttribute, findRelation } from '../ontologymodel';
import type { EntityRef } from '../ontologymodel';
import { useOntology, useSelection } from '../projectstore';
import { AttributeDetails, ClassDetails } from '../classeditor';
import { RelationDetails } from '../relationeditor';
import { AnnotationSection } from '../annotationpanel';
import { Badge, EmptyState } from '../designsystem';
import styles from './appshell.module.css';

/**
 * The right-hand inspector. It decides *what* is being inspected and delegates the
 * rendering to the module that owns that concept — the shell knows the modules, the
 * modules do not know each other.
 *
 * Everything here describes the selection, and there are no tabs left. Three left in turn, all
 * for the same reason: Export and the ontology's own metadata were never about the selection, so
 * clicking a class threw you off them. Once those had gone, the two that remained described the
 * same thing from the same source, and splitting one thing across two tabs only ever meant
 * clicking back and forth to see it whole.
 */

export function Inspector() {
  const ontology = useOntology();
  const selection = useSelection();

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
        return 'Schema';
    }
  }

  return (
    <aside id="ontoschema-inspector" className={styles.right} aria-label="Inspector">
      {selection && name ? (
        <div className={styles.selectionHeader}>
          <Badge tone={toneFor(selection)}>{kindLabel(selection)}</Badge>
          <span className={styles.selectionName}>{name}</span>
        </div>
      ) : null}

      <div className={styles.scroll}>
        {selection ? (
          <>
            {/*
              Documentation first, by the owner's decision. What a thing *means* is what someone
              opening the panel came to read or to write; its attributes and relations are how it
              is wired, and the canvas is already showing those.
            */}
            <Section title="Documentation">
              <AnnotationSection target={selection} />
            </Section>
            <Section title="Details">
              <DetailsFor selection={selection} />
            </Section>
          </>
        ) : (
          <div className={styles.sectionBody}>
            <EmptyState>
              Nothing selected. Click a class, relation or attribute — on the canvas or in the
              hierarchy — to edit and annotate it here. The schema's own metadata is under{' '}
              <strong>Metadata</strong> in the header.
            </EmptyState>
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * One heading in the inspector, and the block it labels, which folds away under it.
 *
 * Open by default and collapsed by hand: the panel is one scrolling column now, and on a long
 * class the section someone is not reading is a screen of scrolling between them and the one
 * they are. Which is folded is per section and lasts as long as the panel is on screen, so it
 * survives clicking from one class to the next.
 *
 * Hidden rather than unmounted, so a half-typed definition is still there when the section comes
 * back. `hidden` also takes it out of the accessibility tree, which `display: none` alone would
 * do but without saying why.
 */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const bodyId = useId();

  return (
    <>
      <h3 className={styles.inspectorSection}>
        <button
          type="button"
          className={styles.sectionToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((current) => !current)}
        >
          {/* The sign says what the click will do, which is the convention people already read. */}
          <span className={styles.sectionMark} aria-hidden="true">
            {open ? '−' : '+'}
          </span>
          {title}
        </button>
      </h3>
      <div id={bodyId} className={styles.sectionBody} hidden={!open}>
        {children}
      </div>
    </>
  );
}

function DetailsFor({ selection }: { selection: EntityRef }) {
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
  return 'Schema';
}
