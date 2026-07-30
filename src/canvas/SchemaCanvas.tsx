import { useCallback, useMemo, useRef, useState } from 'react';
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
import type { Connection, EdgeTypes, Node, NodeTypes, OnNodeDrag } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useOntology, useProjectStore, useSelection } from '../projectstore';
import styles from './canvas.module.css';
import { NODE_TYPE, schemaEdges, schemaNodes } from './graphmodel';
import { nextFreePosition } from './layout';
import { PALETTE_MIME } from './Palette';
import type { PaletteKind } from './Palette';

/**
 * The free-form schema surface: classes with their attributes, relations drawn between
 * classes, and generic object properties as standalone pills.
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
  const wrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getIntersectingNodes } = useReactFlow();

  const select = useProjectStore((state) => state.select);
  const createClass = useProjectStore((state) => state.createClass);
  const createDatatypeProperty = useProjectStore((state) => state.createDatatypeProperty);
  const createObjectProperty = useProjectStore((state) => state.createObjectProperty);
  const moveClassById = useProjectStore((state) => state.moveClassById);
  const moveObjectPropertyById = useProjectStore((state) => state.moveObjectPropertyById);
  const moveDatatypePropertyById = useProjectStore((state) => state.moveDatatypePropertyById);
  const setAttributeDomain = useProjectStore((state) => state.setAttributeDomain);

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
    setEdges(derivedEdges.map((edge) => ({ ...edge, selected: edge.id === selectedId })));
  } else if (selectedId !== null && needsSelectionSync(nodes, edges, selectedId)) {
    // Something outside the canvas changed the selection — the hierarchy tree, say. Only
    // corrected when the canvas actually disagrees, so it never fights a click; and only
    // when the selected entity is on the canvas at all, since an attribute attached to a
    // class is a row inside its box rather than a node of its own.
    setNodes((current) => current.map((node) => ({ ...node, selected: node.id === selectedId })));
    setEdges((current) => current.map((edge) => ({ ...edge, selected: edge.id === selectedId })));
  }

  const spawn = useCallback(
    (kind: PaletteKind, position: { x: number; y: number }, dropTargetClassId?: string) => {
      if (kind === 'class') {
        createClass({ position });
        return;
      }
      if (kind === 'genericProperty') {
        createObjectProperty({ kind: 'generic', position });
        return;
      }
      // An attribute dropped straight onto a class attaches to it; otherwise it floats
      // until it is dragged onto one.
      createDatatypeProperty({ domainClassId: dropTargetClassId ?? null, position });
    },
    [createClass, createDatatypeProperty, createObjectProperty],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData(PALETTE_MIME) as PaletteKind | '';
      if (!kind) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const dropTarget = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-class-node-id]');

      spawn(kind, position, dropTarget?.dataset.classNodeId);
    },
    [screenToFlowPosition, spawn],
  );

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (node.type === NODE_TYPE.ontologyClass) {
        moveClassById(node.id, node.position);
        return;
      }
      if (node.type === NODE_TYPE.genericProperty) {
        moveObjectPropertyById(node.id, node.position);
        return;
      }
      if (node.type === NODE_TYPE.floatingAttribute) {
        // Dropping a floating attribute onto a class is how it acquires its domain.
        const overlapping = getIntersectingNodes(node).find(
          (candidate: Node) => candidate.type === NODE_TYPE.ontologyClass,
        );
        if (overlapping) setAttributeDomain(node.id, overlapping.id);
        else moveDatatypePropertyById(node.id, node.position);
      }
    },
    [
      getIntersectingNodes,
      moveClassById,
      moveDatatypePropertyById,
      moveObjectPropertyById,
      setAttributeDomain,
    ],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      createObjectProperty({
        kind: 'scoped',
        domainClassId: connection.source,
        rangeClassId: connection.target,
      });
    },
    [createObjectProperty],
  );

  const isEmpty = nodes.length === 0;

  // Fit only when opening a project that already has content. Auto-fitting as nodes appear
  // would yank the camera every time a shape is dropped, and would zoom an almost-empty
  // canvas far in on its single node.
  const [fitOnOpen] = useState(() => nodes.length > 0);

  return (
    <div className={styles.canvas} ref={wrapper} data-testid="schema-canvas">
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
          else if (node.type === NODE_TYPE.genericProperty)
            select({ kind: 'objectProperty', id: node.id });
          else if (node.type === NODE_TYPE.floatingAttribute)
            select({ kind: 'datatypeProperty', id: node.id });
        }}
        onEdgeClick={(_event, edge) => {
          if (edge.type === 'relation') select({ kind: 'objectProperty', id: edge.id });
        }}
        onPaneClick={() => select(null)}
        minZoom={0.2}
        maxZoom={2.5}
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
    </div>
  );
}

/**
 * True only when `id` belongs to something drawn on the canvas that is not currently
 * marked selected. Requiring the element to exist is what stops the reconciliation from
 * looping when the selection is an attribute row or the ontology header.
 */
function needsSelectionSync(
  nodes: readonly { id: string; selected?: boolean }[],
  edges: readonly { id: string; selected?: boolean }[],
  id: string,
): boolean {
  const element =
    nodes.find((node) => node.id === id) ?? edges.find((edge) => edge.id === id) ?? null;
  return element !== null && !element.selected;
}

export function SchemaCanvas(props: SchemaCanvasProps) {
  return (
    <ReactFlowProvider>
      <SchemaCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

/** Used by the palette's click fallback, which has no drop coordinates to work from. */
export function useSpawnAtFreeSpot() {
  const ontology = useOntology();
  const createClass = useProjectStore((state) => state.createClass);
  const createDatatypeProperty = useProjectStore((state) => state.createDatatypeProperty);
  const createObjectProperty = useProjectStore((state) => state.createObjectProperty);

  return useCallback(
    (kind: PaletteKind) => {
      const taken = [
        ...ontology.classes.map((entity) => entity.position),
        ...ontology.objectProperties.map((entity) => entity.position),
        ...ontology.datatypeProperties
          .filter((entity) => entity.domainClassId === null)
          .map((entity) => entity.position),
      ];
      const position = nextFreePosition(taken);
      if (kind === 'class') createClass({ position });
      else if (kind === 'genericProperty') createObjectProperty({ kind: 'generic', position });
      else createDatatypeProperty({ position });
    },
    [ontology, createClass, createDatatypeProperty, createObjectProperty],
  );
}
