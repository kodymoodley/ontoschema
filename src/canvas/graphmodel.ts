import type { Edge, Node } from '@xyflow/react';
import { attributesOfClass, subClassEdges, taxonomyModules } from '../ontologymodel';
import type { DatatypeProperty, ObjectProperty, Ontology, OntologyClass } from '../ontologymodel';
import { layoutTaxonomyModule } from './layout';

/**
 * Derives the React Flow graph from the ontology.
 *
 * Node *type names* are plain strings; the components that render them are supplied from
 * outside (see appshell), so the canvas never imports an editor module and the editors
 * never import the canvas.
 */

export const NODE_TYPE = {
  ontologyClass: 'ontologyClass',
  genericProperty: 'genericProperty',
  floatingAttribute: 'floatingAttribute',
  taxonomyClass: 'taxonomyClass',
  taxonomyModule: 'taxonomyModule',
} as const;

export const EDGE_TYPE = {
  relation: 'relation',
  subClassOf: 'subClassOf',
} as const;

export interface ClassNodeData extends Record<string, unknown> {
  entity: OntologyClass;
  attributes: DatatypeProperty[];
  superClassNames: string[];
}

export interface GenericPropertyNodeData extends Record<string, unknown> {
  entity: ObjectProperty;
}

export interface FloatingAttributeNodeData extends Record<string, unknown> {
  entity: DatatypeProperty;
}

export interface TaxonomyClassNodeData extends Record<string, unknown> {
  entity: OntologyClass;
  classId: string;
  attributeCount: number;
  isRoot: boolean;
}

export interface TaxonomyModuleNodeData extends Record<string, unknown> {
  label: string;
  memberCount: number;
  rootId: string;
}

export interface RelationEdgeData extends Record<string, unknown> {
  entity: ObjectProperty;
}

/* ------------------------------------------------------------ schema view */

/**
 * Nodes are derived from the ontology alone — deliberately not from the selection.
 * Selection is transient interaction state owned by React Flow; folding it in here would
 * rebuild every node object on each click and tear down node DOM mid-gesture, which breaks
 * multi-click interactions such as double-click-to-rename.
 */
export function schemaNodes(ontology: Ontology): Node[] {
  const classNodes: Node[] = ontology.classes.map((entity) => ({
    id: entity.id,
    type: NODE_TYPE.ontologyClass,
    position: entity.position,
    data: {
      entity,
      attributes: attributesOfClass(ontology, entity.id),
      superClassNames: entity.superClassIds
        .map((id) => ontology.classes.find((c) => c.id === id)?.localName)
        .filter((name): name is string => Boolean(name)),
    } satisfies ClassNodeData,
  }));

  const genericNodes: Node[] = ontology.objectProperties
    .filter((property) => property.kind === 'generic')
    .map((entity) => ({
      id: entity.id,
      type: NODE_TYPE.genericProperty,
      position: entity.position,
      data: { entity } satisfies GenericPropertyNodeData,
    }));

  // Attributes that are not yet attached to a class float on the canvas until dropped on one.
  const floatingAttributes: Node[] = ontology.datatypeProperties
    .filter((property) => property.domainClassId === null)
    .map((entity) => ({
      id: entity.id,
      type: NODE_TYPE.floatingAttribute,
      position: entity.position,
      data: { entity } satisfies FloatingAttributeNodeData,
    }));

  return [...classNodes, ...genericNodes, ...floatingAttributes];
}

export function schemaEdges(ontology: Ontology): Edge[] {
  const classIds = new Set(ontology.classes.map((entity) => entity.id));

  const relations: Edge[] = ontology.objectProperties
    .filter(
      (property) =>
        property.kind === 'scoped' &&
        property.domainClassId !== null &&
        property.rangeClassId !== null &&
        classIds.has(property.domainClassId) &&
        classIds.has(property.rangeClassId),
    )
    .map((entity) => ({
      id: entity.id,
      type: EDGE_TYPE.relation,
      source: entity.domainClassId as string,
      target: entity.rangeClassId as string,
      sourceHandle: 'out',
      targetHandle: 'in',
      data: { entity } satisfies RelationEdgeData,
    }));

  // Subclass links also show on the schema canvas, in the taxonomy's own visual language,
  // so the two views never disagree about what the model contains. They attach to the
  // dedicated vertical handles so the hierarchy reads upward and does not tangle with the
  // horizontal relation edges.
  const hierarchy: Edge[] = subClassEdges(ontology).map(({ childId, parentId }) => ({
    id: `subclass:${childId}:${parentId}`,
    type: EDGE_TYPE.subClassOf,
    source: childId,
    target: parentId,
    sourceHandle: 'subOut',
    targetHandle: 'subIn',
    selectable: false,
    data: {},
  }));

  return [...relations, ...hierarchy];
}

/* ---------------------------------------------------------- taxonomy view */

const MODULE_PADDING = 28;
const MODULE_HEADER = 34;
const MODULE_GAP = 56;
const MAX_ROW_WIDTH = 1800;

/**
 * The taxonomy view is laid out, not dragged: one bounding box per root class, each
 * containing a top-down dagre tree. Boxes flow left to right and wrap, which keeps large
 * ontologies legible instead of turning into one wide spaghetti graph.
 */
export function taxonomyGraph(
  ontology: Ontology,
  selectedId: string | null,
): { nodes: Node[]; edges: Edge[] } {
  const modules = taxonomyModules(ontology);
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  for (const module of modules) {
    const members = module.members
      .map((id) => ontology.classes.find((entity) => entity.id === id))
      .filter((entity): entity is OntologyClass => entity !== undefined);
    const memberIds = new Set(members.map((entity) => entity.id));

    const links = subClassEdges(ontology).filter(
      ({ childId, parentId }) => memberIds.has(childId) && memberIds.has(parentId),
    );

    const layout = layoutTaxonomyModule(members, links);
    const boxWidth = layout.width + MODULE_PADDING * 2;
    const boxHeight = layout.height + MODULE_PADDING * 2 + MODULE_HEADER;

    if (cursorX > 0 && cursorX + boxWidth > MAX_ROW_WIDTH) {
      cursorX = 0;
      cursorY += rowHeight + MODULE_GAP;
      rowHeight = 0;
    }

    const moduleNodeId = `module:${module.root.id}`;
    nodes.push({
      id: moduleNodeId,
      type: NODE_TYPE.taxonomyModule,
      position: { x: cursorX, y: cursorY },
      draggable: false,
      selectable: false,
      style: { width: boxWidth, height: boxHeight },
      data: {
        label: module.root.localName,
        memberCount: members.length,
        rootId: module.root.id,
      } satisfies TaxonomyModuleNodeData,
    });

    for (const entity of members) {
      const placed = layout.positions.get(entity.id);
      if (!placed) continue;
      nodes.push({
        // A class reachable from two roots appears in both modules, so ids are scoped.
        id: taxonomyNodeId(module.root.id, entity.id),
        type: NODE_TYPE.taxonomyClass,
        parentId: moduleNodeId,
        extent: 'parent',
        draggable: false,
        position: { x: placed.x + MODULE_PADDING, y: placed.y + MODULE_PADDING + MODULE_HEADER },
        selected: entity.id === selectedId,
        data: {
          entity,
          classId: entity.id,
          attributeCount: attributesOfClass(ontology, entity.id).length,
          isRoot: entity.id === module.root.id,
        } satisfies TaxonomyClassNodeData,
      });
    }

    for (const { childId, parentId } of links) {
      edges.push({
        id: `${module.root.id}:subclass:${childId}:${parentId}`,
        type: EDGE_TYPE.subClassOf,
        source: taxonomyNodeId(module.root.id, childId),
        target: taxonomyNodeId(module.root.id, parentId),
        selectable: false,
        data: {},
      });
    }

    cursorX += boxWidth + MODULE_GAP;
    rowHeight = Math.max(rowHeight, boxHeight);
  }

  return { nodes, edges };
}

export function taxonomyNodeId(rootId: string, classId: string): string {
  return `${rootId}__${classId}`;
}

/** Recovers the class id from a taxonomy node id, which is scoped by its module root. */
export function classIdFromTaxonomyNode(nodeId: string): string {
  const separator = nodeId.indexOf('__');
  return separator < 0 ? nodeId : nodeId.slice(separator + 2);
}
