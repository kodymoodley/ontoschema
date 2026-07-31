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
import { NODE_TYPE, schemaEdges, schemaNodes } from './graphmodel';
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
  const { screenToFlowPosition, getIntersectingNodes, getNode, setCenter } = useReactFlow();
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
    setNodes(derivedNodes.map((node) => ({ ...node, selected: node.id === selectedId })));
    setEdges(derivedEdges.map((edge) => ({ ...edge, selected: isEdgeSelected(edge, selectedId) })));
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
    const node = getNode(focusRequest);
    const canvas = surface.current?.getBoundingClientRect();
    clearFocus();
    if (!node || !canvas) return;

    const width = node.measured?.width ?? node.width ?? 0;
    const height = node.measured?.height ?? node.height ?? 0;
    if (width <= 0 || height <= 0) return;

    void setCenter(node.position.x + width / 2, node.position.y + height / 2, {
      zoom: focusZoom({
        node: { width, height },
        canvas: { width: canvas.width, height: canvas.height },
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
      }),
      duration: 400,
    });
  }, [focusRequest, clearFocus, getNode, setCenter]);

  const isEmpty = nodes.length === 0;

  // Fit only when opening a project that already has content. Auto-fitting as nodes appear
  // would yank the camera every time a shape is dropped, and would zoom an almost-empty
  // canvas far in on its single node.
  const [fitOnOpen] = useState(() => derivedNodes.length > 0);

  return (
    <div className={styles.canvas} data-testid="schema-canvas" ref={surface}>
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
