import {
  addAnnotation,
  addAttributeToClass,
  addClass,
  addRelation,
  addSubClassOf,
  attachProperty,
  createEmptyOntology,
} from '../ontologymodel';
import type { Ontology } from '../ontologymodel';
import type { XsdDatatype } from '../annotationvocabulary';

/**
 * Examples are written as data rather than as a script of mutations, so that a domain reads
 * as a domain — a list of classes, what they carry and how they connect — and adding one
 * needs no knowledge of the model API.
 */

/** `[value, languageTag]`, e.g. `['Auto', 'nl']`. */
export type LocalisedText = readonly [string, string];

export interface ClassSpec {
  name: string;
  /** Parent class name, if this one sits under another. */
  parent?: string;
  /** Where it lands on the schema canvas. */
  at: readonly [number, number];
  /** One-line definition, exported as `skos:definition`. */
  definition?: string;
  /** Extra labels, for showing off language tags. */
  labels?: readonly LocalisedText[];
  /** Datatype properties this class carries. */
  attributes?: readonly (readonly [string, XsdDatatype])[];
}

export interface RelationSpec {
  name: string;
  from: string;
  to: string;
  definition?: string;
}

export interface ExampleSpec {
  /** Stable identifier, used by the picker and the tests. */
  key: string;
  title: string;
  /** One or two sentences shown in the picker. */
  summary: string;
  iri: string;
  prefix: string;
  /** Ontology-level annotations, as `[term, value, language?]`. */
  metadata?: readonly (readonly [string, string, string?])[];
  classes: readonly ClassSpec[];
  relations: readonly RelationSpec[];
  /**
   * Object properties declared but not drawn anywhere — they sit in the property list ready
   * to be used, which is the quickest way to see what an unused property looks like.
   */
  spareProperties?: readonly (readonly [string, string])[];
}

export interface Example extends ExampleSpec {
  build(): Ontology;
}

/**
 * Turns a spec into an ontology through the ordinary mutation API, so an example can only
 * ever be a state the editor could have produced by hand.
 */
export function buildExample(spec: ExampleSpec): Ontology {
  let ontology = createEmptyOntology(spec.iri, spec.prefix);

  for (const [term, value, language] of spec.metadata ?? []) {
    ontology = addAnnotation(ontology, 'ontology', '', term, value, language);
  }

  const classIds = new Map<string, string>();
  for (const entry of spec.classes) {
    const added = addClass(ontology, {
      localName: entry.name,
      position: { x: entry.at[0], y: entry.at[1] },
    });
    ontology = added.ontology;
    classIds.set(entry.name, added.id);
  }

  // Parents in a second pass, so a class may be declared before the one it sits under.
  for (const entry of spec.classes) {
    const child = classIds.get(entry.name);
    const parent = entry.parent ? classIds.get(entry.parent) : undefined;
    if (child && parent) ontology = addSubClassOf(ontology, child, parent);
  }

  for (const entry of spec.classes) {
    const classId = classIds.get(entry.name);
    if (!classId) continue;

    if (entry.definition) {
      ontology = addAnnotation(
        ontology,
        'class',
        classId,
        'skos:definition',
        entry.definition,
        'en',
      );
    }
    for (const [value, language] of entry.labels ?? []) {
      ontology = addAnnotation(ontology, 'class', classId, 'skos:prefLabel', value, language);
    }
    for (const [localName, range] of entry.attributes ?? []) {
      ontology = addAttributeToClass(ontology, { classId, localName, range }).ontology;
    }
  }

  /*
   * A relation drawn more than once reuses the same property, which is the whole point of
   * the usage model — and the shortest way to see why a reused property loses its
   * `rdfs:domain` but keeps a SHACL shape per class.
   */
  const propertyIds = new Map<string, string>();
  for (const relation of spec.relations) {
    let propertyId = propertyIds.get(relation.name);
    if (!propertyId) {
      const added = addRelation(ontology, { localName: relation.name });
      ontology = added.ontology;
      propertyId = added.id;
      propertyIds.set(relation.name, propertyId);
      if (relation.definition) {
        ontology = addAnnotation(
          ontology,
          'relation',
          propertyId,
          'skos:definition',
          relation.definition,
          'en',
        );
      }
    }

    const subject = classIds.get(relation.from);
    const object = classIds.get(relation.to);
    if (!subject || !object) continue;
    ontology = attachProperty(ontology, {
      propertyId,
      subjectClassId: subject,
      objectClassId: object,
    }).ontology;
  }

  for (const [name, definition] of spec.spareProperties ?? []) {
    const added = addRelation(ontology, { localName: name });
    ontology = addAnnotation(
      added.ontology,
      'relation',
      added.id,
      'skos:definition',
      definition,
      'en',
    );
  }

  return ontology;
}

export function asExample(spec: ExampleSpec): Example {
  return { ...spec, build: () => buildExample(spec) };
}

/** Headline numbers for the picker, computed from the spec rather than a built ontology. */
export function exampleSize(spec: ExampleSpec): {
  classes: number;
  relations: number;
  attributes: number;
} {
  return {
    classes: spec.classes.length,
    relations:
      new Set(spec.relations.map((relation) => relation.name)).size +
      (spec.spareProperties?.length ?? 0),
    attributes: spec.classes.reduce((total, entry) => total + (entry.attributes?.length ?? 0), 0),
  };
}
