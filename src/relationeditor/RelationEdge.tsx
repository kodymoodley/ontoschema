import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import type { ObjectProperty } from '../ontologymodel';
import { useProjectStore } from '../projectstore';
import styles from './relationeditor.module.css';

/**
 * A scoped object property, drawn as a directed edge from its domain class to its range
 * class. The arrow and the accent colour distinguish it at a glance from a subclass link,
 * which is grey and carries a hollow triangle.
 */
export function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps) {
  const entity = (data as { entity?: ObjectProperty } | undefined)?.entity;
  const select = useProjectStore((state) => state.select);

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd="url(#ontoschema-relation-arrow)"
        className={`${styles.relationPath} ${selected ? styles.relationPathSelected : ''}`}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          className={`${styles.relationLabel} ${selected ? styles.relationLabelSelected : ''}`}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          data-relation-name={entity?.localName}
          onClick={(event) => {
            event.stopPropagation();
            select({ kind: 'objectProperty', id });
          }}
        >
          {entity?.localName ?? 'relation'}
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

/**
 * Marker definitions, mounted once per canvas. React Flow renders edges into a shared SVG,
 * so the markers must exist in that document for `markerEnd` to resolve.
 */
export function RelationMarkers() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
      <defs>
        <marker
          id="ontoschema-relation-arrow"
          viewBox="0 0 12 12"
          markerWidth="9"
          markerHeight="9"
          refX="10"
          refY="6"
          orient="auto-start-reverse"
        >
          <path d="M 1 1 L 11 6 L 1 11 z" fill="var(--accent-relation)" />
        </marker>
        <marker
          id="ontoschema-subclass-triangle"
          viewBox="0 0 14 14"
          markerWidth="13"
          markerHeight="13"
          refX="12"
          refY="7"
          orient="auto-start-reverse"
        >
          {/* Hollow triangle: the UML generalization arrowhead, pointing at the superclass. */}
          <path
            d="M 1 1 L 12 7 L 1 13 z"
            fill="var(--surface-canvas)"
            stroke="var(--accent-taxonomy)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </marker>
      </defs>
    </svg>
  );
}
