import { BaseEdge, getSmoothStepPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import styles from './relationeditor.module.css';

/**
 * A subclass link, drawn in the taxonomy's visual language: a grey orthogonal line ending
 * in a hollow triangle at the superclass. Orthogonal routing and the UML generalization
 * arrowhead make hierarchy immediately distinguishable from an relation, and it is
 * the same shape a Mermaid or PlantUML class diagram would use.
 */
export function SubClassEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 6,
  });

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd="url(#ontoschema-subclass-triangle)"
      className={styles.subClassPath}
    />
  );
}
