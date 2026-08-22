import { useEffect, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import type { EdgeTypes, NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useOntology, useProjectStore, useSelection, useTaxonomyRelations } from '../projectstore';
import styles from './canvas.module.css';
import { NODE_TYPE, classIdFromTaxonomyNode, taxonomyGraph } from './graphmodel';

/**
 * The read-optimised taxonomy surface: one auto-laid-out top-down tree per root class,
 * each wrapped in its own module box, showing subclass links and nothing else.
 *
 * Nothing here is draggable — the layout is derived from the model, so it is always tidy
 * and always reflects the current hierarchy. Editing happens in the tree panel.
 */

interface TaxonomyCanvasProps {
  nodeTypes: NodeTypes;
  edgeTypes: EdgeTypes;
}

function TaxonomyCanvasInner({ nodeTypes, edgeTypes }: TaxonomyCanvasProps) {
  const ontology = useOntology();
  const selection = useSelection();
  const select = useProjectStore((state) => state.select);

  const relations = useTaxonomyRelations();
  const { nodes, edges } = useMemo(
    () => taxonomyGraph(ontology, selection?.id ?? null, relations),
    [ontology, selection?.id, relations],
  );

  // The layout is derived, so the camera is framed explicitly whenever the shape of the
  // hierarchy changes. Fitting through the instance (rather than the `fitView` prop) is
  // what reliably honours maxZoom, so a two-class taxonomy is not blown up to fill the pane.
  const { fitView } = useReactFlow();
  const shape = nodes.map((node) => node.id).join('|');
  useEffect(() => {
    if (!shape) return;
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.18, maxZoom: 1, duration: 180 });
    });
    return () => cancelAnimationFrame(frame);
  }, [fitView, shape]);

  return (
    <div className={styles.canvas} data-testid="taxonomy-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_event, node) => {
          if (node.type === NODE_TYPE.taxonomyClass) {
            select({ kind: 'class', id: classIdFromTaxonomyNode(node.id) });
          }
        }}
        onPaneClick={() => select(null)}
        zoomOnDoubleClick={false}
        minZoom={0.15}
        maxZoom={2}
        defaultViewport={{ x: 24, y: 24, zoom: 1 }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={null}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          color="var(--border-default)"
        />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>

      {ontology.classes.length === 0 ? (
        <div className={styles.emptyCanvas}>
          <p className={styles.emptyTitle}>No classes to arrange</p>
          <p className={styles.emptyBody}>
            Create classes on the schema canvas, then set superclasses in the hierarchy panel. Each
            root class gets its own module here.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function TaxonomyCanvas(props: TaxonomyCanvasProps) {
  return (
    <ReactFlowProvider>
      <TaxonomyCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

/* ------------------------------------------------- taxonomy node renderers */

export { TaxonomyClassNode, TaxonomyModuleNode } from './TaxonomyNodes';
