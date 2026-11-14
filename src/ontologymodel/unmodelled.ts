import { NAMESPACES, RDF_TYPE } from '../annotationvocabulary';
import { BLANK_PREFIX, iri, isBlankNode } from './triples';
import type { Triple, TripleObject } from './triples';

/**
 * What a document says that the schema does not model, kept so that saving gives it back.
 *
 * The model holds what the canvas edits, and the writer regenerates a document from it. Without
 * this, everything else in an opened file — individuals, restrictions, disjointness, property
 * characteristics, a SHACL `sh:minCount` — was gone after the first save, and with a file saved
 * into a git repository that meant gone from a colleague's work. Kept here, untouched, and
 * written back beside what the writer produces.
 *
 * **Kept triples point at the model by id, not by IRI.** Where one mentions a modelled class or
 * property, or a shape the writer will generate, it holds a reference instead
 * (`urn:ontoschema:entity:cls_1a2b`), and the writer swaps it for whatever that thing is called
 * at the time of writing. So renaming a class carries `Car owl:disjointWith Truck` along with it,
 * and nothing that edits the model has to know these triples exist. A reference to something
 * since deleted resolves to nothing, and the statement goes with it.
 *
 * The importer decides what is kept: everything it did not turn into the model. This module only
 * keeps the bookkeeping of references and blank nodes in one place, both ways.
 */

const PREFIX = 'urn:ontoschema:';

/** The ontology header, whatever IRI the writer gives it. */
export const ONTOLOGY_REF = `${PREFIX}ontology`;

/** A modelled class or property. */
export const entityRef = (id: string) => `${PREFIX}entity:${id}`;

/** The node shape the writer generates for a class. */
export const nodeShapeRef = (classId: string) => `${PREFIX}shape:${classId}`;

/** The property shape the writer generates for one property on one class. */
export const propertyShapeRef = (classId: string, propertyId: string) =>
  `${PREFIX}shape:${classId}:${propertyId}`;

export type Ref =
  | { kind: 'ontology' }
  | { kind: 'entity'; id: string }
  | { kind: 'nodeShape'; classId: string }
  | { kind: 'propertyShape'; classId: string; propertyId: string };

function parseRef(value: string): Ref | null {
  if (!value.startsWith(PREFIX)) return null;
  const [kind, first, second] = value.slice(PREFIX.length).split(':');
  if (kind === 'ontology') return { kind: 'ontology' };
  if (kind === 'entity' && first) return { kind: 'entity', id: first };
  if (kind === 'shape' && first && second) {
    return { kind: 'propertyShape', classId: first, propertyId: second };
  }
  if (kind === 'shape' && first) return { kind: 'nodeShape', classId: first };
  return null;
}

/* ------------------------------------------------------------------------- reading */

/**
 * The triples a document's import did not use, with the terms the model now owns replaced by
 * references to it.
 *
 * `anchors` maps a term as the document wrote it — an IRI, or a `_:label` for a blank property
 * shape — to its reference. Every other blank node is relabelled `_:k1`, `_:k2`…: labels from a
 * parser are arbitrary, and they must never meet the `_:x1` labels the writer issues for its own.
 */
export function setAside(
  triples: readonly Triple[],
  used: ReadonlySet<Triple>,
  anchors: ReadonlyMap<string, string>,
): Triple[] {
  const labels = new Map<string, string>();
  const relabel = (label: string) => {
    let renamed = labels.get(label);
    if (!renamed) {
      renamed = `${BLANK_PREFIX}k${labels.size + 1}`;
      labels.set(label, renamed);
    }
    return renamed;
  };
  const node = (value: string) =>
    anchors.get(value) ?? (isBlankNode(value) ? relabel(value) : value);

  const object = (term: TripleObject): TripleObject => {
    if (term.type === 'literal') return term;
    const anchored = anchors.get(term.value);
    if (anchored) return iri(anchored);
    return term.type === 'blank' ? { type: 'blank', value: relabel(term.value) } : term;
  };

  return triples
    .filter((triple) => !used.has(triple))
    .map((triple) => ({
      subject: node(triple.subject),
      predicate: anchors.get(triple.predicate) ?? triple.predicate,
      object: object(triple.object),
    }));
}

/* ------------------------------------------------------------------------- writing */

/**
 * The kept triples as they belong in a document written now.
 *
 * `resolve` gives each reference its current IRI, or nothing when what it named has gone. A
 * statement mentioning something gone is dropped, and so is any blank structure that statement
 * was part of: a restriction on a deleted class is not left half-stated. Blank structures that
 * nothing points to any more go too, while one that never had a referrer — an
 * `owl:AllDisjointClasses`, say — is kept as it stands.
 *
 * `layers` follows the writer's own options. A subject that says anything in SHACL is a shape and
 * is written with the shapes; everything else is written with the axioms.
 */
export function restore(
  kept: readonly Triple[],
  resolve: (ref: Ref) => string | undefined,
  layers: { axioms: boolean; shapes: boolean },
): Triple[] {
  const isShape = shapeSubjects(kept);
  const named = (value: string): string | undefined => {
    const ref = parseRef(value);
    return ref ? resolve(ref) : value;
  };

  /* Each statement resolved, or null when something it names is gone. */
  const resolved: (Triple | null)[] = kept.map((triple) => {
    const subject = named(triple.subject);
    const predicate = named(triple.predicate);
    const value = triple.object.type === 'iri' ? named(triple.object.value) : '';
    if (subject === undefined || predicate === undefined || value === undefined) return null;
    return {
      subject,
      predicate,
      object: triple.object.type === 'iri' ? iri(value) : triple.object,
    };
  });

  const bySubject = new Map<string, number[]>();
  const referrers = new Map<string, number[]>();
  kept.forEach((triple, position) => {
    push(bySubject, triple.subject, position);
    if (triple.object.type === 'blank') push(referrers, triple.object.value, position);
  });

  /*
   * A blank node with a statement gone is broken as a whole, and so is every blank node holding
   * it: a list missing a member, a restriction missing its filler. A named subject only loses the
   * one statement.
   */
  const broken = new Set<string>();
  const queue = kept
    .filter((triple, position) => resolved[position] === null && isBlankNode(triple.subject))
    .map((triple) => triple.subject);
  for (let label = queue.pop(); label !== undefined; label = queue.pop()) {
    if (broken.has(label)) continue;
    broken.add(label);
    for (const position of referrers.get(label) ?? []) {
      resolved[position] = null;
      const holder = kept[position]!.subject;
      if (isBlankNode(holder)) queue.push(holder);
    }
  }

  /*
   * What is written: the statements of each top-level subject in its layer, and every blank node
   * reachable from them. A blank node only dropped statements pointed to is not reachable, and
   * goes with them.
   */
  const written = new Set<number>();
  const reached = new Set<string>();
  const include = (subject: string) => {
    for (const position of bySubject.get(subject) ?? []) {
      const triple = resolved[position];
      if (!triple) continue;
      written.add(position);
      const target = kept[position]!.object;
      if (target.type !== 'blank' || reached.has(target.value) || broken.has(target.value)) {
        continue;
      }
      reached.add(target.value);
      include(target.value);
    }
  };
  for (const subject of bySubject.keys()) {
    const topLevel = !isBlankNode(subject) || !referrers.has(subject);
    const inLayer = isShape.has(subject) ? layers.shapes : layers.axioms;
    if (topLevel && inLayer && !broken.has(subject)) include(subject);
  }

  return resolved.filter(
    (triple, position): triple is Triple => triple !== null && written.has(position),
  );
}

function push(map: Map<string, number[]>, key: string, value: number): void {
  const existing = map.get(key);
  if (existing) existing.push(value);
  else map.set(key, [value]);
}

/** Subjects that say anything in SHACL, a shape reference among them. */
function shapeSubjects(triples: readonly Triple[]): Set<string> {
  const shapes = new Set<string>();
  for (const triple of triples) {
    const ref = parseRef(triple.subject);
    const shacl =
      triple.predicate.startsWith(NAMESPACES.sh) ||
      (triple.predicate === RDF_TYPE &&
        triple.object.type === 'iri' &&
        triple.object.value.startsWith(NAMESPACES.sh));
    if (shacl || ref?.kind === 'nodeShape' || ref?.kind === 'propertyShape') {
      shapes.add(triple.subject);
    }
  }
  return shapes;
}
