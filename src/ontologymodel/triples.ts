import {
  OWL_CLASS,
  OWL_DATATYPE_PROPERTY,
  OWL_OBJECT_PROPERTY,
  ONTOSCHEMA_LAYOUT,
  OWL_ANNOTATION_PROPERTY,
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
  findAnnotationTerm,
  isValidLanguageTag,
  xsdDatatypeIri,
} from '../annotationvocabulary';
import {
  ABSOLUTE_IRI_VALUE,
  entityIri,
  normalizeNamespaceIri,
  ontologyIri,
  uniqueLocalName,
} from './identifier';
import { indexOntology, classLocalNames, propertyLocalNames } from './ontology';
import { encodeLayout } from './layout';
import type { Annotation, Ontology, PropertyUsage } from './types';

/**
 * A minimal, serializer-agnostic RDF term. This is the ONLY thing the serialization layer
 * consumes, which is what guarantees Turtle, RDF/XML and JSON-LD are semantically
 * identical: they are three renderings of one list.
 *
 * Blank nodes exist here for one purpose and no other: an **OWL class expression**, which is
 * the `owl:unionOf` a reused property needs for its domain. That is not a stylistic choice.
 * The same union written as a *named* class parses back as a bare class with no union at all
 * — measured against a real OWL parser, which drops the `owl:unionOf` triple on the floor —
 * so a named union would assert a domain that means nothing, which is worse than asserting
 * none. Anonymity is what makes an OWL tool read it as an expression.
 *
 * Everything else stays named, shapes and their `sh:or` lists included: SHACL puts no such
 * requirement on them, and a named shape can be pointed at, annotated and diffed.
 *
 * A blank node is a string in the `_:label` form N-Triples uses, as a subject and as an
 * object alike, so one predicate — `isBlankNode` — answers for both.
 */
export type TripleObject =
  | { type: 'iri'; value: string }
  | { type: 'blank'; value: string }
  | { type: 'literal'; value: string; language?: string; datatype?: string };

export interface Triple {
  /** An IRI, or a blank node label in `_:label` form. */
  subject: string;
  predicate: string;
  object: TripleObject;
}

export const iri = (value: string): TripleObject => ({ type: 'iri', value });

/** `label` is the whole `_:name` string, the same one that appears as a subject. */
export const blank = (label: string): TripleObject => ({ type: 'blank', value: label });

export const BLANK_PREFIX = '_:';

export const isBlankNode = (value: string): boolean => value.startsWith(BLANK_PREFIX);

/** The bare label a writer needs, without the `_:` the model carries it with. */
export const blankLabel = (value: string): string => value.slice(BLANK_PREFIX.length);

export function literal(
  value: string,
  options: { language?: string; datatype?: string } = {},
): TripleObject {
  const node: TripleObject = { type: 'literal', value };
  // A literal may carry a language tag or a datatype, never both.
  if (options.language) node.language = options.language;
  else if (options.datatype) node.datatype = options.datatype;
  return node;
}

export interface SerializationOptions {
  /** Emit OWL/RDFS class and property axioms. */
  includeAxioms?: boolean;
  /** Emit SHACL node and property shapes for every usage. */
  includeShapes?: boolean;
  /**
   * Emit where the classes sit on the canvas.
   *
   * On by default, because a saved file has to come back looking the way it was left. It is
   * a flag of its own rather than part of the axioms: a layout is neither an axiom nor a
   * constraint, and a file meant only to be read by another tool can leave it out.
   */
  includeLayout?: boolean;
}

const DEFAULT_OPTIONS: Required<SerializationOptions> = {
  includeAxioms: true,
  includeShapes: true,
  includeLayout: true,
};

/**
 * Renders one annotation. Terms declared `iri` produce an IRI object when the value really
 * is one; `date` produces an xsd:date literal; `text` may carry a language tag.
 * Blank values are skipped by the caller.
 */
function annotationTriple(subject: string, annotation: Annotation): Triple | null {
  const predicate = annotationTermIri(annotation.term);
  if (!predicate) return null;

  const value = annotation.value.trim();
  if (!value) return null;

  const term = findAnnotationTerm(annotation.term);
  const kind = term?.kind ?? 'text';

  if (kind === 'iri' && ABSOLUTE_IRI_VALUE.test(value)) {
    return { subject, predicate, object: iri(value) };
  }
  if (kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return {
      subject,
      predicate,
      object: literal(value, { datatype: 'http://www.w3.org/2001/XMLSchema#date' }),
    };
  }
  if (kind === 'text' && annotation.language && isValidLanguageTag(annotation.language)) {
    return { subject, predicate, object: literal(value, { language: annotation.language }) };
  }
  return { subject, predicate, object: literal(value) };
}

function annotationTriples(subject: string, annotations: readonly Annotation[]): Triple[] {
  return annotations
    .map((annotation) => annotationTriple(subject, annotation))
    .filter((triple): triple is Triple => triple !== null);
}

/**
 * Projects the whole ontology to triples.
 *
 * Two layers are produced from one model:
 *
 *  - **Axioms** — class and property declarations, the subclass and subproperty
 *    hierarchies, and `rdfs:domain`/`rdfs:range`. A property used on a single class has a
 *    real domain and gets it directly. Once reused, RDFS alone cannot state the truth —
 *    repeating the domain means *intersection*, that a thing using the property is a Company
 *    and a School at once — so the domain becomes an `owl:unionOf` over every class that
 *    uses it. That is true, and weaker than the pairing it came from: the union says which
 *    classes are involved, not which subject went with which object. It is what lets the
 *    ontology file be read back without the shapes beside it.
 *
 *  - **Shapes** — one `sh:PropertyShape` per usage, grouped into one `sh:NodeShape` per
 *    class. This is per-class, so it keeps every pairing intact and carries exactly what
 *    the canvas shows. Shapes are named rather than blank so that they are addressable and
 *    so the serializers stay simple.
 */
export function ontologyToTriples(
  ontology: Ontology,
  options: SerializationOptions = {},
): Triple[] {
  const { includeAxioms, includeShapes, includeLayout } = { ...DEFAULT_OPTIONS, ...options };
  const namespace = normalizeNamespaceIri(ontology.iri);
  const subjectOf = (localName: string) => entityIri(namespace, localName);
  const index = indexOntology(ontology);

  const classIri = new Map(ontology.classes.map((e) => [e.id, subjectOf(e.localName)]));
  const relationIri = new Map(ontology.relations.map((e) => [e.id, subjectOf(e.localName)]));
  const attributeIri = new Map(ontology.attributes.map((e) => [e.id, subjectOf(e.localName)]));
  const propertyIri = (id: string) => relationIri.get(id) ?? attributeIri.get(id);

  const triples: Triple[] = [];

  const mintName = nameAllocator(ontology, namespace);
  /*
   * Class expressions are collected apart from the axioms and appended at the end. A Turtle
   * writer groups a subject's triples only while they stay adjacent, so emitting a union in
   * the middle of the property that refers to it splits that property across two blocks.
   */
  const expressions: Triple[] = [];
  const mintBlank = blankAllocator();

  const header = ontologyIri(namespace);
  triples.push({ subject: header, predicate: RDF_TYPE, object: iri(OWL_ONTOLOGY) });
  triples.push(...annotationTriples(header, ontology.annotations));

  if (includeLayout) {
    const layout = encodeLayout(ontology);
    if (layout !== null) {
      // Declared, so the document is still valid OWL rather than carrying a term from nowhere.
      triples.push({
        subject: ONTOSCHEMA_LAYOUT,
        predicate: RDF_TYPE,
        object: iri(OWL_ANNOTATION_PROPERTY),
      });
      triples.push({ subject: header, predicate: ONTOSCHEMA_LAYOUT, object: literal(layout) });
    }
  }

  if (includeAxioms) {
    for (const entity of ontology.classes) {
      const subject = classIri.get(entity.id);
      if (!subject) continue;
      triples.push({ subject, predicate: RDF_TYPE, object: iri(OWL_CLASS) });
      triples.push(...annotationTriples(subject, entity.annotations));
      for (const parentId of entity.superClassIds) {
        const parent = classIri.get(parentId);
        if (parent && parent !== subject) {
          triples.push({ subject, predicate: RDFS_SUBCLASS_OF, object: iri(parent) });
        }
      }
    }

    for (const property of ontology.relations) {
      const subject = relationIri.get(property.id);
      if (!subject) continue;
      triples.push({ subject, predicate: RDF_TYPE, object: iri(OWL_OBJECT_PROPERTY) });
      triples.push(...annotationTriples(subject, property.annotations));
      for (const parentId of property.superPropertyIds) {
        const parent = relationIri.get(parentId);
        if (parent && parent !== subject) {
          triples.push({ subject, predicate: RDFS_SUBPROPERTY_OF, object: iri(parent) });
        }
      }

      const usages = index.usagesByProperty.get(property.id) ?? [];
      const domains = distinctIris(usages.map((usage) => classIri.get(usage.subjectClassId)));
      const ranges = distinctIris(
        usages.map((usage) =>
          usage.objectClassId ? classIri.get(usage.objectClassId) : undefined,
        ),
      );

      /*
       * A union states both ends but not which end went with which, so it licenses pairings
       * nobody drew. It is written only when this document has nothing better: with the shapes
       * in the same file they say exactly what was drawn, and a union beside them would be a
       * looser second answer to a question already answered.
       *
       * Each end is judged on its own. A relation drawn from one class to three still has an
       * exact domain, and dropping it because the *other* end is plural would throw away
       * something true for nothing.
       */
      const state = (members: string[], predicate: string) => {
        if (members.length > 1 && includeShapes) return;
        const expression = classExpression(members, mintBlank, expressions);
        if (expression) triples.push({ subject, predicate, object: expression });
      };
      state(domains, RDFS_DOMAIN);
      state(ranges, RDFS_RANGE);
    }

    for (const property of ontology.attributes) {
      const subject = attributeIri.get(property.id);
      if (!subject) continue;
      triples.push({ subject, predicate: RDF_TYPE, object: iri(OWL_DATATYPE_PROPERTY) });
      triples.push(...annotationTriples(subject, property.annotations));
      for (const parentId of property.superPropertyIds) {
        const parent = attributeIri.get(parentId);
        if (parent && parent !== subject) {
          triples.push({ subject, predicate: RDFS_SUBPROPERTY_OF, object: iri(parent) });
        }
      }

      // The xsd range is global — `price` is a decimal wherever it is used — so it is stated
      // outright. Only the domain depends on which classes carry the attribute.
      triples.push({
        subject,
        predicate: RDFS_RANGE,
        object: iri(xsdDatatypeIri(property.range)),
      });
      const usages = index.usagesByProperty.get(property.id) ?? [];
      const domains = distinctIris(usages.map((usage) => classIri.get(usage.subjectClassId)));
      // Same rule as a relation's: the union is for documents with no shapes to say it better.
      if (!(domains.length > 1 && includeShapes)) {
        const domain = classExpression(domains, mintBlank, expressions);
        if (domain) triples.push({ subject, predicate: RDFS_DOMAIN, object: domain });
      }
    }

    triples.push(...expressions);
  }

  if (includeShapes) {
    triples.push(
      ...shapeTriples(ontology, {
        classIri,
        propertyIri,
        attributeIds: new Set(ontology.attributes.map((e) => e.id)),
        namespace,
        mintName,
      }),
    );
  }

  return dedupe(triples);
}

/**
 * Mints local names for the things this module invents, never colliding with a real entity
 * nor with each other.
 *
 * Seeded with every class and property name in the ontology, so a generated union or shape
 * cannot land on a class the user happens to have called `CarShape` or `offeredByDomain`.
 */
type NameAllocator = (desired: string) => string;

function nameAllocator(ontology: Ontology, namespace: string): NameAllocator {
  const taken = new Set([...classLocalNames(ontology), ...propertyLocalNames(ontology)]);
  return (desired: string) => {
    const unique = uniqueLocalName(desired, taken);
    taken.add(unique);
    return entityIri(namespace, unique);
  };
}

/** Drops the misses and the repeats, keeping the order the usages were drawn in. */
function distinctIris(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

/** Labels the blank nodes of one document: `_:x1`, `_:x2`, in the order they are needed. */
function blankAllocator(): () => string {
  let issued = 0;
  return () => {
    issued += 1;
    return `${BLANK_PREFIX}x${issued}`;
  };
}

/**
 * The class expression standing for a set of classes: nothing, the class itself, or an
 * anonymous `owl:unionOf` over all of them.
 *
 * Anonymous because an OWL parser only reads a union as an expression when it is a blank
 * node; named, the union is dropped and the domain becomes a class that means nothing. See
 * the note on `TripleObject`.
 */
function classExpression(
  members: readonly string[],
  mintBlank: () => string,
  sink: Triple[],
): TripleObject | undefined {
  if (members.length === 0) return undefined;
  if (members.length === 1) return iri(members[0]!);

  const union = mintBlank();
  sink.push({ subject: union, predicate: RDF_TYPE, object: iri(OWL_CLASS) });
  sink.push({
    subject: union,
    predicate: OWL_UNION_OF,
    object: blank(rdfList(members, mintBlank, sink)),
  });
  return blank(union);
}

interface ShapeContext {
  classIri: Map<string, string>;
  propertyIri: (id: string) => string | undefined;
  attributeIds: Set<string>;
  namespace: string;
  mintName: NameAllocator;
}

/**
 * One node shape per class that has usages, and one named property shape per
 * (class, property) pair.
 *
 * Usages are grouped by (class, property) because two property shapes on the same path are
 * *conjunctive* in SHACL: `Car hasPart Wheel` plus `Car hasPart Door` as separate shapes
 * would demand that every part be simultaneously a Wheel and a Door. Grouped, the
 * alternatives become a single `sh:or`, which is what the canvas actually means.
 */
function shapeTriples(ontology: Ontology, context: ShapeContext): Triple[] {
  const triples: Triple[] = [];
  const shapeIri = context.mintName;

  for (const entity of ontology.classes) {
    const classSubject = context.classIri.get(entity.id);
    if (!classSubject) continue;

    const usages = ontology.usages.filter((usage) => usage.subjectClassId === entity.id);
    if (usages.length === 0) continue;

    // Group this class's usages by the property they use.
    const byProperty = new Map<string, PropertyUsage[]>();
    for (const usage of usages) {
      if (!context.propertyIri(usage.propertyId)) continue;
      const existing = byProperty.get(usage.propertyId);
      if (existing) existing.push(usage);
      else byProperty.set(usage.propertyId, [usage]);
    }
    if (byProperty.size === 0) continue;

    const nodeShape = shapeIri(`${entity.localName}Shape`);
    triples.push({ subject: nodeShape, predicate: RDF_TYPE, object: iri(SH_NODE_SHAPE) });
    triples.push({ subject: nodeShape, predicate: SH_TARGET_CLASS, object: iri(classSubject) });

    // The node shape's own triples are emitted contiguously, with the property shapes that
    // follow collected separately. Turtle writers group by subject only while a subject's
    // triples stay adjacent, so interleaving them would produce a repetitive document.
    const propertyShapeTriples: Triple[] = [];

    for (const [propertyId, group] of byProperty) {
      const path = context.propertyIri(propertyId);
      if (!path) continue;

      const property =
        ontology.attributes.find((e) => e.id === propertyId) ??
        ontology.relations.find((e) => e.id === propertyId);
      if (!property) continue;

      const propertyShape = shapeIri(`${entity.localName}_${property.localName}`);
      triples.push({ subject: nodeShape, predicate: SH_PROPERTY, object: iri(propertyShape) });
      propertyShapeTriples.push(
        { subject: propertyShape, predicate: RDF_TYPE, object: iri(SH_PROPERTY_SHAPE) },
        { subject: propertyShape, predicate: SH_PATH, object: iri(path) },
        { subject: propertyShape, predicate: SH_NAME, object: literal(property.localName) },
      );

      if (context.attributeIds.has(propertyId)) {
        const datatype = ontology.attributes.find((e) => e.id === propertyId);
        if (datatype) {
          propertyShapeTriples.push({
            subject: propertyShape,
            predicate: SH_DATATYPE,
            object: iri(xsdDatatypeIri(datatype.range)),
          });
        }
        continue;
      }

      const targets = [
        ...new Set(
          group
            .map((usage) =>
              usage.objectClassId ? context.classIri.get(usage.objectClassId) : null,
            )
            .filter((value): value is string => Boolean(value)),
        ),
      ];

      if (targets.length === 1) {
        propertyShapeTriples.push({
          subject: propertyShape,
          predicate: SH_CLASS,
          object: iri(targets[0]!),
        });
      } else if (targets.length > 1) {
        // Several target classes on one path: a disjunction, not a conjunction.
        const alternatives = targets.map(
          (_target, position) => `${propertyShape}_alt${position + 1}`,
        );
        let cellNumber = 0;
        const listHead = rdfList(
          alternatives,
          () => {
            cellNumber += 1;
            return `${propertyShape}_or${cellNumber}`;
          },
          propertyShapeTriples,
        );
        propertyShapeTriples.push({
          subject: propertyShape,
          predicate: SH_OR,
          object: iri(listHead),
        });
        targets.forEach((target, position) => {
          propertyShapeTriples.push({
            subject: alternatives[position]!,
            predicate: SH_CLASS,
            object: iri(target),
          });
        });
      }
    }

    triples.push(...propertyShapeTriples);
  }

  return triples;
}

/**
 * Writes an RDF collection and returns its head.
 *
 * The cells come from the caller, which decides whether they are named or blank: SHACL's
 * `sh:or` keeps named cells so every alternative stays addressable, while an OWL union needs
 * blank ones to be read as an expression at all. Whether a cell points at the next one as an
 * IRI or as a blank node follows from the label, which is the whole point of the `_:` form.
 */
function rdfList(members: readonly string[], nextCell: () => string, sink: Triple[]): string {
  if (members.length === 0) return RDF_NIL;

  const cells = members.map(() => nextCell());
  members.forEach((member, position) => {
    const cell = cells[position]!;
    const rest = cells[position + 1] ?? RDF_NIL;
    sink.push({ subject: cell, predicate: RDF_FIRST, object: term(member) });
    sink.push({ subject: cell, predicate: RDF_REST, object: term(rest) });
  });
  return cells[0]!;
}

/** An IRI or a blank node, told apart by the `_:` a blank label always carries. */
const term = (value: string): TripleObject => (isBlankNode(value) ? blank(value) : iri(value));

/** Two identical assertions are one fact; duplicates would only bloat the output. */
function dedupe(triples: readonly Triple[]): Triple[] {
  const seen = new Set<string>();
  const unique: Triple[] = [];
  for (const triple of triples) {
    const key = `${triple.subject}|${triple.predicate}|${triple.object.type}|${triple.object.value}|${
      triple.object.type === 'literal' ? (triple.object.language ?? '') : ''
    }|${triple.object.type === 'literal' ? (triple.object.datatype ?? '') : ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(triple);
  }
  return unique;
}
