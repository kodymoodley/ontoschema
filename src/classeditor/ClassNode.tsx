import { Fragment, useEffect, useRef, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { xsdDatatypeCurie } from '../annotationvocabulary';
import { toClassLocalName } from '../ontologymodel';
import type { DatatypeProperty, OntologyClass } from '../ontologymodel';
import { useProjectStore } from '../projectstore';
import styles from './classeditor.module.css';

/**
 * The class shape on the schema canvas: a header carrying the local name, the superclass
 * it sits under, and its datatype properties rendered as typed rows inside the box.
 *
 * Double-clicking the header renames in place; the full editing surface is the inspector.
 */

interface AttributeRow {
  usageId: string;
  property: DatatypeProperty;
  shared: boolean;
}

interface ClassNodeData {
  entity: OntologyClass;
  attributes: AttributeRow[];
  superClassNames: string[];
}

/** Handle ids match what `canvas/layout.ts` chooses when it routes an edge. */
const SIDES = [
  { side: 'left', position: Position.Left },
  { side: 'right', position: Position.Right },
  { side: 'top', position: Position.Top },
  { side: 'bottom', position: Position.Bottom },
] as const;

export function ClassNode({ data, selected }: NodeProps) {
  const { entity, attributes, superClassNames } = data as unknown as ClassNodeData;
  const renameClass = useProjectStore((state) => state.renameClassById);
  const select = useProjectStore((state) => state.select);
  const focusClass = useProjectStore((state) => state.focusClass);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entity.localName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // An empty or unusable name is shown as invalid rather than silently reverted, so the
  // field can be cleared and retyped.
  const draftValid = toClassLocalName(draft) !== '';

  const commit = () => {
    if (!draftValid) return;
    setEditing(false);
    if (draft !== entity.localName) renameClass(entity.id, draft);
  };

  return (
    <div
      className={`${styles.classNode} ${selected ? styles.selected : ''}`}
      data-class-node-id={entity.id}
      data-class-name={entity.localName}
      data-testid={`class-node-${entity.localName}`}
      // Double-click, or double-tap, anywhere but the header brings this class into focus.
      // The header keeps the gesture for renaming in place and stops it propagating here.
      onDoubleClick={() => focusClass(entity.id)}
    >
      {/*
        A connection point on every side, so an edge can leave and arrive wherever the two
        classes actually face each other rather than always looping right-to-left. The
        canvas picks the facing pair; a relation may also be drawn by hand from any side.

        Each side carries both a source and a target at the same point. The target is not
        interactive — React Flow finds it by proximity while a connection is being dragged —
        so it never steals the pointer from the source underneath it.
      */}
      {SIDES.map(({ side, position }) => (
        <Fragment key={side}>
          <Handle
            type="source"
            position={position}
            id={`source-${side}`}
            isConnectable
            className={styles.sourceHandle}
          />
          <Handle
            type="target"
            position={position}
            id={`target-${side}`}
            isConnectable
            className={styles.targetHandle}
          />
        </Fragment>
      ))}

      <header
        className={styles.header}
        onDoubleClick={(event) => {
          event.stopPropagation();
          setDraft(entity.localName);
          setEditing(true);
        }}
      >
        <span className={styles.marker} aria-hidden="true" />
        {editing ? (
          <input
            ref={inputRef}
            className={`${styles.nameInput} ${draftValid ? '' : styles.nameInputInvalid}`}
            value={draft}
            aria-label="Class name"
            aria-invalid={draftValid ? undefined : true}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => (draftValid ? commit() : setEditing(false))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit();
              if (event.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <span className={styles.name} title={entity.localName}>
            {entity.localName}
          </span>
        )}
      </header>

      {superClassNames.length > 0 ? (
        <div className={styles.superclass}>⊂ {superClassNames.join(', ')}</div>
      ) : null}

      <div className={styles.attributes}>
        {attributes.length === 0 ? (
          <p className={styles.emptyAttributes}>
            Drop a datatype property here to add an attribute.
          </p>
        ) : (
          attributes.map((row) => (
            <button
              key={row.usageId}
              type="button"
              className={styles.attribute}
              data-attribute-name={row.property.localName}
              data-usage-id={row.usageId}
              title={
                row.shared
                  ? `${row.property.localName} is also used on other classes`
                  : row.property.localName
              }
              onClick={(event) => {
                event.stopPropagation();
                select({ kind: 'datatypeProperty', id: row.property.id });
              }}
            >
              <span className={styles.attributeMarker} aria-hidden="true" />
              <span className={styles.attributeName}>{row.property.localName}</span>
              {row.shared ? (
                <span className={styles.sharedMark} aria-label="shared">
                  ↗
                </span>
              ) : null}
              <span className={styles.attributeRange}>{xsdDatatypeCurie(row.property.range)}</span>
            </button>
          ))
        )}
      </div>

      <footer className={styles.footer}>
        <span>
          {attributes.length} {attributes.length === 1 ? 'attribute' : 'attributes'}
        </span>
        {entity.annotations.length > 0 ? (
          <span className={styles.annotationCount}>{entity.annotations.length} annotations</span>
        ) : null}
      </footer>
    </div>
  );
}
