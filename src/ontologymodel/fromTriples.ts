import {
  ANNOTATION_TERMS,
  ONTOSCHEMA_LAYOUT,
  ONTOSCHEMA_POSITION,
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
  RDF_NIL,
  RDF_REST,
  RDF_TYPE,
  SH_CLASS,
  SH_DATATYPE,
  SH_NAME,
  SH_NODE_SHAPE,
  SH_OR,
  SH_PATH,
  SH_PROPERTY,
  SH_PROPERTY_SHAPE,
  SH_TARGET_CLASS,
  annotationTermIri,
  isXsdDatatype,
  xsdDatatypeIri,
} from '../annotationvocabulary';
import type { XsdDatatype } from '../annotationvocabulary';
import {
  localNameOf,
  namespaceOf,
  normalizeNamespaceIri,
  ontologyIri,
  sanitizeLocalName,
  toClassLocalName,
  toPropertyLocalName,
  uniqueLocalName,
} from './identifier';
import { decodeLayout, decodePosition } from './layout';
import { createEmptyOntology, createId } from './ontology';
import { annotationTriple, isBlankNode } from './triples';
import type { Triple, TripleObject } from './triples';
import type { Annotation, Ontology, Position, PropertyUsage, Relation } from './types';
import { ONTOLOGY_REF, entityRef, nodeShapeRef, propertyShapeRef, setAside } from './unmodelled';

/**
 * Reading a document back into the model — the inverse of `ontologyToTriples`, and the half
 * that has to decide what the model *holds*.
 *
 * This tool models a deliberately narrow slice of OWL, so a document written anywhere else
 * will contain things it has no home for. Those are kept, as written, beside the model rather
 * than in it (see `unmodelled.ts`): they are not on the canvas, and saving writes them back.
 * A file opened here and saved again says what it said, plus whatever was edited.
 *
 * What the model takes, decided rather than inferred — and only from the document's own
 * namespace, since a term from FOAF moved into this one would be a different term:
 *
 *  - **Classes** and their `rdfs:subClassOf` hierarchy, where both ends are named classes.
 *  - **Annotations** from the vocabulary this app knows, where the writer would write the
 *    value back exactly as it reads.
 *  - **Attributes** whatever their range: an `xsd` type is kept, anything else becomes
 *    `xsd:string`. This is the one rule that *rewrites* rather than keeps, so it is reported.
 *  - **Relations**, drawn where both a domain and a range are known — stated on the property,
 *    inherited from an ancestor, or drawn by a shape — and in the pool, unused, otherwise.
 *  - **Positions**, from this app's own `ontoschema:position` on each class, or from the single
 *    `ontoschema:layout` annotation that files were saved with before that.
 *
 * A statement is taken into the model only where the writer will say it again from the model;
 * every other statement is kept. That one rule is what keeps the two from disagreeing: a kept
 * statement can never contradict an edit, because nothing the model can change is kept.
 */

/** What arrived, but not as written. */
export interface ImportReport {
  /** Attributes whose range was not an `xsd` type and now says `xsd:string`. */
  datatypesRewritten: number;
}

export interface ImportResult {
  ontology: Ontology;
  report: ImportReport;
}

/** Indexed triples, which every step below reads and none of them rebuilds. */
interface Index {
  statementsOf: (subject: string, predicate: string) => Triple[];
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

  const statementsOf = (subject: string, predicate: string) =>
    (bySubject.get(subject) ?? []).filter((triple) => triple.predicate === predicate);

  return {
    statementsOf,
    objectsOf: (subject, predicate) =>
      statementsOf(subject, predicate).map((triple) => triple.object),
    subjectsTyped: (type) => byType.get(type) ?? [],
    triplesOf: (subject) => bySubject.get(subject) ?? [],
  };
}

/** One property shape, as far as it says which classes a property joins. */
interface ShapeReading {
  nodeShape: string;
  /** An IRI, or a `_:label` for a shape written inline. */
  propertyShape: string;
  /** The class the node shape targets. */
  target: string;
  path: string;
  /** The classes it points at: several for an `sh:or`, `null` alone for a datatype. */
  objects: (string | null)[];
  /** The statements naming those classes or that datatype, which the writer says again. */
  said: Triple[];
}

/**
 * The pairings a document's SHACL shapes state.
 *
 * The axioms cannot carry this. `rdfs:domain`/`rdfs:range` name both ends of a relation but not
 * which end went with which, so a relation drawn between two distinct pairs reads back as all
 * four — a saved file that came home with relations nobody drew. A shape is per class, so it
 * says exactly what was drawn: this class, this property, that class.
 *
 * Read whenever they are present, from our own saved files and from anyone else's. A document
 * without shapes falls back to the ends, which is all it has. A shape naming anything the model
 * does not hold is not read at all: it stays in the document as written, whole, rather than
 * being drawn as part of what it says.
 */
function shapeReadings(index: Index, modelled: (iri: string) => boolean): ShapeReading[] {
  const readings: ShapeReading[] = [];

  /** The members of an `sh:or`, which is an RDF list of shapes each naming one class. */
  const alternatives = (head: TripleObject) => {
    const classes: string[] = [];
    const said: Triple[] = [];
    let cell: TripleObject | undefined = head;
    const seen = new Set<string>();
    while (cell && cell.value !== RDF_NIL && !seen.has(cell.value)) {
      seen.add(cell.value);
      const [first] = index.statementsOf(cell.value, RDF_FIRST);
      const [rest] = index.statementsOf(cell.value, RDF_REST);
      if (first) {
        said.push(first);
        const [target] = index.statementsOf(first.object.value, SH_CLASS);
        if (target?.object.type === 'iri') {
          classes.push(target.object.value);
          said.push(target);
        }
      }
      if (rest) said.push(rest);
      cell = rest?.object;
    }
    return { classes, said };
  };

  for (const nodeShape of index.subjectsTyped(SH_NODE_SHAPE)) {
    const target = index.objectsOf(nodeShape, SH_TARGET_CLASS)[0];
    if (target?.type !== 'iri' || !modelled(target.value)) continue;

    for (const { value: propertyShape } of index.objectsOf(nodeShape, SH_PROPERTY)) {
      const path = index.objectsOf(propertyShape, SH_PATH)[0];
      if (path?.type !== 'iri' || !modelled(path.value)) continue;

      const [single] = index.statementsOf(propertyShape, SH_CLASS);
      const [list] = index.statementsOf(propertyShape, SH_OR);
      const [datatype] = index.statementsOf(propertyShape, SH_DATATYPE);
      const reading = { nodeShape, propertyShape, target: target.value, path: path.value };

      if (single?.object.type === 'iri') {
        readings.push({ ...reading, objects: [single.object.value], said: [single] });
      } else if (list) {
        const { classes, said } = alternatives(list.object);
        readings.push({ ...reading, objects: classes, said: [list, ...said] });
      } else if (datatype) {
        // A datatype shape is an attribute on this class: one end, and no second one to name.
        readings.push({ ...reading, objects: [null], said: [datatype] });
      }
    }
  }

  return readings.filter((reading) =>
    reading.objects.every((object) => object === null || modelled(object)),
  );
}

/**
 * A value this function put in the map itself, fetched back.
 *
 * Every one of these lookups is keyed by an IRI taken from the same list that filled the map a
 * few lines above, so the value is always there — and `as string` said so by silencing the
 * compiler rather than by checking. If the two ever drift apart, a cast hands `undefined` to the
 * model typed as a string and it travels; a throw stops it where the mistake is, with the key
 * that was missing. Nothing catches this: it would mean a bug in this file, not a bad document.
 */
function known<T>(map: Map<string, T>, key: string, what: string): T {
  const value = map.get(key);
  if (value === undefined) throw new Error(`${what} was never recorded for ${key}`);
  return value;
}

/** Whether two objects are the same RDF term. */
function sameTerm(a: TripleObject, b: TripleObject): boolean {
  const extras = (term: TripleObject) =>
    term.type === 'literal' ? `${term.language ?? ''}|${term.datatype ?? ''}` : '';
  return a.type === b.type && a.value === b.value && extras(a) === extras(b);
}

export function ontologyFromTriples(
  triples: readonly Triple[],
  prefixes: Readonly<Record<string, string>> = {},
): ImportResult {
  const index = indexTriples(triples);
  const report: ImportReport = { datatypesRewritten: 0 };

  /*
   * What the model took, and what it now names. Everything not taken is kept as written, with
   * the terms the model names replaced by references to them.
   */
  const used = new Set<Triple>();
  const use = (statements: readonly (Triple | undefined)[]) => {
    for (const statement of statements) if (statement) used.add(statement);
  };
  const anchors = new Map<string, string>();

  /*
   * Named terms only. A union domain is a blank node typed `owl:Class`, so taking every
   * `owl:Class` subject would turn each union into a class of its own, called nothing.
   */
  const declared = (type: string) => index.subjectsTyped(type).filter((iri) => !isBlankNode(iri));
  const header = declared(OWL_ONTOLOGY)[0];
  const namespace = chooseNamespace(
    [...declared(OWL_CLASS), ...declared(OWL_OBJECT_PROPERTY), ...declared(OWL_DATATYPE_PROPERTY)],
    header,
  );
  const base = createEmptyOntology(namespace, choosePrefix(namespace, prefixes));

  /*
   * The model's names are a namespace and a local name, so a term from elsewhere cannot be in it
   * without becoming a different term. It stays in the document as it was written instead.
   */
  const ours = (iri: string) => namespaceOf(iri) === namespace;
  const classIris = declared(OWL_CLASS).filter(ours);
  const relationIris = declared(OWL_OBJECT_PROPERTY).filter(ours);
  const attributeIris = declared(OWL_DATATYPE_PROPERTY).filter(ours);

  /* ------------------------------------------------------------------- names and ids */

  const taken = new Set<string>();
  /*
   * The name as written whenever it is a legal one here. The naming conventions are for names
   * typed into this app; applied to a document, they turned `my_class` into `MyClass` and so
   * moved the term to an IRI that no other file refers to.
   */
  const nameFor = (iri: string, asClass: boolean) => {
    const written = localNameOf(iri);
    const raw =
      written && sanitizeLocalName(written) === written
        ? written
        : asClass
          ? toClassLocalName(written)
          : toPropertyLocalName(written);
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

  /** Takes a term into the model: its declaration is the writer's now, and so is its name. */
  const take = (iri: string, id: string, type: string) => {
    anchors.set(iri, entityRef(id));
    use(index.statementsOf(iri, RDF_TYPE).filter((triple) => triple.object.value === type));
  };

  /* ------------------------------------------------------------------- class expressions */

  /**
   * The classes a domain or a range names: one when it is a class, several when it is the union
   * a reused property is written with, none when it is anything else. `said` is the statement
   * and the union it points at, when every class named is modelled and the writer can therefore
   * say the same again; otherwise it is empty and they are kept as written.
   */
  const endOf = (iri: string, predicate: string): { classes: string[]; said: Triple[] } => {
    const [statement] = index.statementsOf(iri, predicate);
    const term = statement?.object;
    if (!statement || !term) return { classes: [], said: [] };
    if (term.type === 'iri') {
      return classId.has(term.value)
        ? { classes: [term.value], said: [statement] }
        : { classes: [], said: [] };
    }
    if (term.type !== 'blank') return { classes: [], said: [] };

    const [union] = index.statementsOf(term.value, OWL_UNION_OF);
    if (!union) return { classes: [], said: [] };

    const classes: string[] = [];
    const said = [
      statement,
      union,
      ...index.statementsOf(term.value, RDF_TYPE).filter((t) => t.object.value === OWL_CLASS),
    ];
    let complete = true;
    let cell: TripleObject | undefined = union.object;
    const seen = new Set<string>();
    while (cell && cell.type === 'blank' && !seen.has(cell.value)) {
      seen.add(cell.value);
      const [first] = index.statementsOf(cell.value, RDF_FIRST);
      const [rest] = index.statementsOf(cell.value, RDF_REST);
      if (first?.object.type === 'iri' && classId.has(first.object.value)) {
        classes.push(first.object.value);
      } else {
        complete = false;
      }
      said.push(...[first, rest].filter((t): t is Triple => t !== undefined));
      cell = rest?.object;
    }
    if (cell?.value !== RDF_NIL) complete = false;
    return { classes, said: complete ? said : [] };
  };

  const endsOf = (iri: string) => ({
    domains: endOf(iri, RDFS_DOMAIN).classes,
    ranges: endOf(iri, RDFS_RANGE).classes,
  });

  /* ------------------------------------------------------------------- annotations */

  const curieByIri = new Map<string, string>();
  for (const term of ANNOTATION_TERMS) {
    const iri = annotationTermIri(term.curie);
    if (iri) curieByIri.set(iri, term.curie);
  }

  /*
   * Only what the writer would write back exactly. A typed value it would write as plain text,
   * or a language tag on a term that takes none, is kept as written instead of being changed.
   */
  const annotationsOn = (subject: string): Annotation[] =>
    index.triplesOf(subject).flatMap((triple) => {
      const term = curieByIri.get(triple.predicate);
      if (!term) return [];
      const annotation: Annotation = { id: createId('ann'), term, value: triple.object.value };
      if (triple.object.type === 'literal' && triple.object.language) {
        annotation.language = triple.object.language;
      }
      const written = annotationTriple(subject, annotation);
      if (!written || !sameTerm(written.object, triple.object)) return [];
      use([triple]);
      return [annotation];
    });

  /* ------------------------------------------------------------------- layout */

  // This app's own bookkeeping, which the writer states again whenever it applies.
  use(index.statementsOf(ONTOSCHEMA_POSITION, RDF_TYPE));
  use(index.statementsOf(ONTOSCHEMA_LAYOUT, RDF_TYPE));

  const [stored] = header
    ? index.statementsOf(header, ONTOSCHEMA_LAYOUT).filter((t) => t.object.type === 'literal')
    : [];
  use([stored]);
  const legacyLayout = stored ? decodeLayout(stored.object.value) : new Map<string, Position>();

  /** A class's own position first, then the old ontology-wide form, then nowhere in particular. */
  const positionOf = (iri: string): Position => {
    const statements = index.statementsOf(iri, ONTOSCHEMA_POSITION);
    use(statements);
    const own = statements
      .filter((triple) => triple.object.type === 'literal')
      .map((triple) => decodePosition(triple.object.value))
      .find((position) => position !== null);
    return own ?? legacyLayout.get(iri) ?? { x: 0, y: 0 };
  };

  /* ------------------------------------------------------------------- the model */

  if (header) {
    anchors.set(header, ONTOLOGY_REF);
    use(index.statementsOf(header, RDF_TYPE).filter((t) => t.object.value === OWL_ONTOLOGY));
  }

  const classes = classIris.map((iri) => {
    const id = known(classId, iri, 'a class id');
    take(iri, id, OWL_CLASS);
    const parents = index
      .statementsOf(iri, RDFS_SUBCLASS_OF)
      .filter((triple) => triple.object.type === 'iri' && classId.has(triple.object.value));
    use(parents);
    return {
      id,
      localName: known(named, iri, 'a local name'),
      superClassIds: parents.map((triple) => known(classId, triple.object.value, 'a class id')),
      annotations: annotationsOn(iri),
      position: positionOf(iri),
    };
  });

  const parentsOf = (iri: string) =>
    index
      .objectsOf(iri, RDFS_SUBPROPERTY_OF)
      .filter((term) => term.type === 'iri' && propertyId.has(term.value))
      .map((term) => term.value);

  /** The parents a property keeps, of those among `among`, with the statements saying so. */
  const takeParents = (iri: string, among: (parent: string) => boolean) => {
    const statements = index
      .statementsOf(iri, RDFS_SUBPROPERTY_OF)
      .filter((triple) => triple.object.type === 'iri' && among(triple.object.value));
    use(statements);
    return statements.map((triple) => known(propertyId, triple.object.value, 'a property id'));
  };

  const attributes = attributeIris.map((iri) => {
    const id = known(propertyId, iri, 'a property id');
    take(iri, id, OWL_DATATYPE_PROPERTY);
    const [range] = index.statementsOf(iri, RDFS_RANGE);
    use([range]);
    return {
      id,
      localName: known(named, iri, 'a local name'),
      range: datatypeOf(range?.object, report),
      superPropertyIds: takeParents(iri, (parent) => attributeIris.includes(parent)),
      annotations: annotationsOn(iri),
    };
  });

  /*
   * What the shapes say, which is more than the axioms can. Consulted first for any property
   * they mention; the ends are the fallback for a document that has none.
   */
  const readings = shapeReadings(index, (iri) => classId.has(iri) || propertyId.has(iri));
  const shapePairs = new Map<string, { subject: string; object: string | null }[]>();
  for (const reading of readings) {
    const pairs = shapePairs.get(reading.path) ?? [];
    for (const object of reading.objects) pairs.push({ subject: reading.target, object });
    shapePairs.set(reading.path, pairs);
  }

  /*
   * A property with an end missing borrows it from the nearest ancestor that states one:
   * `hasParent` under `relatedTo` means whatever `relatedTo` means, narrowed. Walking up is
   * what lets a hierarchy survive a document that states the ends once, at the top.
   *
   * **One end at a time.** This used to climb until it found an ancestor stating *both*, and
   * then take that ancestor's pair whole — which threw away the end the property itself
   * declared. In the Building Assessment Ontology, `hasCategory` states `rdfs:range :Category`
   * and no domain, and is a sub-property of `hasPart`, whose two ends are both `Part`; it was
   * imported as `Part -> Part`, with `Category` discarded. Six properties in that one file were
   * silently repointed, and saving it would have written the change back out.
   *
   * Per end is also what RDFS means. `rdfs:domain` and `rdfs:range` are independent assertions,
   * and a sub-property inherits each of them separately; nothing ties them together such that
   * stating one should cost you the other.
   */
  const inheritedEnds = (iri: string) => {
    const own = endsOf(iri);
    let domains = own.domains;
    let ranges = own.ranges;

    const seen = new Set<string>([iri]);
    let current: string | undefined = parentsOf(iri)[0];
    while (current && !seen.has(current) && (domains.length === 0 || ranges.length === 0)) {
      seen.add(current);
      const ends = endsOf(current);
      if (domains.length === 0) domains = ends.domains;
      if (ranges.length === 0) ranges = ends.ranges;
      current = parentsOf(current)[0];
    }
    return { domains, ranges };
  };

  /*
   * Every relation goes into the pool, and is drawn where both its ends are known. One with an
   * end missing sits in the pool unused, exactly as an unused relation does in the editor, and
   * the end it does state is kept as written. Leaving it out of the pool would hide a term the
   * document defines, and an unused relation this app saved would not come back at all.
   */
  const placeable = new Set(
    relationIris.filter((iri) => {
      if (shapePairs.has(iri)) return true;
      const { domains, ranges } = inheritedEnds(iri);
      return domains.length > 0 && ranges.length > 0;
    }),
  );

  const usages: PropertyUsage[] = [];
  const relations: Relation[] = [];

  for (const iri of relationIris) {
    const id = known(propertyId, iri, 'a property id');
    take(iri, id, OWL_OBJECT_PROPERTY);
    relations.push({
      id,
      localName: known(named, iri, 'a local name'),
      superPropertyIds: takeParents(iri, (parent) => relationIris.includes(parent)),
      annotations: annotationsOn(iri),
    });
    if (!placeable.has(iri)) continue;

    /*
     * Exactly what was drawn, when the shapes are there to say so. This is what a file saved
     * by this app carries, and it is why saving and opening one gives back the schema rather
     * than a superset of it.
     */
    const drawn = shapePairs.get(iri);
    if (drawn) {
      for (const pair of drawn) {
        const subject = classId.get(pair.subject);
        const object = pair.object ? classId.get(pair.object) : undefined;
        if (subject && object) {
          usages.push({
            id: createId('use'),
            propertyId: id,
            subjectClassId: subject,
            objectClassId: object,
          });
        }
      }
      continue;
    }

    /*
     * Otherwise every pairing the union licenses, which is more than was drawn when the
     * property was used with several distinct pairs — the cost of a domain RDFS can state,
     * paid only by documents that arrive without shapes.
     */
    const { domains, ranges } = inheritedEnds(iri);
    for (const domain of domains) {
      for (const range of ranges) {
        usages.push({
          id: createId('use'),
          propertyId: id,
          subjectClassId: known(classId, domain, 'a class id'),
          objectClassId: known(classId, range, 'a class id'),
        });
      }
    }
  }

  for (const iri of attributeIris) {
    // An attribute's usage is a class and a property, so the two sources agree -- but the
    // shapes are read first all the same, so one rule covers both kinds of property.
    const classes = shapePairs.get(iri)?.map((pair) => pair.subject) ?? endsOf(iri).domains;
    for (const domain of classes) {
      const subject = classId.get(domain);
      if (!subject) continue;
      usages.push({
        id: createId('use'),
        propertyId: known(propertyId, iri, 'a property id'),
        subjectClassId: subject,
        objectClassId: null,
      });
    }
  }

  /*
   * The ends of a property in use are the writer's now: it states them from the usages, and a
   * domain kept as written beside them would go stale the moment a usage changed. The ends of a
   * property in use nowhere are kept, since the writer would have nothing to say for them.
   */
  const inUse = new Set(usages.map((usage) => usage.propertyId));
  for (const iri of [...relationIris, ...attributeIris]) {
    if (!inUse.has(known(propertyId, iri, 'a property id'))) continue;
    use(endOf(iri, RDFS_DOMAIN).said);
    use(endOf(iri, RDFS_RANGE).said);
  }

  /*
   * A shape that was read is the writer's too, under the name it gives it. What the writer does
   * not say — a cardinality, a message — is kept and attached to that shape by reference, so
   * it goes when the class stops using the property.
   */
  for (const reading of readings) {
    const target = known(classId, reading.target, 'a class id');
    const path = known(propertyId, reading.path, 'a property id');
    if (!inUse.has(path)) continue;
    if (!anchors.has(reading.nodeShape)) anchors.set(reading.nodeShape, nodeShapeRef(target));
    anchors.set(reading.propertyShape, propertyShapeRef(target, path));
    use(reading.said);
    use(
      [
        ...index.statementsOf(reading.nodeShape, RDF_TYPE),
        ...index.statementsOf(reading.nodeShape, SH_TARGET_CLASS),
        ...index.statementsOf(reading.nodeShape, SH_PROPERTY),
        ...index.statementsOf(reading.propertyShape, RDF_TYPE),
        ...index.statementsOf(reading.propertyShape, SH_PATH),
      ].filter((triple) =>
        [
          SH_NODE_SHAPE,
          SH_PROPERTY_SHAPE,
          reading.target,
          reading.propertyShape,
          reading.path,
        ].includes(triple.object.value),
      ),
    );
    const name = known(named, reading.path, 'a local name');
    use(
      index
        .statementsOf(reading.propertyShape, SH_NAME)
        .filter((triple) => sameTerm(triple.object, { type: 'literal', value: name })),
    );
  }

  return {
    ontology: {
      ...base,
      annotations: header ? annotationsOn(header) : [],
      classes,
      relations,
      attributes,
      usages,
      unmodelled: setAside(triples, used, anchors),
    },
    report,
  };
}

/**
 * The namespace the document is about.
 *
 * The one its header names, when some of its terms live there: an ontology that declares a few
 * terms of its own and many borrowed from FOAF is still about its own. Otherwise the one most of
 * its terms live in. Taken from the terms rather than from the header alone, because the header
 * is written without its trailing separator and nothing in the document says whether that was a
 * `#` or a `/`. The terms carry it.
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
  const own = header ? [...counts.keys()].find((ns) => ontologyIri(ns) === header) : undefined;
  if (own) return own;
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
    if (isXsdDatatype(local) && xsdDatatypeIri(local) === range.value) return local;
  }
  if (range !== undefined) report.datatypesRewritten += 1;
  return 'string';
}
