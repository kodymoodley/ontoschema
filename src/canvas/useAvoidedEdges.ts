import { useEffect, useMemo, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import type { Point } from '../designsystem';
import type { RoutingScene } from './avoidrouter';
import { listenForRoutes, requestRoutes } from './backgroundrouting';
import { EDGE_TYPE } from './graphmodel';
import type { RelationEdgeData } from './graphmodel';
import { sideOfHandle } from './layout';

/**
 * The schema canvas's relation edges, each carrying the route that takes it around the classes.
 *
 * Built from what React Flow is drawing rather than from the schema: where each class is this
 * frame, mid-drag included, and how big it measured. Until the first routes come back -- the
 * router loads on first use -- or for a line drawn since, an edge has no route and is drawn as a
 * plain step, as it was before there was a router.
 */

/** What the router needs from the canvas, or `null` until every class has been measured. */
export function routingScene(nodes: readonly Node[], edges: readonly Edge[]): RoutingScene | null {
  const shapes: RoutingScene['shapes'][number][] = [];
  for (const node of nodes) {
    const { width, height } = node.measured ?? {};
    if (!width || !height) return null;
    shapes.push({ id: node.id, x: node.position.x, y: node.position.y, width, height });
  }

  const connectors: RoutingScene['connectors'][number][] = [];
  for (const edge of edges) {
    if (edge.type !== EDGE_TYPE.relation) continue;
    const from = sideOfHandle(edge.sourceHandle);
    const to = sideOfHandle(edge.targetHandle);
    if (!from || !to) continue;
    const data = edge.data as RelationEdgeData | undefined;
    connectors.push({
      id: edge.id,
      from: { shape: edge.source, side: from, offset: data?.sourceOffset ?? 0 },
      to: { shape: edge.target, side: to, offset: data?.targetOffset ?? 0 },
    });
  }
  return { shapes, connectors };
}

const NO_ROUTES: ReadonlyMap<string, Point[]> = new Map();

const samePoints = (a: readonly Point[], b: readonly Point[]) =>
  a.length === b.length &&
  a.every((point, index) => point.x === b[index]!.x && point.y === b[index]!.y);

/**
 * The new routes, keeping the previous array for every route that has not changed.
 *
 * The worker answers with every route each time, and most have not moved: dragging one class
 * re-routes the few lines near it. An edge handed a new array is redrawn even when it describes
 * the same line, so without this a drag redrew every line on the canvas on every answer.
 */
export function keepUnchanged(
  previous: ReadonlyMap<string, Point[]>,
  next: ReadonlyMap<string, Point[]>,
): ReadonlyMap<string, Point[]> {
  const kept = new Map<string, Point[]>();
  for (const [id, points] of next) {
    const before = previous.get(id);
    kept.set(id, before && samePoints(before, points) ? before : points);
  }
  return kept;
}

export function useAvoidedEdges<E extends Edge>(nodes: readonly Node[], edges: readonly E[]): E[] {
  const [routes, setRoutes] = useState(NO_ROUTES);
  useEffect(
    () => listenForRoutes((next) => setRoutes((previous) => keepUnchanged(previous, next))),
    [],
  );

  /*
   * Selecting a class gives React Flow new node objects without moving anything, so the scene is
   * compared by what it says before it is sent: an unchanged scene would be routed for nothing,
   * and every edge redrawn with the same route.
   */
  const scene = useMemo(() => routingScene(nodes, edges), [nodes, edges]);
  const sent = useRef('');
  useEffect(() => {
    if (!scene) return;
    const said = JSON.stringify(scene);
    if (said === sent.current) return;
    sent.current = said;
    requestRoutes(scene);
  }, [scene]);

  // The same edge with the same route is handed back as the same object, so it is not redrawn.
  const routed = useRef(new WeakMap<E, { detour: Point[]; edge: E }>());
  return useMemo(
    () =>
      edges.map((edge) => {
        const detour = routes.get(edge.id);
        if (!detour) return edge;
        const before = routed.current.get(edge);
        if (before?.detour === detour) return before.edge;
        const withRoute = { ...edge, data: { ...edge.data, detour } };
        routed.current.set(edge, { detour, edge: withRoute });
        return withRoute;
      }),
    [edges, routes],
  );
}
