import type { Edge, Node } from '@xyflow/react';
import { indexOntology, subClassEdges, taxonomyModules } from '../ontologymodel';
import type { Attribute, Relation, Ontology, OntologyClass, PropertyUsage } from '../ontologymodel';
import {
  CLASS_NODE_WIDTH,
  chooseHierarchySides,
  chooseSides,
  estimateClassHeight,
  layoutTaxonomyModule,
  sourceHandleId,
  targetHandleId,
} from './layout';
import type { Box } from './layout';

/**
 * Derives the React Flow graph from the ontology.
 *
 * Node *type names* are plain strings; the components that render them are supplied from
 * outside (see appshell), so the canvas never imports an editor module and the editors
 * never import the canvas.
 *
 * Only classes are nodes. Properties are a reusable pool, not canvas objects: a property
 * appears on the canvas exactly when it is used — as a typed row inside a class box, or as
 * an edge between two classes. An unused property has nothing to draw.
 */

export const NODE_TYPE = {
  ontologyClass: 'ontologyClass',
  taxonomyClass: 'taxonomyClass',
  taxonomyModule: 'taxonomyModule',
} as const;

export const EDGE_TYPE = {
  relation: 'relation',
  subClassOf: 'subClassOf',
} as const;

/** One attribute row inside a class box. */
export interface AttributeRow {
  usageId: string;
  property: Attribute;
  /**
   * How many *other* classes carry this same property. A count rather than a flag because
   * renaming a property from one class renames it on all of them, and the row has to be able
   * to say how far that reaches.
   */
  usedOnOtherClasses: number;
}

export interface ClassNodeData extends Record<string, unknown> {
  entity: OntologyClass;
  attributes: AttributeRow[];
  superClassNames: string[];
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
  usage: PropertyUsage;
  property: Relation;
  /** True when the same property is also used elsewhere in the schema. */
  shared: boolean;
}

/* ------------------------------------------------------------ schema view */

/**
 * Nodes are derived from the ontology alone — deliberately not from the selection.
 * Selection is transient interaction state owned by React Flow; folding it in here would
 * rebuild every node object on each click and tear down node DOM mid-gesture, which breaks
 * multi-click interactions such as double-click-to-rename.
 */
export function schemaNodes(ontology: Ontology): Node[] {
  const index = indexOntology(ontology);

  return ontology.classes.map((entity) => {
    const attributes: AttributeRow[] = (index.attributeUsagesByClass.get(entity.id) ?? [])
      .map((usage) => {
        const property = index.attributeById.get(usage.propertyId);
        if (!property) return null;
        const elsewhere = new Set(
          (index.usagesByProperty.get(usage.propertyId) ?? []).map((one) => one.subjectClassId),
        );
        elsewhere.delete(entity.id);

        return { usageId: usage.id, property, usedOnOtherClasses: elsewhere.size };
      })
      .filter((row): row is AttributeRow => row !== null);

    return {
      id: entity.id,
      type: NODE_TYPE.ontologyClass,
      position: entity.position,
      /*
       * React Flow hides a node until it knows how big it is, and every edit rebuilds this
       * array from scratch. Without a size to fall back on, each edit blanks the whole canvas
       * until the resize observer catches up — a frame in Chrome, visibly longer in Firefox.
       * These are the same estimates the edge router uses; the real measurement supersedes
       * them as soon as it arrives.
       */
      initialWidth: CLASS_NODE_WIDTH,
      initialHeight: estimateClassHeight(attributes.length, entity.superClassIds.length > 0),
      data: {
        entity,
        attributes,
        superClassNames: entity.superClassIds
          .map((id) => index.classById.get(id)?.localName)
          .filter((name): name is string => Boolean(name)),
      } satisfies ClassNodeData,
    };
  });
}

/**
 * Whether two class nodes describe the same thing, so the older object can be kept.
 *
 * Deriving is cheap — the whole graph of a 200-class ontology takes well under a millisecond —
 * but every derived node is a new object, and React Flow re-renders a node whose object
 * changed. Handing back the previous object for the classes that did not change is what stops
 * one rename repainting the entire canvas.
 *
 * The mutation API replaces only the entity it touches, so comparing entities by identity is
 * both correct and as cheap as it looks.
 */
export function sameClassNode(left: Node, right: Node): boolean {
  const before = left.data as ClassNodeData | undefined;
  const after = right.data as ClassNodeData | undefined;
  if (!before || !after) return false;

  return (
    before.entity === after.entity &&
    sameAttributes(before.attributes, after.attributes) &&
    sameNames(before.superClassNames, after.superClassNames)
  );
}

function sameAttributes(before: AttributeRow[], after: AttributeRow[]): boolean {
  return (
    before.length === after.length &&
    before.every((row, index) => {
      const other = after[index];
      return (
        other !== undefined &&
        row.usageId === other.usageId &&
        row.property === other.property &&
        row.usedOnOtherClasses === other.usedOnOtherClasses
      );
    })
  );
}

/** The same question for a relation edge: has anything about this line changed? */
export function sameRelationEdge(left: Edge, right: Edge): boolean {
  const before = left.data as RelationEdgeData | undefined;
  const after = right.data as RelationEdgeData | undefined;
  if (!before || !after) return false;

  return (
    left.sourceHandle === right.sourceHandle &&
    left.targetHandle === right.targetHandle &&
    before.usage === after.usage &&
    before.property === after.property &&
    before.shared === after.shared
  );
}

function sameNames(before: string[], after: string[]): boolean {
  return before.length === after.length && before.every((name, index) => name === after[index]);
}

export function schemaEdges(ontology: Ontology): Edge[] {
  const index = indexOntology(ontology);

  /** Where each class sits and roughly how big it is, so edges can pick facing sides. */
  const boxes = new Map<string, Box>(
    ontology.classes.map((entity) => [
      entity.id,
      {
        x: entity.position.x,
        y: entity.position.y,
        width: CLASS_NODE_WIDTH,
        height: estimateClassHeight(
          (index.attributeUsagesByClass.get(entity.id) ?? []).length,
          entity.superClassIds.length > 0,
        ),
      },
    ]),
  );

  const relations: Edge[] = [];
  for (const usage of ontology.usages) {
    const property = index.relationById.get(usage.propertyId);
    if (!property || usage.objectClassId === null) continue;
    if (!index.classById.has(usage.subjectClassId) || !index.classById.has(usage.objectClassId)) {
      continue;
    }
    const from = boxes.get(usage.subjectClassId);
    const to = boxes.get(usage.objectClassId);
    const sides =
      from && to ? chooseSides(from, to) : { source: 'right' as const, target: 'left' as const };

    relations.push({
      // The edge is the usage, not the property: one property can be drawn many times.
      id: usage.id,
      type: EDGE_TYPE.relation,
      source: usage.subjectClassId,
      target: usage.objectClassId,
      sourceHandle: sourceHandleId(sides.source),
      targetHandle: targetHandleId(sides.target),
      data: {
        usage,
        property,
        shared: (index.usagesByProperty.get(usage.propertyId) ?? []).length > 1,
      } satisfies RelationEdgeData,
    });
  }

  // Subclass links also show on the schema canvas, in the taxonomy's own visual language,
  // so the two views never disagree about what the model contains. They stay vertical
  // whatever the layout, which is what keeps hierarchy legible next to the relations.
  const hierarchy: Edge[] = subClassEdges(ontology).map(({ childId, parentId }) => {
    const child = boxes.get(childId);
    const parent = boxes.get(parentId);
    const sides =
      child && parent
        ? chooseHierarchySides(child, parent)
        : { source: 'top' as const, target: 'bottom' as const };

    return {
      id: `subclass:${childId}:${parentId}`,
      type: EDGE_TYPE.subClassOf,
      source: childId,
      target: parentId,
      sourceHandle: sourceHandleId(sides.source),
      targetHandle: targetHandleId(sides.target),
      selectable: false,
      data: {},
    };
  });

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
/**
 * How much of the relation layer the taxonomy view draws.
 *
 * The view reads cleanly because it draws one kind of edge, so drawing them always would trade
 * the legibility for completeness. `selected` is the setting that earns its place: it answers
 * "what does this connect to?" in place, without turning the taxonomy into a second schema
 * view. Off is the default.
 */
export type TaxonomyRelations = 'off' | 'selected' | 'all';

export function taxonomyGraph(
  ontology: Ontology,
  selectedId: string | null,
  relations: TaxonomyRelations = 'off',
): { nodes: Node[]; edges: Edge[] } {
  const modules = taxonomyModules(ontology);
  const index = indexOntology(ontology);
  // Computed once for the whole graph rather than per module.
  const allLinks = subClassEdges(ontology);

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  for (const module of modules) {
    const members = module.members
      .map((id) => index.classById.get(id))
      .filter((entity): entity is OntologyClass => entity !== undefined);
    const memberIds = new Set(members.map((entity) => entity.id));

    const links = allLinks.filter(
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
          attributeCount: (index.attributeUsagesByClass.get(entity.id) ?? []).length,
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

  if (relations !== 'off') {
    edges.push(...relationEdges(ontology, index, nodes, selectedId, relations));
  }

  return { nodes, edges };
}

/**
 * The relation layer, drawn between whichever taxonomy nodes are on screen.
 *
 * A class reachable from two roots appears in both modules, so one usage can have more than
 * one pair of endpoints. Every visible pair is drawn: leaving some out would show a relation
 * as attached to one copy of a class and not the other, which is a picture of nothing.
 */
function relationEdges(
  ontology: Ontology,
  index: ReturnType<typeof indexOntology>,
  nodes: readonly Node[],
  selectedId: string | null,
  mode: TaxonomyRelations,
): Edge[] {
  /** Every taxonomy node showing a given class, keyed by the class it shows. */
  const appearances = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.type !== NODE_TYPE.taxonomyClass) continue;
    const { classId } = node.data as TaxonomyClassNodeData;
    const existing = appearances.get(classId);
    if (existing) existing.push(node.id);
    else appearances.set(classId, [node.id]);
  }

  const edges: Edge[] = [];
  for (const usage of ontology.usages) {
    const property = index.relationById.get(usage.propertyId);
    if (!property || usage.objectClassId === null) continue;
    if (
      mode === 'selected' &&
      selectedId !== usage.subjectClassId &&
      selectedId !== usage.objectClassId
    ) {
      continue;
    }

    const sources = appearances.get(usage.subjectClassId) ?? [];
    const targets = appearances.get(usage.objectClassId) ?? [];
    for (const source of sources) {
      for (const target of targets) {
        edges.push({
          // Scoped by endpoint as well as by usage: one usage can be drawn more than once.
          id: `relation:${usage.id}:${source}:${target}`,
          type: EDGE_TYPE.relation,
          source,
          target,
          selectable: false,
          data: {
            usage,
            property,
            shared: (index.usagesByProperty.get(usage.propertyId) ?? []).length > 1,
          } satisfies RelationEdgeData,
        });
      }
    }
  }
  return edges;
}

export function taxonomyNodeId(rootId: string, classId: string): string {
  return `${rootId}__${classId}`;
}

/** Recovers the class id from a taxonomy node id, which is scoped by its module root. */
export function classIdFromTaxonomyNode(nodeId: string): string {
  const separator = nodeId.indexOf('__');
  return separator < 0 ? nodeId : nodeId.slice(separator + 2);
}
