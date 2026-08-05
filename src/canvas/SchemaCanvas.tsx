import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import type { Connection, EdgeTypes, NodeTypes, OnNodeDrag } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  DRAG_MIME,
  decodeDragPayload,
  useOntology,
  useProjectStore,
  useSelection,
} from '../projectstore';
import styles from './canvas.module.css';
import { DOUBLE_TAP_MS, OWNS_DOUBLE_CLICK, TAP_SLOP_PX, tapDistance } from './gestures';
import { NODE_TYPE, sameClassNode, sameRelationEdge, schemaEdges, schemaNodes } from './graphmodel';
import { focusZoom, nextFreePosition } from './layout';

/** How far the viewport may be pushed, including by a focus request. */
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;

/**
 * The free-form schema surface: classes carrying their attributes, and relations drawn
 * between classes.
 *
 * Renderers are injected rather than imported, so this module stays independent of the
 * class and relation editors.
 */

interface SchemaCanvasProps {
  nodeTypes: NodeTypes;
  edgeTypes: EdgeTypes;
}

function SchemaCanvasInner({ nodeTypes, edgeTypes }: SchemaCanvasProps) {
  const ontology = useOntology();
  const selection = useSelection();
  const { screenToFlowPosition, getIntersectingNodes, getNode, setCenter, fitView } =
    useReactFlow();
  const surface = useRef<HTMLDivElement>(null);

  const select = useProjectStore((state) => state.select);
  const createClass = useProjectStore((state) => state.createClass);
  const createAttributeOn = useProjectStore((state) => state.createAttributeOn);
  const attachPropertyToClass = useProjectStore((state) => state.attachPropertyToClass);
  const moveClassById = useProjectStore((state) => state.moveClassById);
  const beginConnection = useProjectStore((state) => state.beginConnection);

  const [rejectedDrop, setRejectedDrop] = useState<string | null>(null);

  /**
   * The ontology is the source of truth for *what* exists; React Flow owns the transient
   * interaction state (which node is selected, where a node is while it is being dragged).
   * The two are reconciled below rather than merged, so a click never rebuilds the graph
   * and multi-click gestures survive.
   */
  const derivedNodes = useMemo(() => schemaNodes(ontology), [ontology]);
  const derivedEdges = useMemo(() => schemaEdges(ontology), [ontology]);

  const [nodes, setNodes, onNodesChange] = useNodesState(derivedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(derivedEdges);
  const [adopted, setAdopted] = useState({ nodes: derivedNodes, edges: derivedEdges });

  const selectedId = selection?.id ?? null;

  // Adopt a new model. Done during render (not in an effect) so React Flow never paints a
  // frame with a stale graph.
  if (adopted.nodes !== derivedNodes || adopted.edges !== derivedEdges) {
    setAdopted({ nodes: derivedNodes, edges: derivedEdges });
    setNodes((current) => {
      const existing = new Map(current.map((node) => [node.id, node]));
      return derivedNodes.map((node) => {
        const selected = node.id === selectedId;
        const previous = existing.get(node.id);

        /*
         * A class that did not change keeps the exact object React Flow already holds, which
         * is what stops one rename re-rendering all of them. It also carries the measured
         * size across: that is what the handles and the minimap are positioned from, so
         * dropping it would make the node fall back to its estimate for a frame.
         */
        if (previous && Boolean(previous.selected) === selected && sameClassNode(previous, node)) {
          return previous;
        }

        return {
          ...node,
          selected,
          ...(previous?.measured ? { measured: previous.measured } : {}),
        };
      });
    });
    setEdges((current) => {
      const existing = new Map(current.map((edge) => [edge.id, edge]));
      return derivedEdges.map((edge) => {
        const selected = isEdgeSelected(edge, selectedId);
        const previous = existing.get(edge.id);
        if (
          previous &&
          Boolean(previous.selected) === selected &&
          sameRelationEdge(previous, edge)
        ) {
          return previous;
        }
        return { ...edge, selected };
      });
    });
  } else if (selectedId !== null && needsNodeSelectionSync(nodes, selectedId)) {
    // Something outside the canvas changed the selection — the hierarchy tree, say. Only
    // corrected when the canvas actually disagrees, so it never fights a click; and only
    // when the selected entity is a class node, since properties are not nodes.
    setNodes((current) => current.map((node) => ({ ...node, selected: node.id === selectedId })));
  }

  /**
   * Which class the pointer is over, tested against the graph rather than the DOM.
   * `elementFromPoint` would report whatever overlay happens to be on top — the minimap or
   * the controls — and silently refuse a drop onto the class underneath it.
   */
  const classAt = useCallback(
    (clientX: number, clientY: number): string | undefined => {
      const point = screenToFlowPosition({ x: clientX, y: clientY });
      return getIntersectingNodes({ x: point.x, y: point.y, width: 1, height: 1 }).find(
        (node) => node.type === NODE_TYPE.ontologyClass,
      )?.id;
    },
    [getIntersectingNodes, screenToFlowPosition],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const payload = decodeDragPayload(event.dataTransfer.getData(DRAG_MIME));
      if (!payload) return;

      if (payload.kind === 'newClass') {
        createClass({ position: screenToFlowPosition({ x: event.clientX, y: event.clientY }) });
        return;
      }

      // Both attribute drops require a class to land on: a datatype property cannot exist
      // on its own, so there is nothing sensible to create on empty canvas.
      const classId = classAt(event.clientX, event.clientY);
      if (!classId) {
        setRejectedDrop('Drop a datatype property onto a class — it has to belong to one.');
        window.setTimeout(() => setRejectedDrop(null), 2600);
        return;
      }

      if (payload.kind === 'newAttribute') createAttributeOn(classId);
      else attachPropertyToClass(payload.propertyId, classId);
    },
    [attachPropertyToClass, classAt, createAttributeOn, createClass, screenToFlowPosition],
  );

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (node.type === NODE_TYPE.ontologyClass) moveClassById(node.id, node.position);
    },
    [moveClassById],
  );

  /**
   * Drawing an edge does not invent a property. It records the pair of classes and lets the
   * connection picker decide which object property this is — an existing one, or a new one.
   */
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      beginConnection({ subjectClassId: connection.source, objectClassId: connection.target });
    },
    [beginConnection],
  );

  /*
   * A class node has asked to be brought into focus. It is answered here rather than in the
   * node because moving the viewport is the canvas's business, and the two modules may not
   * import one another.
   */
  const focusRequest = useProjectStore((state) => state.focusRequest);
  const clearFocus = useProjectStore((state) => state.clearFocus);
  useEffect(() => {
    if (!focusRequest) return;

    /*
     * A request outlives a canvas that cannot yet serve it. React Flow needs a frame or two
     * to adopt a node and measure it, and a class dropped and immediately double-clicked is
     * inside that window: clearing the request first meant the gesture was answered with
     * nothing at all, and the user had to try again without being told why. `nodes` is in the
     * dependencies so the attempt repeats as soon as the canvas has caught up.
     */
    if (!ontology.classes.some((entity) => entity.id === focusRequest)) {
      clearFocus();
      return;
    }

    /*
     * Only a real measurement will do. React Flow leaves `measured` empty until its resize
     * observer has run — the size estimate a node carries is for deciding whether it can be
     * drawn, not for framing it — and zooming from the estimate put a new empty class at 46%
     * of the canvas instead of 35%. Waiting a frame for the truth is invisible; guessing is
     * not.
     */
    const node = getNode(focusRequest);
    const canvas = surface.current?.getBoundingClientRect();
    const width = node?.measured?.width ?? 0;
    const height = node?.measured?.height ?? 0;
    if (!node || !canvas || width <= 0 || height <= 0) return;

    clearFocus();
    void setCenter(node.position.x + width / 2, node.position.y + height / 2, {
      zoom: focusZoom({
        node: { width, height },
        canvas: { width: canvas.width, height: canvas.height },
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
      }),
      duration: 400,
    });
  }, [focusRequest, clearFocus, getNode, nodes, ontology.classes, setCenter]);

  /**
   * Double-clicking, or double-tapping, bare canvas frames the whole schema again — the way
   * back out from having focused a single class, without reaching for the controls.
   *
   * Everything that owns the gesture for itself is excluded rather than the pane being named
   * directly: the double-click on a node bubbles up here too, and the dotted background is
   * its own element sitting over the pane.
   */
  const frameEverything = useCallback(() => {
    void fitView({ padding: 0.2, maxZoom: 1, duration: 400 });
  }, [fitView]);

  const onSurfaceDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(OWNS_DOUBLE_CLICK)) return;
      frameEverything();
    },
    [frameEverything],
  );

  /*
   * Touch is recognised separately, and from a capture-phase listener on the wrapper.
   * React Flow's pan-and-zoom layer swallows the pane's touch events whole — it both
   * preventDefaults them, so the browser never synthesizes the double-click the mouse path
   * relies on, and stops their propagation, so a React handler further up never runs. Only
   * capture gets in ahead of it. A tap that has not moved, following another in the same
   * spot, is a double-tap.
   */
  const tap = useRef<{ x: number; y: number; at: number } | null>(null);
  const tapStart = useRef<{ x: number; y: number } | null>(null);

  const onSurfaceTouchStart = useCallback((event: TouchEvent) => {
    const touch = event.touches[0];
    tapStart.current =
      event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : null;
  }, []);

  const onSurfaceTouchEnd = useCallback(
    (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      const start = tapStart.current;
      tapStart.current = null;

      // Only a single finger lifting cleanly off bare canvas counts. A pinch, a pan, or a
      // tap on something that owns the gesture all cancel any tap in progress.
      const cancelled =
        !touch ||
        !start ||
        event.touches.length > 0 ||
        tapDistance(touch, start) > TAP_SLOP_PX ||
        (event.target as HTMLElement).closest(OWNS_DOUBLE_CLICK) !== null;
      if (cancelled) {
        tap.current = null;
        return;
      }

      const previous = tap.current;
      const now = Date.now();
      const isSecondTap =
        previous !== null &&
        now - previous.at <= DOUBLE_TAP_MS &&
        tapDistance(touch, previous) <= TAP_SLOP_PX;

      tap.current = isSecondTap ? null : { x: touch.clientX, y: touch.clientY, at: now };
      if (isSecondTap) frameEverything();
    },
    [frameEverything],
  );

  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const options = { capture: true, passive: true } as const;
    element.addEventListener('touchstart', onSurfaceTouchStart, options);
    element.addEventListener('touchend', onSurfaceTouchEnd, options);
    return () => {
      element.removeEventListener('touchstart', onSurfaceTouchStart, options);
      element.removeEventListener('touchend', onSurfaceTouchEnd, options);
    };
  }, [onSurfaceTouchStart, onSurfaceTouchEnd]);

  const isEmpty = nodes.length === 0;

  // Fit only when opening a project that already has content. Auto-fitting as nodes appear
  // would yank the camera every time a shape is dropped, and would zoom an almost-empty
  // canvas far in on its single node.
  const [fitOnOpen] = useState(() => derivedNodes.length > 0);

  return (
    <div
      className={styles.canvas}
      data-testid="schema-canvas"
      ref={surface}
      onDoubleClick={onSurfaceDoubleClick}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onDrop={onDrop}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onNodeClick={(_event, node) => {
          if (node.type === NODE_TYPE.ontologyClass) select({ kind: 'class', id: node.id });
        }}
        onPaneClick={() => select(null)}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        fitView={fitOnOpen}
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        defaultViewport={{ x: 24, y: 24, zoom: 1 }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={null}
        // Double-click renames a node here, so it must not also be a zoom gesture — the
        // zoom would shift the shape out from under the pointer mid-gesture.
        zoomOnDoubleClick={false}
        nodesConnectable
        elevateEdgesOnSelect
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          color="var(--border-default)"
        />
        <Controls showInteractive={false} position="bottom-right" />
        <MiniMap pannable zoomable position="bottom-left" nodeStrokeWidth={2} />
      </ReactFlow>

      {isEmpty ? (
        <div className={styles.emptyCanvas}>
          <p className={styles.emptyTitle}>Nothing on the canvas yet</p>
          <p className={styles.emptyBody}>
            Drag a <strong>Class</strong> from the palette to begin, then drop datatype properties
            onto it and connect classes to create relations.
          </p>
        </div>
      ) : null}

      {rejectedDrop ? (
        <p className={styles.dropHint} role="status" data-testid="drop-rejected">
          {rejectedDrop}
        </p>
      ) : null}
    </div>
  );
}

function isEdgeSelected(edge: { id: string; data?: unknown }, selectedId: string | null): boolean {
  if (selectedId === null) return false;
  const data = edge.data as { property?: { id: string } } | undefined;
  // Selecting a property highlights every edge that uses it.
  return edge.id === selectedId || data?.property?.id === selectedId;
}

/**
 * True only when `id` is a class node that is not currently marked selected. Requiring the
 * node to exist is what stops the reconciliation from looping when the selection is a
 * property, which has no node of its own.
 */
function needsNodeSelectionSync(
  nodes: readonly { id: string; selected?: boolean }[],
  id: string,
): boolean {
  const node = nodes.find((candidate) => candidate.id === id);
  return node !== undefined && !node.selected;
}

export function SchemaCanvas(props: SchemaCanvasProps) {
  return (
    <ReactFlowProvider>
      <SchemaCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

/**
 * The palette's click fallback, which has no drop coordinates to work from. A class lands
 * in the first free grid slot; an attribute goes onto the selected class.
 */
export function usePaletteCreate() {
  const ontology = useOntology();
  const selection = useSelection();
  const createClass = useProjectStore((state) => state.createClass);
  const createAttributeOn = useProjectStore((state) => state.createAttributeOn);

  const selectedClassId = selection?.kind === 'class' ? selection.id : null;

  const create = useCallback(
    (kind: 'class' | 'attribute') => {
      if (kind === 'class') {
        createClass({ position: nextFreePosition(ontology.classes.map((e) => e.position)) });
        return;
      }
      if (selectedClassId) createAttributeOn(selectedClassId);
    },
    [ontology.classes, createClass, createAttributeOn, selectedClassId],
  );

  return { create, canCreateAttribute: selectedClassId !== null };
}
