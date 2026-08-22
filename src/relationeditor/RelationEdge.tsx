import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import type { Relation, PropertyUsage } from '../ontologymodel';
import { useProjectStore } from '../projectstore';
import styles from './relationeditor.module.css';

/**
 * One use of an relation between two classes, drawn as a directed edge from the
 * subject class to the object class. The arrow and the accent colour distinguish it from a
 * subclass link, which is grey and carries a hollow triangle.
 *
 * The edge is the *usage*, not the property: the same property can be drawn several times
 * between different pairs of classes, and each drawing is its own constraint.
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
  const payload = data as {
    usage?: PropertyUsage;
    property?: Relation;
    shared?: boolean;
    detour?: { x: number; y: number };
  };
  const select = useProjectStore((state) => state.select);
  const detachUsage = useProjectStore((state) => state.detachUsageById);

  const [bezier, bezierLabelX, bezierLabelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  /*
   * A detour is a single point the canvas worked out, put there so the line passes around the
   * classes it has nothing to do with. Drawn as one quadratic curve through it rather than as a
   * polyline: the bend stays smooth, and the control point is doubled back from the midpoint so
   * the curve actually reaches the detour rather than merely leaning towards it.
   */
  const detour = payload.detour;
  const path = detour
    ? `M ${sourceX},${sourceY} Q ${2 * detour.x - (sourceX + targetX) / 2},${
        2 * detour.y - (sourceY + targetY) / 2
      } ${targetX},${targetY}`
    : bezier;
  const labelX = detour ? detour.x : bezierLabelX;
  const labelY = detour ? detour.y : bezierLabelY;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd="url(#ontoschema-relation-arrow)"
        className={`${styles.relationPath} ${selected ? styles.relationPathSelected : ''}`}
      />
      <EdgeLabelRenderer>
        <span
          className={styles.relationLabelGroup}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          <button
            type="button"
            className={`${styles.relationLabel} ${selected ? styles.relationLabelSelected : ''}`}
            data-relation-name={payload.property?.localName}
            data-usage-id={id}
            title={
              payload.shared
                ? `${payload.property?.localName} is also used elsewhere`
                : payload.property?.localName
            }
            onClick={(event) => {
              event.stopPropagation();
              if (payload.property) select({ kind: 'relation', id: payload.property.id });
            }}
          >
            {payload.property?.localName ?? 'relation'}
            {payload.shared ? <span className={styles.sharedMark}>↗</span> : null}
          </button>
          {selected ? (
            <button
              type="button"
              className={styles.relationRemove}
              aria-label={`Remove this ${payload.property?.localName ?? 'relation'} relation`}
              title="Remove this use — the relation stays in the list"
              onClick={(event) => {
                event.stopPropagation();
                detachUsage(id);
              }}
            >
              ×
            </button>
          ) : null}
        </span>
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
