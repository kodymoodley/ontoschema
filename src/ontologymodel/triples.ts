import {
  OWL_CLASS,
  OWL_DATATYPE_PROPERTY,
  OWL_OBJECT_PROPERTY,
  OWL_ONTOLOGY,
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
import type { Annotation, Ontology, PropertyUsage } from './types';

/**
 * A minimal, serializer-agnostic RDF term. This is the ONLY thing the serialization layer
 * consumes, which is what guarantees Turtle, RDF/XML and JSON-LD are semantically
 * identical: they are three renderings of one list.
 *
 * Everything here is an IRI or a literal — there are deliberately no blank nodes. Shapes
 * and their `sh:or` lists are named instead, which keeps all three writers simple and
 * makes every shape addressable and annotatable.
 */
export type TripleObject =
  | { type: 'iri'; value: string }
  | { type: 'literal'; value: string; language?: string; datatype?: string };

export interface Triple {
  subject: string;
  predicate: string;
  object: TripleObject;
}

export const iri = (value: string): TripleObject => ({ type: 'iri', value });

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
}

const DEFAULT_OPTIONS: Required<SerializationOptions> = {
  includeAxioms: true,
  includeShapes: true,
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
 *    hierarchies, and `rdfs:domain`/`rdfs:range` *only where they are unambiguous*. A
 *    property used on a single class has a real domain; once reused, RDFS cannot state the
 *    truth (repeating the domain means intersection, a union loses the pairing), so the
 *    axiom is omitted rather than falsified.
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
  const { includeAxioms, includeShapes } = { ...DEFAULT_OPTIONS, ...options };
  const namespace = normalizeNamespaceIri(ontology.iri);
  const subjectOf = (localName: string) => entityIri(namespace, localName);
  const index = indexOntology(ontology);

  const classIri = new Map(ontology.classes.map((e) => [e.id, subjectOf(e.localName)]));
  const objectPropertyIri = new Map(
    ontology.objectProperties.map((e) => [e.id, subjectOf(e.localName)]),
  );
  const datatypePropertyIri = new Map(
    ontology.datatypeProperties.map((e) => [e.id, subjectOf(e.localName)]),
  );
  const propertyIri = (id: string) => objectPropertyIri.get(id) ?? datatypePropertyIri.get(id);

  const triples: Triple[] = [];

  const header = ontologyIri(namespace);
  triples.push({ subject: header, predicate: RDF_TYPE, object: iri(OWL_ONTOLOGY) });
  triples.push(...annotationTriples(header, ontology.annotations));

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

    for (const property of ontology.objectProperties) {
      const subject = objectPropertyIri.get(property.id);
      if (!subject) continue;
      triples.push({ subject, predicate: RDF_TYPE, object: iri(OWL_OBJECT_PROPERTY) });
      triples.push(...annotationTriples(subject, property.annotations));
      for (const parentId of property.superPropertyIds) {
        const parent = objectPropertyIri.get(parentId);
        if (parent && parent !== subject) {
          triples.push({ subject, predicate: RDFS_SUBPROPERTY_OF, object: iri(parent) });
        }
      }

      // Domain and range only when the property is used in exactly one place.
      const usages = index.usagesByProperty.get(property.id) ?? [];
      const only = usages.length === 1 ? usages[0] : undefined;
      if (!only) continue;
      const domain = classIri.get(only.subjectClassId);
      const range = only.objectClassId ? classIri.get(only.objectClassId) : undefined;
      if (domain) triples.push({ subject, predicate: RDFS_DOMAIN, object: iri(domain) });
      if (range) triples.push({ subject, predicate: RDFS_RANGE, object: iri(range) });
    }

    for (const property of ontology.datatypeProperties) {
      const subject = datatypePropertyIri.get(property.id);
      if (!subject) continue;
      triples.push({ subject, predicate: RDF_TYPE, object: iri(OWL_DATATYPE_PROPERTY) });
      triples.push(...annotationTriples(subject, property.annotations));
      for (const parentId of property.superPropertyIds) {
        const parent = datatypePropertyIri.get(parentId);
        if (parent && parent !== subject) {
          triples.push({ subject, predicate: RDFS_SUBPROPERTY_OF, object: iri(parent) });
        }
      }

      // The xsd range is global — `price` is a decimal wherever it is used — so it is
      // always safe. Only the domain depends on how many classes use the property.
      triples.push({
        subject,
        predicate: RDFS_RANGE,
        object: iri(xsdDatatypeIri(property.range)),
      });
      const usages = index.usagesByProperty.get(property.id) ?? [];
      const only = usages.length === 1 ? usages[0] : undefined;
      const domain = only ? classIri.get(only.subjectClassId) : undefined;
      if (domain) triples.push({ subject, predicate: RDFS_DOMAIN, object: iri(domain) });
    }
  }

  if (includeShapes) {
    triples.push(
      ...shapeTriples(ontology, {
        classIri,
        propertyIri,
        datatypePropertyIds: new Set(ontology.datatypeProperties.map((e) => e.id)),
        namespace,
      }),
    );
  }

  return dedupe(triples);
}

interface ShapeContext {
  classIri: Map<string, string>;
  propertyIri: (id: string) => string | undefined;
  datatypePropertyIds: Set<string>;
  namespace: string;
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
  // Seeded with the real entity names so a generated shape can never collide with a class
  // or property that happens to be called `CarShape`.
  const takenNames = new Set([...classLocalNames(ontology), ...propertyLocalNames(ontology)]);

  const shapeIri = (desired: string) => {
    const unique = uniqueLocalName(desired, takenNames);
    takenNames.add(unique);
    return entityIri(context.namespace, unique);
  };

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
        ontology.datatypeProperties.find((e) => e.id === propertyId) ??
        ontology.objectProperties.find((e) => e.id === propertyId);
      if (!property) continue;

      const propertyShape = shapeIri(`${entity.localName}_${property.localName}`);
      triples.push({ subject: nodeShape, predicate: SH_PROPERTY, object: iri(propertyShape) });
      propertyShapeTriples.push(
        { subject: propertyShape, predicate: RDF_TYPE, object: iri(SH_PROPERTY_SHAPE) },
        { subject: propertyShape, predicate: SH_PATH, object: iri(path) },
        { subject: propertyShape, predicate: SH_NAME, object: literal(property.localName) },
      );

      if (context.datatypePropertyIds.has(propertyId)) {
        const datatype = ontology.datatypeProperties.find((e) => e.id === propertyId);
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
        const listHead = rdfList(alternatives, `${propertyShape}_or`, propertyShapeTriples);
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
 * Writes an RDF collection and returns its head. The cells are named rather than blank so
 * that the serializers need no blank-node or collection support of their own.
 */
function rdfList(members: readonly string[], baseIri: string, sink: Triple[]): string {
  if (members.length === 0) return RDF_NIL;
  const head = `${baseIri}1`;
  members.forEach((member, position) => {
    const cell = `${baseIri}${position + 1}`;
    const rest = position + 1 < members.length ? `${baseIri}${position + 2}` : RDF_NIL;
    sink.push({ subject: cell, predicate: RDF_FIRST, object: iri(member) });
    sink.push({ subject: cell, predicate: RDF_REST, object: iri(rest) });
  });
  return head;
}

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
