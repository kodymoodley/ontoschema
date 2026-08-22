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
    route?: { path: string; label: { x: number; y: number } };
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
   * A route is the right-angled path the canvas worked out: out of one class, along a lane
   * clear of every node, and down into the other. It arrives drawn rather than as points,
   * because the geometry belongs to the canvas and this module may not reach into it. Only the
   * taxonomy view supplies one; the schema canvas positions its classes by hand and a curve
   * suits it.
   */
  const route = payload.route;
  const path = route ? route.path : bezier;
  const labelX = route ? route.label.x : bezierLabelX;
  const labelY = route ? route.label.y : bezierLabelY;

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
