import { useEffect, useRef, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { ObjectProperty } from '../ontologymodel';
import { useProjectStore } from '../projectstore';
import styles from './relationeditor.module.css';

/**
 * A generic object property: reusable across many classes, so it deliberately has no
 * domain or range and is not drawn as an edge. It sits on the canvas as a pill, which
 * reads as "a property that exists in this ontology" rather than "a link between these
 * two classes".
 */
export function GenericPropertyNode({ data, selected }: NodeProps) {
  const { entity } = data as unknown as { entity: ObjectProperty };
  const rename = useProjectStore((state) => state.renameObjectPropertyById);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entity.localName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft !== entity.localName) rename(entity.id, draft);
  };

  return (
    <div
      className={`${styles.genericNode} ${selected ? styles.genericSelected : ''}`}
      data-generic-property-id={entity.id}
      data-testid={`generic-property-${entity.localName}`}
      onDoubleClick={() => {
        setDraft(entity.localName);
        setEditing(true);
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          aria-label="Generic property name"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
            if (event.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <span className={styles.genericName}>{entity.localName}</span>
      )}
      <span className={styles.genericHint}>generic · no domain or range</span>
    </div>
  );
}
