import { indexOntology, subClassEdges } from '../ontologymodel';
import type { Ontology, Position } from '../ontologymodel';
import { CLASS_NODE_WIDTH, estimateClassHeight } from './layout';
import { dagreGroup, groups, pack } from './layeredlayout';
import type { Box, LayoutGraph, Link } from './layeredlayout';

/**
 * A tidy arrangement of the schema canvas, computed from the graph rather than from where
 * things happen to have been dropped.
 *
 * Two situations need it. A `.ttl` written anywhere but here carries no `ontoschema:position`
 * on its classes, so every class arrives at the same coordinate and the canvas opens as one
 * illegible pile — see `unplaced` below. And an arrangement that has been dragged into a mess
 * needs a way back.
 *
 * Ranks follow the **relations**, because those are the edges the schema view actually draws.
 * Ranking by the class hierarchy would produce something just as neat with no visible reason
 * for it: subclass links are deliberately not drawn here (see `schemaEdges`), so the reader
 * would see rows without being told what the rows mean. They still go into the graph as
 * lower-weight edges, which keeps a child near its parent without letting the hierarchy
 * overrule the relations when the two disagree.
 *
 * Left to right, not top down. A relation reads as a sentence — a Client *holds* a Policy —
 * and a sentence runs across the page. It also suits the boxes, which are fixed-width and
 * grow downwards as attributes are added, so ranking vertically would space them by their
 * most variable dimension.
 */

/**
 * Relations carry the layout; the hierarchy only nudges it.
 *
 * Dagre reads `weight` as how much it wants an edge short and straight. Leaving both at 1 let
 * a deep hierarchy pull classes into ranks that the drawn relations then had to cross.
 */
const RELATION_WEIGHT = 4;
const SUBCLASS_WEIGHT = 1;

/**
 * True when the classes cannot have been positioned by anyone.
 *
 * Two classes sharing an exact coordinate is not something dragging can produce — nodes are
 * moved one at a time, to wherever the pointer was — and `nextFreePosition` keeps new classes
 * off each other. So an exact collision means the positions were never real, which is what an
 * import without positions leaves behind.
 *
 * Deliberately not "are they all at the origin": the same pile happens wherever the fallback
 * coordinate is, and a future change to that fallback should not quietly turn this off.
 */
export function unplaced(ontology: Ontology): boolean {
  if (ontology.classes.length < 2) return false;
  const seen = new Set<string>();
  for (const entity of ontology.classes) {
    const key = `${entity.position.x},${entity.position.y}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/** Every class, with the size the canvas will render it at. */
function sizes(ontology: Ontology): Map<string, Box> {
  const index = indexOntology(ontology);
  return new Map(
    ontology.classes.map((entity) => [
      entity.id,
      {
        width: CLASS_NODE_WIDTH,
        height: estimateClassHeight(
          (index.attributeUsagesByClass.get(entity.id) ?? []).length,
          entity.superClassIds.length > 0,
        ),
      },
    ]),
  );
}

/** The edges the layout is built from: drawn relations first, hierarchy as a hint. */
function links(ontology: Ontology): Link[] {
  const index = indexOntology(ontology);
  const found: Link[] = [];
  const seen = new Set<string>();

  const add = (from: string, to: string, weight: number, drawn: boolean) => {
    // A self-relation says nothing about where the class goes, and dagre treats a self-edge
    // as a rank constraint on a single node, which distorts the rank it sits in.
    if (from === to) return;
    if (!index.classById.has(from) || !index.classById.has(to)) return;
    // One line per pair per kind. Three relations between the same two classes should not
    // pull them three times harder together than a single one does.
    const key = `${from}->${to}:${weight}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ from, to, weight, drawn });
  };

  for (const usage of ontology.usages) {
    if (usage.objectClassId === null) continue;
    if (!index.relationById.has(usage.propertyId)) continue;
    add(usage.subjectClassId, usage.objectClassId, RELATION_WEIGHT, true);
  }
  for (const { childId, parentId } of subClassEdges(ontology)) {
    add(parentId, childId, SUBCLASS_WEIGHT, false);
  }

  return found;
}

/** What any arrangement of this schema is computed from. */
export function schemaGraph(ontology: Ontology): LayoutGraph {
  const edges = links(ontology);
  return {
    boxes: sizes(ontology),
    links: edges,
    groups: groups(
      ontology.classes.map((entity) => entity.id),
      edges,
    ),
  };
}

/**
 * Where every class should sit.
 *
 * Pure and deterministic: the same ontology always produces the same arrangement, which is
 * what makes this usable as a button. A layout you cannot ask for twice is one you cannot
 * get back to after trying something else.
 */
export function arrangeSchema(ontology: Ontology): Map<string, Position> {
  if (ontology.classes.length === 0) return new Map();
  const graph = schemaGraph(ontology);
  return pack(graph.groups.map((members) => dagreGroup(graph, members, { direction: 'LR' })));
}
