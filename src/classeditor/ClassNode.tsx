import { useEffect, useRef, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { xsdDatatypeCurie } from '../annotationvocabulary';
import type { DatatypeProperty, OntologyClass } from '../ontologymodel';
import { useProjectStore } from '../projectstore';
import styles from './classeditor.module.css';

/**
 * The class shape on the schema canvas: a header carrying the local name, the superclass
 * it sits under, and its datatype properties rendered as typed rows inside the box.
 *
 * Double-clicking the header renames in place; the full editing surface is the inspector.
 */

interface ClassNodeData {
  entity: OntologyClass;
  attributes: DatatypeProperty[];
  superClassNames: string[];
}

export function ClassNode({ data, selected }: NodeProps) {
  const { entity, attributes, superClassNames } = data as unknown as ClassNodeData;
  const renameClass = useProjectStore((state) => state.renameClassById);
  const select = useProjectStore((state) => state.select);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entity.localName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft !== entity.localName) renameClass(entity.id, draft);
  };

  const annotationCount = entity.annotations.length;

  return (
    <div
      className={`${styles.classNode} ${selected ? styles.selected : ''}`}
      data-class-node-id={entity.id}
      data-class-name={entity.localName}
      data-testid={`class-node-${entity.localName}`}
    >
      {/* Relations: target on the left, source on the right, so dragging left-to-right
          reads as domain -> range, which is the direction the relation is stored in. */}
      <Handle type="target" position={Position.Left} id="in" isConnectable />
      <Handle type="source" position={Position.Right} id="out" isConnectable />

      {/* Subclass links use their own vertical pair — leaving the child's top edge and
          arriving at the parent's bottom edge — so hierarchy reads upward instead of
          looping around the sides. They are not draggable: hierarchy is edited in the
          tree panel and the superclass picker, not by drawing on the canvas. */}
      <Handle
        type="source"
        position={Position.Top}
        id="subOut"
        isConnectable={false}
        className={styles.hierarchyHandle}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="subIn"
        isConnectable={false}
        className={styles.hierarchyHandle}
      />

      <header
        className={styles.header}
        onDoubleClick={() => {
          setDraft(entity.localName);
          setEditing(true);
        }}
      >
        <span className={styles.marker} aria-hidden="true" />
        {editing ? (
          <input
            ref={inputRef}
            className={styles.nameInput}
            value={draft}
            aria-label="Class name"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
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
          attributes.map((attribute) => (
            <button
              key={attribute.id}
              type="button"
              className={styles.attribute}
              data-attribute-name={attribute.localName}
              onClick={(event) => {
                event.stopPropagation();
                select({ kind: 'datatypeProperty', id: attribute.id });
              }}
            >
              <span className={styles.attributeMarker} aria-hidden="true" />
              <span className={styles.attributeName}>{attribute.localName}</span>
              <span className={styles.attributeRange}>{xsdDatatypeCurie(attribute.range)}</span>
            </button>
          ))
        )}
      </div>

      <footer className={styles.footer}>
        <span>
          {attributes.length} {attributes.length === 1 ? 'attribute' : 'attributes'}
        </span>
        {annotationCount > 0 ? (
          <span className={styles.annotationCount}>{annotationCount} annotations</span>
        ) : null}
      </footer>
    </div>
  );
}
