import {
  ANNOTATION_TERMS,
  ONTOSCHEMA_LAYOUT,
  OWL_CLASS,
  OWL_DATATYPE_PROPERTY,
  OWL_OBJECT_PROPERTY,
  OWL_ONTOLOGY,
  OWL_UNION_OF,
  RDFS_DOMAIN,
  RDFS_RANGE,
  RDFS_SUBCLASS_OF,
  RDFS_SUBPROPERTY_OF,
  RDF_FIRST,
  RDF_REST,
  RDF_TYPE,
  annotationTermIri,
  isXsdDatatype,
} from '../annotationvocabulary';
import type { XsdDatatype } from '../annotationvocabulary';
import {
  localNameOf,
  namespaceOf,
  normalizeNamespaceIri,
  toClassLocalName,
  toPropertyLocalName,
  uniqueLocalName,
} from './identifier';
import { decodeLayout } from './layout';
import { createEmptyOntology, createId } from './ontology';
import { isBlankNode } from './triples';
import type { Triple, TripleObject } from './triples';
import type { Annotation, Ontology, Position, PropertyUsage, Relation } from './types';

/**
 * Reading a document back into the model — the inverse of `ontologyToTriples`, and the half
 * that has to decide what to *ignore*.
 *
 * This tool models a deliberately narrow slice of OWL, so a document written anywhere else
 * will contain things it has no home for. Those are dropped rather than refused: a file that
 * will not open teaches nobody anything, whereas one that opens with its classes and their
 * hierarchy intact is useful even when a restriction was left behind. What is dropped is
 * counted, so the app can say so rather than leaving it to be discovered.
 *
 * The rules, decided rather than inferred:
 *
 *  - **Classes** and their `rdfs:subClassOf` hierarchy, where both ends are named classes.
 *  - **All annotations** from the vocabulary this app knows.
 *  - **Attributes** whatever their range: an `xsd` type is kept, anything else becomes
 *    `xsd:string`. This is the one rule that *rewrites* rather than discards, so a foreign
 *    file opened and saved here comes back changed.
 *  - **Relations**, but only where both a domain and a range are known — either stated on the
 *    property or inherited from an ancestor.
 *  - **Positions**, from this app's own layout annotation.
 *
 * Everything else goes: individuals, restrictions, property chains, and any class expression
 * other than the `owl:unionOf` that a reused property's domain is written as.
 */

/** What a document contained that the model has no home for. */
export interface ImportReport {
  /** Subjects typed as something other than a class or a property — individuals, mostly. */
  individuals: number;
  /** Anonymous class expressions that are not a reused property's union domain or range. */
  classExpressions: number;
  /** Relations named in the document but left out for want of a domain or a range. */
  relationsWithoutBothEnds: number;
  /** Attributes whose range was not an `xsd` type and now says `xsd:string`. */
  datatypesRewritten: number;
}

export interface ImportResult {
  ontology: Ontology;
  report: ImportReport;
}

/** Indexed triples, which every step below reads and none of them rebuilds. */
interface Index {
  objectsOf: (subject: string, predicate: string) => TripleObject[];
  subjectsTyped: (type: string) => string[];
  triplesOf: (subject: string) => Triple[];
}

function indexTriples(triples: readonly Triple[]): Index {
  const bySubject = new Map<string, Triple[]>();
  const byType = new Map<string, string[]>();

  for (const triple of triples) {
    const existing = bySubject.get(triple.subject);
    if (existing) existing.push(triple);
    else bySubject.set(triple.subject, [triple]);

    if (triple.predicate === RDF_TYPE && triple.object.type === 'iri') {
      const subjects = byType.get(triple.object.value);
      if (subjects) subjects.push(triple.subject);
      else byType.set(triple.object.value, [triple.subject]);
    }
  }

  return {
    objectsOf: (subject, predicate) =>
      (bySubject.get(subject) ?? [])
        .filter((triple) => triple.predicate === predicate)
        .map((triple) => triple.object),
    subjectsTyped: (type) => byType.get(type) ?? [],
    triplesOf: (subject) => bySubject.get(subject) ?? [],
  };
}

export function ontologyFromTriples(
  triples: readonly Triple[],
  prefixes: Readonly<Record<string, string>> = {},
): ImportResult {
  const index = indexTriples(triples);
  const report: ImportReport = {
    individuals: 0,
    classExpressions: 0,
    relationsWithoutBothEnds: 0,
    datatypesRewritten: 0,
  };

  /*
   * Named classes only. A union domain is a blank node typed `owl:Class`, so taking every
   * `owl:Class` subject would turn each union into a class of its own, called nothing.
   */
  const classIris = index.subjectsTyped(OWL_CLASS).filter((iri) => !isBlankNode(iri));
  const relationIris = index.subjectsTyped(OWL_OBJECT_PROPERTY).filter((iri) => !isBlankNode(iri));
  const attributeIris = index
    .subjectsTyped(OWL_DATATYPE_PROPERTY)
    .filter((iri) => !isBlankNode(iri));

  const header = index.subjectsTyped(OWL_ONTOLOGY).find((iri) => !isBlankNode(iri));
  const namespace = chooseNamespace([...classIris, ...relationIris, ...attributeIris], header);
  const base = createEmptyOntology(namespace, choosePrefix(namespace, prefixes));

  /* ------------------------------------------------------------------- names and ids */

  const taken = new Set<string>();
  const nameFor = (iri: string, asClass: boolean) => {
    const raw = asClass
      ? toClassLocalName(localNameOf(iri))
      : toPropertyLocalName(localNameOf(iri));
    const unique = uniqueLocalName(raw || (asClass ? 'Class' : 'property'), taken);
    taken.add(unique);
    return unique;
  };

  const classId = new Map<string, string>();
  const propertyId = new Map<string, string>();
  const named = new Map<string, string>();
  for (const iri of classIris) {
    classId.set(iri, createId('cls'));
    named.set(iri, nameFor(iri, true));
  }
  for (const iri of [...relationIris, ...attributeIris]) {
    propertyId.set(iri, createId('prp'));
    named.set(iri, nameFor(iri, false));
  }

  /* ------------------------------------------------------------------- what was ignored */

  const modelled = new Set([OWL_CLASS, OWL_OBJECT_PROPERTY, OWL_DATATYPE_PROPERTY, OWL_ONTOLOGY]);
  const counted = new Set<string>();
  for (const triple of triples) {
    if (triple.predicate !== RDF_TYPE || triple.object.type !== 'iri') continue;
    if (counted.has(triple.subject) || modelled.has(triple.object.value)) continue;
    // Declaring an annotation property is bookkeeping, not something a document is about.
    if (triple.object.value.endsWith('AnnotationProperty')) continue;
    counted.add(triple.subject);
    if (isBlankNode(triple.subject)) report.classExpressions += 1;
    else report.individuals += 1;
  }

  /* ------------------------------------------------------------------- class expressions */

  /**
   * The classes a domain or a range names: one when it is a class, several when it is the
   * union a reused property is written with, none when it is anything else.
   */
  const classesNamedBy = (term: TripleObject | undefined): string[] => {
    if (!term) return [];
    if (term.type === 'iri') return classId.has(term.value) ? [term.value] : [];
    if (term.type !== 'blank') return [];

    const [head] = index.objectsOf(term.value, OWL_UNION_OF);
    if (!head) return [];

    const members: string[] = [];
    let cell: TripleObject | undefined = head;
    while (cell && cell.type === 'blank') {
      const [first] = index.objectsOf(cell.value, RDF_FIRST);
      if (first?.type === 'iri' && classId.has(first.value)) members.push(first.value);
      [cell] = index.objectsOf(cell.value, RDF_REST);
    }
    return members;
  };

  const endsOf = (iri: string) => ({
    domains: classesNamedBy(index.objectsOf(iri, RDFS_DOMAIN)[0]),
    ranges: classesNamedBy(index.objectsOf(iri, RDFS_RANGE)[0]),
  });

  /* ------------------------------------------------------------------- annotations */

  const curieByIri = new Map<string, string>();
  for (const term of ANNOTATION_TERMS) {
    const iri = annotationTermIri(term.curie);
    if (iri) curieByIri.set(iri, term.curie);
  }

  const annotationsOn = (subject: string): Annotation[] =>
    index
      .triplesOf(subject)
      .filter((triple) => curieByIri.has(triple.predicate))
      .map((triple) => {
        const annotation: Annotation = {
          id: createId('ann'),
          term: curieByIri.get(triple.predicate) as string,
          value: triple.object.value,
        };
        if (triple.object.type === 'literal' && triple.object.language) {
          annotation.language = triple.object.language;
        }
        return annotation;
      });

  /* ------------------------------------------------------------------- layout */

  const stored = header
    ? index.objectsOf(header, ONTOSCHEMA_LAYOUT).find((term) => term.type === 'literal')
    : undefined;
  const layout = stored ? decodeLayout(stored.value) : new Map<string, Position>();

  /* ------------------------------------------------------------------- the model */

  const classes = classIris.map((iri) => ({
    id: classId.get(iri) as string,
    localName: named.get(iri) as string,
    superClassIds: index
      .objectsOf(iri, RDFS_SUBCLASS_OF)
      .filter((term) => term.type === 'iri' && classId.has(term.value))
      .map((term) => classId.get(term.value) as string),
    annotations: annotationsOn(iri),
    position: layout.get(iri) ?? { x: 0, y: 0 },
  }));

  const parentsOf = (iri: string) =>
    index
      .objectsOf(iri, RDFS_SUBPROPERTY_OF)
      .filter((term) => term.type === 'iri' && propertyId.has(term.value))
      .map((term) => term.value);

  const attributes = attributeIris.map((iri) => ({
    id: propertyId.get(iri) as string,
    localName: named.get(iri) as string,
    range: datatypeOf(index.objectsOf(iri, RDFS_RANGE)[0], report),
    superPropertyIds: parentsOf(iri)
      .filter((parent) => attributeIris.includes(parent))
      .map((parent) => propertyId.get(parent) as string),
    annotations: annotationsOn(iri),
  }));

  /*
   * A property with no domain or range of its own is still usable when an ancestor has both:
   * `hasParent` under `relatedTo` means whatever `relatedTo` means, narrowed. Walking up is
   * what lets a hierarchy survive a document that states the ends once, at the top.
   */
  const inheritedEnds = (iri: string) => {
    const seen = new Set<string>();
    let current: string | undefined = iri;
    while (current && !seen.has(current)) {
      seen.add(current);
      const ends = endsOf(current);
      if (ends.domains.length > 0 && ends.ranges.length > 0) return ends;
      current = parentsOf(current)[0];
    }
    return { domains: [] as string[], ranges: [] as string[] };
  };

  /*
   * A relation is kept when both its ends are known. Then the parents of anything kept are
   * kept too, however little they say for themselves: `worksFor` is a kind of `relatedTo`, and
   * importing the child while dropping the parent would leave the hierarchy flatter than the
   * document states it. A parent brought in this way has no usages — it sits in the pool,
   * exactly as an unused relation does in the editor.
   */
  const placeable = new Set(
    relationIris.filter((iri) => {
      const { domains, ranges } = inheritedEnds(iri);
      return domains.length > 0 && ranges.length > 0;
    }),
  );
  const kept = new Set(placeable);
  for (let added = true; added;) {
    added = false;
    for (const iri of [...kept]) {
      for (const parent of parentsOf(iri)) {
        if (!relationIris.includes(parent) || kept.has(parent)) continue;
        kept.add(parent);
        added = true;
      }
    }
  }
  report.relationsWithoutBothEnds = relationIris.filter((iri) => !kept.has(iri)).length;

  const usages: PropertyUsage[] = [];
  const relations: Relation[] = [];

  for (const iri of relationIris) {
    if (!kept.has(iri)) continue;
    relations.push({
      id: propertyId.get(iri) as string,
      localName: named.get(iri) as string,
      superPropertyIds: parentsOf(iri)
        .filter((parent) => kept.has(parent))
        .map((parent) => propertyId.get(parent) as string),
      annotations: annotationsOn(iri),
    });
    if (!placeable.has(iri)) continue;

    /*
     * Every pairing the union licenses, which is more than was drawn when the property was
     * used with several distinct pairs — the documented cost of a domain RDFS can state.
     */
    const { domains, ranges } = inheritedEnds(iri);
    for (const domain of domains) {
      for (const range of ranges) {
        usages.push({
          id: createId('use'),
          propertyId: propertyId.get(iri) as string,
          subjectClassId: classId.get(domain) as string,
          objectClassId: classId.get(range) as string,
        });
      }
    }
  }

  for (const iri of attributeIris) {
    for (const domain of endsOf(iri).domains) {
      usages.push({
        id: createId('use'),
        propertyId: propertyId.get(iri) as string,
        subjectClassId: classId.get(domain) as string,
        objectClassId: null,
      });
    }
  }

  return {
    ontology: {
      ...base,
      annotations: header ? annotationsOn(header) : [],
      classes,
      relations,
      attributes,
      usages,
    },
    report,
  };
}

/**
 * The namespace the document is about: the one most of its terms live in.
 *
 * Taken from the terms rather than from the ontology IRI, because the header is written
 * without its trailing separator and nothing in the document says whether that was a `#` or a
 * `/`. The terms carry it, and a document whose terms disagree is answered by the majority.
 */
function chooseNamespace(
  termIris: readonly string[],
  header: string | undefined,
): string | undefined {
  const counts = new Map<string, number>();
  for (const iri of termIris) {
    const namespace = namespaceOf(iri);
    counts.set(namespace, (counts.get(namespace) ?? 0) + 1);
  }
  const [commonest] = [...counts.entries()].sort(([, a], [, b]) => b - a)[0] ?? [];
  if (commonest) return commonest;
  return header ? normalizeNamespaceIri(header) : undefined;
}

/** The prefix the document declared for its own namespace, if it declared one. */
function choosePrefix(
  namespace: string | undefined,
  prefixes: Readonly<Record<string, string>>,
): string | undefined {
  if (!namespace) return undefined;
  return Object.entries(prefixes).find(([, iri]) => iri === namespace)?.[0];
}

/** An `xsd` range is kept; anything else becomes a string, which is a rewrite, not a drop. */
function datatypeOf(range: TripleObject | undefined, report: ImportReport): XsdDatatype {
  if (range?.type === 'iri') {
    const local = localNameOf(range.value);
    if (isXsdDatatype(local)) return local;
  }
  if (range !== undefined) report.datatypesRewritten += 1;
  return 'string';
}
