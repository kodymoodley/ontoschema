import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import styles from './canvas.module.css';
import type { TaxonomyClassNodeData, TaxonomyModuleNodeData } from './graphmodel';

/**
 * Taxonomy-view renderers. These belong to the canvas rather than the class editor because
 * they are a projection for reading a hierarchy, not an editing surface: no inline rename,
 * no handles to drag, no attribute rows.
 */

export function TaxonomyModuleNode({ data }: NodeProps) {
  const { label, memberCount } = data as TaxonomyModuleNodeData;
  return (
    <div className={styles.moduleNode} data-taxonomy-module={label} data-member-count={memberCount}>
      <div className={styles.moduleLabel}>
        <span className={styles.moduleName}>{label}</span>
        <span className={styles.moduleCount}>
          {memberCount} {memberCount === 1 ? 'class' : 'classes'}
        </span>
      </div>
    </div>
  );
}

export function TaxonomyClassNode({ data, selected }: NodeProps) {
  const { entity, attributeCount, isRoot } = data as TaxonomyClassNodeData;
  return (
    <div
      className={[
        styles.taxonomyNode,
        isRoot ? styles.taxonomyNodeRoot : '',
        selected ? styles.taxonomyNodeSelected : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-taxonomy-class={entity.localName}
    >
      {/* Edges attach top (to the superclass) and bottom (to subclasses). */}
      <Handle
        type="source"
        position={Position.Top}
        className={styles.taxonomyHandle}
        isConnectable={false}
      />
      <span className={styles.taxonomyName} title={entity.localName}>
        {entity.localName}
      </span>
      <span className={styles.taxonomyMeta}>
        {attributeCount > 0
          ? `${attributeCount} ${attributeCount === 1 ? 'attribute' : 'attributes'}`
          : 'no attributes'}
      </span>
      <Handle
        type="target"
        position={Position.Bottom}
        className={styles.taxonomyHandle}
        isConnectable={false}
      />
    </div>
  );
}
