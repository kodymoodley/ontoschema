import { useCallback, useEffect, useMemo, useRef } from 'react';
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
import { provideFraming } from './framing';
import { useFramingCorrection } from './framingcorrection';

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
  /*
   * The same correction the schema canvas uses, and needed for the same reason: the toolbar's
   * control folds both panels and frames in one press, so the pane this is fitted into is not
   * the pane it was measured against.
   */
  const surface = useRef<HTMLDivElement>(null);
  const frame = useFramingCorrection(surface);
  const frameEverything = useCallback(() => {
    frame((duration) => {
      void fitView({ padding: 0.18, maxZoom: 1, duration });
    }, 180);
  }, [fitView, frame]);

  const shape = nodes.map((node) => node.id).join('|');
  useEffect(() => {
    if (!shape) return;
    const frame = requestAnimationFrame(frameEverything);
    return () => cancelAnimationFrame(frame);
  }, [frameEverything, shape]);

  // The toolbar's button, which is rendered outside React Flow and cannot fit the view itself.
  useEffect(() => provideFraming(frameEverything), [frameEverything]);

  return (
    <div ref={surface} className={styles.canvas} data-testid="taxonomy-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        /*
         * The layers here are the ones `graphmodel.ts` sets, and nothing else adjusts them.
         *
         * This is why the labels were unreadable, and it took a while to find because it is not
         * a z-index problem at all. By default React Flow gives an edge the z-index of the nodes
         * it joins **whenever those nodes have a parent** -- see `getElevatedEdgeZIndex` in
         * `@xyflow/system`, where `sourceNode.parentId ? sourceNode.internals.z : 0` runs before
         * any of the elevate flags are consulted. Every taxonomy class lives inside a module, and
         * a selected node carries a thousand, so selecting a class put its own relations at 1001
         * and every line was painted straight through its own name. Turning off the two elevate
         * props does nothing, because that branch never reads them.
         *
         * `manual` says: use the numbers given and compute nothing. Safe here precisely because
         * these nodes cannot be dragged or stacked -- there is no pile for a selection to climb
         * out of, which is the thing the automatic mode exists for.
         */
        zIndexMode="manual"
        onNodeClick={(_event, node) => {
          if (node.type !== NODE_TYPE.taxonomyClass) return;
          const classId = classIdFromTaxonomyNode(node.id);
          /*
           * Clicking the class that is already selected puts it away. With relations shown, the
           * click that revealed them is the obvious one to hide them with, and hunting for empty
           * canvas to click instead is the sort of small tax that makes an interface feel
           * stubborn -- the same reasoning that made touching the canvas dismiss a drawer.
           */
          select(selection?.id === classId ? null : { kind: 'class', id: classId });
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
