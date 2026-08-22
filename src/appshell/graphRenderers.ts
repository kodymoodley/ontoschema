import type { EdgeTypes, NodeTypes } from '@xyflow/react';
import { EDGE_TYPE, NODE_TYPE, TaxonomyClassNode, TaxonomyModuleNode } from '../canvas';
import { ClassNode } from '../classeditor';
import { RelationEdge, SubClassEdge } from '../relationeditor';

/**
 * The one place that knows both the canvas's node-type names and the editors that render
 * them. Keeping this binding in the shell is what lets `canvas/`, `classeditor/` and
 * `relationeditor/` stay mutually independent.
 */

export const schemaNodeTypes: NodeTypes = {
  [NODE_TYPE.ontologyClass]: ClassNode,
};

export const schemaEdgeTypes: EdgeTypes = {
  [EDGE_TYPE.relation]: RelationEdge,
  [EDGE_TYPE.subClassOf]: SubClassEdge,
};

export const taxonomyNodeTypes: NodeTypes = {
  [NODE_TYPE.taxonomyClass]: TaxonomyClassNode,
  [NODE_TYPE.taxonomyModule]: TaxonomyModuleNode,
};

/*
 * The taxonomy view draws relations too now, behind a control that is off by default. Same
 * renderer as the schema view: two views disagreeing about what a relation looks like would be
 * two visual languages for one thing.
 */
export const taxonomyEdgeTypes: EdgeTypes = {
  [EDGE_TYPE.relation]: RelationEdge,
  [EDGE_TYPE.subClassOf]: SubClassEdge,
};
