import type { EdgeTypes, NodeTypes } from '@xyflow/react';
import { EDGE_TYPE, NODE_TYPE, TaxonomyClassNode, TaxonomyModuleNode } from '../canvas';
import { ClassNode, FloatingAttributeNode } from '../classeditor';
import { GenericPropertyNode, RelationEdge, SubClassEdge } from '../relationeditor';

/**
 * The one place that knows both the canvas's node-type names and the editors that render
 * them. Keeping this binding in the shell is what lets `canvas/`, `classeditor/` and
 * `relationeditor/` stay mutually independent.
 */

export const schemaNodeTypes: NodeTypes = {
  [NODE_TYPE.ontologyClass]: ClassNode,
  [NODE_TYPE.genericProperty]: GenericPropertyNode,
  [NODE_TYPE.floatingAttribute]: FloatingAttributeNode,
};

export const schemaEdgeTypes: EdgeTypes = {
  [EDGE_TYPE.relation]: RelationEdge,
  [EDGE_TYPE.subClassOf]: SubClassEdge,
};

export const taxonomyNodeTypes: NodeTypes = {
  [NODE_TYPE.taxonomyClass]: TaxonomyClassNode,
  [NODE_TYPE.taxonomyModule]: TaxonomyModuleNode,
};

export const taxonomyEdgeTypes: EdgeTypes = {
  [EDGE_TYPE.subClassOf]: SubClassEdge,
};
