import type { DatatypeProperty, ObjectProperty, Ontology, OntologyClass } from './types';

/**
 * Taxonomy queries over class and object-property hierarchies.
 *
 * Both hierarchies are stored as parent-id lists on the child, which permits multiple
 * inheritance (legal in OWL) but must never permit a cycle — a cycle would make the
 * taxonomy view unlayoutable and the ontology nonsensical.
 */

interface HierarchyNode {
  id: string;
  parentIds: string[];
}

export interface TaxonomyNode<T> {
  entity: T;
  children: TaxonomyNode<T>[];
  depth: number;
}

function parentsById(nodes: readonly HierarchyNode[]): Map<string, string[]> {
  return new Map(nodes.map((node) => [node.id, node.parentIds]));
}

/**
 * True when making `childId` a subclass of `parentId` would close a cycle,
 * i.e. when the proposed parent is already at or below the child.
 */
function wouldCycle(nodes: readonly HierarchyNode[], childId: string, parentId: string): boolean {
  if (childId === parentId) return true;
  const parents = parentsById(nodes);
  const stack = [...(parents.get(parentId) ?? [])];
  const seen = new Set<string>([parentId]);
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || seen.has(current)) continue;
    if (current === childId) return true;
    seen.add(current);
    stack.push(...(parents.get(current) ?? []));
  }
  return false;
}

export function canSubclass(ontology: Ontology, childId: string, parentId: string): boolean {
  return !wouldCycle(toHierarchy(ontology.classes), childId, parentId);
}

export function canSubproperty(ontology: Ontology, childId: string, parentId: string): boolean {
  return !wouldCycle(toHierarchyProps(ontology.objectProperties), childId, parentId);
}

function toHierarchy(classes: readonly OntologyClass[]): HierarchyNode[] {
  return classes.map((entity) => ({ id: entity.id, parentIds: entity.superClassIds }));
}

function toHierarchyProps(properties: readonly ObjectProperty[]): HierarchyNode[] {
  return properties.map((entity) => ({ id: entity.id, parentIds: entity.superPropertyIds }));
}

/**
 * Builds the forest used by the taxonomy view and the hierarchy tree panel.
 * A node with several parents legitimately appears under each of them.
 * Roots are anything with no parent (or whose parents no longer exist).
 */
function buildForest<T extends { id: string }>(
  entities: readonly T[],
  parentIdsOf: (entity: T) => string[],
): TaxonomyNode<T>[] {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const childrenOf = new Map<string, T[]>();
  const roots: T[] = [];

  for (const entity of entities) {
    const parents = parentIdsOf(entity).filter((id) => byId.has(id) && id !== entity.id);
    if (parents.length === 0) {
      roots.push(entity);
      continue;
    }
    for (const parentId of parents) {
      const siblings = childrenOf.get(parentId);
      if (siblings) siblings.push(entity);
      else childrenOf.set(parentId, [entity]);
    }
  }

  // `branch` guards against a cycle that slipped past validation (e.g. a hand-edited
  // project file), so the tree builder can never recurse forever.
  const expand = (entity: T, depth: number, branch: Set<string>): TaxonomyNode<T> => {
    const nextBranch = new Set(branch).add(entity.id);
    const children = (childrenOf.get(entity.id) ?? [])
      .filter((child) => !nextBranch.has(child.id))
      .map((child) => expand(child, depth + 1, nextBranch));
    return { entity, children, depth };
  };

  return roots.map((root) => expand(root, 0, new Set()));
}

export function classForest(ontology: Ontology): TaxonomyNode<OntologyClass>[] {
  return buildForest(ontology.classes, (entity) => entity.superClassIds);
}

export function objectPropertyForest(ontology: Ontology): TaxonomyNode<ObjectProperty>[] {
  return buildForest(ontology.objectProperties, (entity) => entity.superPropertyIds);
}

/**
 * Datatype properties are presented as a flat, alphabetical pool rather than a hierarchy.
 * They are the attributes a class can carry, and arranging attributes into a taxonomy is
 * rarely meaningful — the useful question is only "which ones exist, and where are they
 * used".
 */
export function datatypePropertyList(ontology: Ontology): DatatypeProperty[] {
  return [...ontology.datatypeProperties].sort((a, b) => a.localName.localeCompare(b.localName));
}

/** Root classes, in model order — each becomes its own module box in the taxonomy view. */
export function rootClasses(ontology: Ontology): OntologyClass[] {
  const ids = new Set(ontology.classes.map((entity) => entity.id));
  return ontology.classes.filter(
    (entity) => entity.superClassIds.filter((id) => ids.has(id) && id !== entity.id).length === 0,
  );
}

/** All classes at or below `classId`, including the class itself. Cycle-safe. */
export function classWithDescendants(ontology: Ontology, classId: string): OntologyClass[] {
  const collected: OntologyClass[] = [];
  const seen = new Set<string>();
  const stack = [classId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || seen.has(current)) continue;
    seen.add(current);
    const entity = ontology.classes.find((candidate) => candidate.id === current);
    if (!entity) continue;
    collected.push(entity);
    for (const child of ontology.classes) {
      if (child.superClassIds.includes(current)) stack.push(child.id);
    }
  }
  return collected;
}

/**
 * Assigns each class to a taxonomy module, keyed by the root it descends from.
 * A class reachable from several roots is listed under each, which is what keeps
 * multiple inheritance visible without drawing edges across module boundaries.
 */
export function taxonomyModules(ontology: Ontology): { root: OntologyClass; members: string[] }[] {
  return rootClasses(ontology).map((root) => ({
    root,
    members: classWithDescendants(ontology, root.id).map((entity) => entity.id),
  }));
}

/** Direct subclass links, as id pairs — the edges drawn in the taxonomy view. */
export function subClassEdges(ontology: Ontology): { childId: string; parentId: string }[] {
  const ids = new Set(ontology.classes.map((entity) => entity.id));
  return ontology.classes.flatMap((entity) =>
    entity.superClassIds
      .filter((parentId) => ids.has(parentId) && parentId !== entity.id)
      .map((parentId) => ({ childId: entity.id, parentId })),
  );
}
