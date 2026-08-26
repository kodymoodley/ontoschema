import type { Edge, Node } from '@xyflow/react';
import { indexOntology, subClassEdges, taxonomyModules } from '../ontologymodel';
import type { Attribute, Relation, Ontology, OntologyClass, PropertyUsage } from '../ontologymodel';
import {
  CLASS_NODE_WIDTH,
  SELF_LOOP_SIDES,
  TAXONOMY_NODE_HEIGHT,
  TAXONOMY_NODE_WIDTH,
  chooseSides,
  estimateClassHeight,
  layoutTaxonomyModule,
  sourceHandleId,
  targetHandleId,
} from './layout';
import type { Box, Side } from './layout';
import { atSide, endpointOffsets, sourceEnd, targetEnd } from './bundles';
import { orthogonalPath, routeEdges } from './routing';
import type { EdgeEnds, Rect } from './routing';

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
  /**
   * How far each end is shifted along the side of the box it meets, so two relations reaching
   * the same side of the same class do not land on the same pixel. See `bundles.ts`. Absent on
   * the taxonomy canvas, which separates them inside its own routing.
   */
  sourceOffset?: number;
  targetOffset?: number;
  /**
   * The right-angled route the canvas worked out: out of one class, along a lane clear of
   * everything, and down into the other. Absent on the schema canvas, which routes its own.
   */
  route?: { path: string; label: { x: number; y: number } };
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
      // Above the edge labels, so a label crossing a class never covers it.
      zIndex: SCHEMA_CLASS_LAYER,
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
    before.shared === after.shared &&
    /*
     * The lanes belong here for the same reason the handles do: they decide where the line is
     * drawn. Leaving them out kept an edge whose handles had not changed but whose neighbours
     * had -- a class arriving on the same side of the same box changes how many lanes that side
     * is divided into, and every edge already there has to move over. Without this the canvas
     * held the old lane and two edges shared one, which is the collision this was meant to end.
     */
    before.sourceOffset === after.sourceOffset &&
    before.targetOffset === after.targetOffset
  );
}

function sameNames(before: string[], after: string[]): boolean {
  return before.length === after.length && before.every((name, index) => name === after[index]);
}

/**
 * A relation whose subject and object are the same class — `hasSubCategory` on Category, say.
 * Legal, common in published ontologies, and the one case the geometry has to be told about
 * rather than allowed to work out.
 */
const selfLoop = (usage: PropertyUsage) => usage.subjectClassId === usage.objectClassId;

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

  /** Every relation that will be drawn, so the ones sharing a pair of classes can be fanned. */
  const drawable = ontology.usages.filter(
    (usage) =>
      usage.objectClassId !== null &&
      index.relationById.has(usage.propertyId) &&
      index.classById.has(usage.subjectClassId) &&
      index.classById.has(usage.objectClassId),
  );
  /*
   * Which sides each relation uses, worked out for all of them before any is drawn. The fan
   * below needs to know who else is meeting a given side, and that cannot be answered one edge
   * at a time.
   */
  const chosen = new Map<string, { source: Side; target: Side }>();
  for (const usage of drawable) {
    const from = boxes.get(usage.subjectClassId);
    const to = boxes.get(usage.objectClassId ?? usage.subjectClassId);
    chosen.set(
      usage.id,
      selfLoop(usage)
        ? SELF_LOOP_SIDES
        : from && to
          ? chooseSides(from, to)
          : { source: 'right' as const, target: 'left' as const },
    );
  }

  const offsets = endpointOffsets(
    drawable.flatMap((usage) => {
      const sides = chosen.get(usage.id);
      if (!sides || usage.objectClassId === null) return [];
      return [
        { key: sourceEnd(usage.id), at: atSide(usage.subjectClassId, sides.source) },
        { key: targetEnd(usage.id), at: atSide(usage.objectClassId, sides.target) },
      ];
    }),
  );

  const relations: Edge[] = [];
  for (const usage of drawable) {
    const property = index.relationById.get(usage.propertyId);
    if (!property || usage.objectClassId === null) continue;
    const sides = chosen.get(usage.id) ?? { source: 'right' as const, target: 'left' as const };

    relations.push({
      // The edge is the usage, not the property: one property can be drawn many times.
      id: usage.id,
      type: EDGE_TYPE.relation,
      zIndex: EDGE_LAYER,
      source: usage.subjectClassId,
      target: usage.objectClassId,
      sourceHandle: sourceHandleId(sides.source),
      targetHandle: targetHandleId(sides.target),
      data: {
        usage,
        property,
        shared: (index.usagesByProperty.get(usage.propertyId) ?? []).length > 1,
        sourceOffset: offsets.get(sourceEnd(usage.id)) ?? 0,
        targetOffset: offsets.get(targetEnd(usage.id)) ?? 0,
      } satisfies RelationEdgeData,
    });
  }

  /*
   * Relations only. Subclass links used to be drawn here too, in the taxonomy's visual language,
   * so that the two views never disagreed about what the model contains -- but the taxonomy view
   * exists to show the hierarchy and shows it better, laid out rather than wherever the classes
   * happen to have been dragged. Here they were another set of lines crossing the same crowded
   * middle, saying something the class box already says: every class names its superclasses in
   * its own header.
   */
  return relations;
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
 * Whether the taxonomy view draws the selected class's relations.
 *
 * Off by default. There was a third setting that drew every relation, and trying it settled the
 * question: it cost the legibility that makes this view worth having and gave back nothing the
 * schema view does not do better.
 */
export type TaxonomyRelations = 'off' | 'selected';

/**
 * The classes whose relations the taxonomy view is showing.
 *
 * A set rather than the one selected class, because relations are read by comparing: what a
 * Policy touches is only half a question, and the other half is what it touches that a Claim
 * does not. Ctrl or Cmd click adds a class to this set; see `TaxonomyCanvas`.
 *
 * The app's selection stays single — it drives the inspector, which shows one entity — so this
 * is the canvas's own state and not a second opinion about what is selected.
 */
export function taxonomyGraph(
  ontology: Ontology,
  shown: ReadonlySet<string>,
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
      // Beneath the edge labels. A module box is a container, and a container that hides the
      // names of the edges crossing it is telling you less than the empty canvas would.
      zIndex: MODULE_LAYER,
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
        zIndex: TAXONOMY_CLASS_LAYER,
        parentId: moduleNodeId,
        extent: 'parent',
        draggable: false,
        position: { x: placed.x + MODULE_PADDING, y: placed.y + MODULE_PADDING + MODULE_HEADER },
        selected: shown.has(entity.id),
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
        zIndex: EDGE_LAYER,
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
    edges.push(...relationEdges(ontology, index, nodes, shown));
  }

  return { nodes, edges };
}

/**
 * The relation layer, drawn between whichever taxonomy nodes are on screen.
 *
 * A class reachable from two roots appears in both modules, so one usage can have more than
 * one pair of endpoints. Every visible pair is drawn: leaving some out would show a relation
 * as attached to one copy of a class and not the other, which is a picture of nothing.
 *
 * A relation is drawn when *either* end is in `shown`, so adding a second class reveals what
 * joins the two of them as well as what each reaches on its own. One usage between two shown
 * classes is still one edge -- the loop below visits each usage once.
 */
function relationEdges(
  ontology: Ontology,
  index: ReturnType<typeof indexOntology>,
  nodes: readonly Node[],
  shown: ReadonlySet<string>,
): Edge[] {
  /** Every taxonomy node showing a given class, keyed by the class it shows. */
  const appearances = new Map<string, string[]>();
  /** Where each node sits in canvas coordinates, for steering the edges around them. */
  const rects = new Map<string, Rect>();
  const modulePositions = new Map(
    nodes.filter((node) => node.type === NODE_TYPE.taxonomyModule).map((n) => [n.id, n.position]),
  );

  for (const node of nodes) {
    if (node.type !== NODE_TYPE.taxonomyClass) continue;
    const { classId } = node.data as TaxonomyClassNodeData;
    const existing = appearances.get(classId);
    if (existing) existing.push(node.id);
    else appearances.set(classId, [node.id]);

    // A class node is positioned inside its module, so its own position is relative to it.
    const origin = node.parentId ? modulePositions.get(node.parentId) : undefined;
    rects.set(node.id, {
      x: node.position.x + (origin?.x ?? 0),
      y: node.position.y + (origin?.y ?? 0),
      width: TAXONOMY_NODE_WIDTH,
      height: TAXONOMY_NODE_HEIGHT,
    });
  }

  /*
   * Collected before any of them is routed. Lanes only make sense together: which edge gets
   * which lane depends on all the others, so the geometry cannot be decided one at a time.
   */
  const pending: {
    id: string;
    usage: PropertyUsage;
    property: Relation;
    source: string;
    target: string;
  }[] = [];

  for (const usage of ontology.usages) {
    const property = index.relationById.get(usage.propertyId);
    if (!property || usage.objectClassId === null) continue;
    if (!shown.has(usage.subjectClassId) && !shown.has(usage.objectClassId)) continue;

    const sources = appearances.get(usage.subjectClassId) ?? [];
    const targets = appearances.get(usage.objectClassId) ?? [];
    for (const source of sources) {
      for (const target of targets) {
        pending.push({
          id: `relation:${usage.id}:${source}:${target}`,
          usage,
          property,
          source,
          target,
        });
      }
    }
  }
  const ends: EdgeEnds[] = pending.flatMap((entry) => {
    const from = rects.get(entry.source);
    const to = rects.get(entry.target);
    if (!from || !to) return [];
    return [{ id: entry.id, from, to }];
  });
  const routes = new Map(routeEdges(ends, [...rects.values()]).map((r) => [r.id, r]));

  return pending.map((entry) => {
    const route = routes.get(entry.id);
    return {
      id: entry.id,
      type: EDGE_TYPE.relation,
      zIndex: EDGE_LAYER,
      source: entry.source,
      target: entry.target,
      selectable: false,
      data: {
        usage: entry.usage,
        property: entry.property,
        shared: (index.usagesByProperty.get(entry.usage.propertyId) ?? []).length > 1,
        ...(route ? { route: { path: orthogonalPath(route.points), label: route.label } } : {}),
      } satisfies RelationEdgeData,
    };
  });
}

/*
 * Stacking, and the reason it is not one number.
 *
 * React Flow paints edges, then edge labels, then nodes, and the label layer's z-index is set
 * in `canvas.module.css`. Two things have to be true at once and they pull in opposite
 * directions: a label must not cover a class on the schema canvas, where it would swallow
 * clicks aimed at one, and a label must not go under an edge in the taxonomy, where the whole
 * point is reading the name of the line you are looking at.
 *
 * They can both be true only because the two views nest their nodes differently, and that is
 * the part that cost an afternoon. **React Flow forces an edge's z-index to the greater of the
 * nodes it joins whenever those nodes are nested inside a parent.** The taxonomy's classes live
 * inside module boxes, so its edges always ride at the class layer whatever the edge asks for;
 * the schema's classes have no parent, so its edges keep the layer they are given.
 *
 * Hence: taxonomy classes sit *below* the labels, which is harmless because the lanes put every
 * label outside the diagram anyway, and schema classes sit *above* them, which is what stops a
 * label parking on a class. The label layer is 2, between the two.
 */
export const MODULE_LAYER = 0;
export const TAXONOMY_CLASS_LAYER = 1;
export const SCHEMA_CLASS_LAYER = 3;
/** What an edge asks for. Honoured on the schema canvas; overridden in the taxonomy, see above. */
export const EDGE_LAYER = 0;

export function taxonomyNodeId(rootId: string, classId: string): string {
  return `${rootId}__${classId}`;
}

/** Recovers the class id from a taxonomy node id, which is scoped by its module root. */
export function classIdFromTaxonomyNode(nodeId: string): string {
  const separator = nodeId.indexOf('__');
  return separator < 0 ? nodeId : nodeId.slice(separator + 2);
}
