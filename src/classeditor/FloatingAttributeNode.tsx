import type { NodeProps } from '@xyflow/react';
import { xsdDatatypeCurie } from '../annotationvocabulary';
import type { DatatypeProperty } from '../ontologymodel';
import styles from './classeditor.module.css';

/**
 * A datatype property that has been created but not yet attached to a class. It sits on
 * the canvas until it is dragged onto a class, which sets its rdfs:domain.
 */
export function FloatingAttributeNode({ data, selected }: NodeProps) {
  const { entity } = data as unknown as { entity: DatatypeProperty };
  return (
    <div
      className={`${styles.floatingAttribute} ${selected ? styles.selected : ''}`}
      data-attribute-node-id={entity.id}
      data-testid={`floating-attribute-${entity.localName}`}
    >
      <div>
        <span className={styles.floatingName}>{entity.localName}</span>{' '}
        <span className={styles.floatingRange}>{xsdDatatypeCurie(entity.range)}</span>
        <span className={styles.floatingHint}>Drag onto a class to attach</span>
      </div>
    </div>
  );
}
