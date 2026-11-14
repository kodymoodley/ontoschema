import { Position, getSmoothStepPath } from '@xyflow/react';
import type { ConnectionLineComponentProps } from '@xyflow/react';
import { isClassSide } from '../ontologymodel';
import type { ClassSide } from '../ontologymodel';
import styles from './relationeditor.module.css';

/**
 * The line that follows the pointer while a relation is being drawn.
 *
 * Stepped like the relations it becomes, so what is drawn looks like what will be there. It is
 * faint and moving while it has nowhere to land. Over a class it turns solid and ends where the
 * relation will attach: on the side the pointer is near, or, over the middle, on the side facing
 * where the line came from, which is where the canvas will route it.
 */
export function ConnectionLine({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
  toNode,
  toHandle,
}: ConnectionLineComponentProps) {
  const landing =
    toNode && toHandle ? landingOn(toNode, toHandle.id, { x: fromX, y: fromY }) : null;
  const end = landing ?? { x: toX, y: toY, position: toPosition };

  const [path] = getSmoothStepPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: end.x,
    targetY: end.y,
    targetPosition: end.position,
    borderRadius: 6,
  });

  return (
    <g
      className={`${styles.connectionLine} ${landing ? styles.connectionLineLanding : ''}`}
      data-testid="connection-line"
    >
      <path d={path} />
      <circle cx={end.x} cy={end.y} r={4} />
    </g>
  );
}

const POSITION_OF: Record<ClassSide, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

/** Where on a class a relation let go now would attach. */
function landingOn(
  node: NonNullable<ConnectionLineComponentProps['toNode']>,
  handleId: string | null | undefined,
  from: { x: number; y: number },
) {
  const { x, y } = node.internals.positionAbsolute;
  const width = node.measured.width ?? 0;
  const height = node.measured.height ?? 0;
  const centre = { x: x + width / 2, y: y + height / 2 };

  // A side's own target names its side; the middle's does not, and the facing side is used.
  const named = handleId?.slice(handleId.indexOf('-') + 1);
  const side: ClassSide = isClassSide(named) ? named : facing(centre, width, height, from);

  const point: Record<ClassSide, { x: number; y: number }> = {
    left: { x, y: centre.y },
    right: { x: x + width, y: centre.y },
    top: { x: centre.x, y },
    bottom: { x: centre.x, y: y + height },
  };
  return { ...point[side], position: POSITION_OF[side] };
}

/** The side of a box that faces a point, judged against the box's own proportions. */
function facing(
  centre: { x: number; y: number },
  width: number,
  height: number,
  from: { x: number; y: number },
): ClassSide {
  const dx = (from.x - centre.x) / (width || 1);
  const dy = (from.y - centre.y) / (height || 1);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}
