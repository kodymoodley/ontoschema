import { BaseEdge, EdgeLabelRenderer, Position, getSmoothStepPath } from '@xyflow/react';
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
/**
 * Slides an endpoint along the side of the box it attaches to.
 *
 * Along the side rather than square to the line, so the end stays on the border: a left or
 * right handle moves up and down, a top or bottom handle moves across. Shifting perpendicular
 * to the line would separate the edges but leave them floating off the box they belong to.
 */
function slide(x: number, y: number, side: Position, offset: number) {
  if (offset === 0) return { x, y };
  return side === Position.Left || side === Position.Right
    ? { x, y: y + offset }
    : { x: x + offset, y };
}

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
    sourceOffset?: number;
    targetOffset?: number;
    route?: { path: string; label: { x: number; y: number } };
  };
  const select = useProjectStore((state) => state.select);
  const detachUsage = useProjectStore((state) => state.detachUsageById);

  /*
   * Right angles, not a curve, and the same generator the subclass links beside it already use
   * -- with the same corner radius, so the two kinds of line differ by colour and arrowhead
   * rather than by how they are drawn. `chooseSides` has already picked the pair of sides the
   * classes face each other across, so the step needed here is the plain one between them.
   */
  /*
   * Fanned apart when more than one relation joins the same two classes, which is what an
   * relation meets the same side of the same box. There is one handle per side, so without this
   * they attach at the identical point and one edge's arrowhead sits exactly on another's tail,
   * drawing what looks like a single line with a head at both ends. `bundles.ts` works out how
   * far each end moves; nothing shifts an end that has its side to itself.
   */
  const from = slide(sourceX, sourceY, sourcePosition, payload.sourceOffset ?? 0);
  const to = slide(targetX, targetY, targetPosition, payload.targetOffset ?? 0);

  const [stepped, steppedLabelX, steppedLabelY] = getSmoothStepPath({
    sourceX: from.x,
    sourceY: from.y,
    targetX: to.x,
    targetY: to.y,
    sourcePosition,
    targetPosition,
    borderRadius: 6,
  });

  /*
   * A route is a path the canvas worked out for itself: out of one class, along a lane clear of
   * every node, and down into the other. It arrives drawn rather than as points, because the
   * geometry belongs to the canvas and this module may not reach into it.
   *
   * Only the taxonomy view supplies one, and only because it can. Its layout is derived and its
   * nodes cannot be dragged, so there is a known top and bottom to the diagram and lanes can be
   * handed out for every visible edge at once. Schema classes are placed by hand, anywhere, and
   * moved while you watch; lanes there would have to be re-found on every frame of a drag. So
   * the schema view steps between the facing sides instead, which follows a class as it moves
   * and costs nothing to work out.
   */
  const route = payload.route;
  const path = route ? route.path : stepped;
  const labelX = route ? route.label.x : steppedLabelX;
  const labelY = route ? route.label.y : steppedLabelY;

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
