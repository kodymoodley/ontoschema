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

/**
 * The prose every term carries, and what each field is for.
 *
 * The four are the inspector's Documentation section, and an example schema fills all of them:
 * these exist to be opened and read, and a panel of empty boxes teaches nothing about what
 * belongs in them. They are also what makes an export worth looking at — the same four terms
 * are what a published vocabulary is expected to carry.
 *
 * `label` is derived from the local name unless it is given, because that is what a person
 * types: `trackTitle` becomes `Track title`. It is worth stating only where the rule gets it
 * wrong, which is initialisms — `isrc` is `ISRC`, not `Isrc`.
 */
export interface Documented {
  /** `rdfs:label`. Omit to derive it from the name. */
  label?: string;
  /** `skos:definition`: what the term means, in a sentence. */
  definition: string;
  /** `rdfs:comment`: the modelling note — why it is here, or what it deliberately excludes. */
  comment: string;
  /** `skos:example`: a concrete instance or value, never a restatement of the definition. */
  example: string;
}

export interface AttributeSpec extends Documented {
  name: string;
  range: XsdDatatype;
}

export interface ClassSpec extends Documented {
  name: string;
  /** Parent class name, if this one sits under another. */
  parent?: string;
  /** Where it lands on the schema canvas. */
  at: readonly [number, number];
  /** Extra labels, for showing off language tags. */
  labels?: readonly LocalisedText[];
  /** Attributes this class carries. */
  attributes?: readonly AttributeSpec[];
}

/**
 * One drawing of a relation. A property drawn between several pairs of classes is written once
 * per pair, and only the first needs the prose: they are the same property throughout.
 */
export interface RelationSpec extends Partial<Documented> {
  name: string;
  from: string;
  to: string;
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
   * Relations declared but not drawn anywhere — they sit in the property list ready
   * to be used, which is the quickest way to see what an unused property looks like.
   */
  spareProperties?: readonly (Documented & { name: string })[];
}

export interface Example extends ExampleSpec {
  build(): Ontology;
}

/**
 * The human-readable form of a local name: `trackTitle` becomes `Track title`.
 *
 * Splitting on the case change is the whole rule, because the names here are camelCase by
 * construction — the editor's own validator sees to that. Runs of capitals are left whole, so
 * an initialism written as one survives as one.
 */
export function readableName(localName: string): string {
  const words = localName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    // Sentence case, so `isSoldOut` reads as "Is sold out" rather than as a headline. A word
    // that is already all capitals is an initialism and keeps its shape: `ISRC`, not `Isrc`.
    .map((word) => (word === word.toUpperCase() && /[A-Z]/.test(word) ? word : word.toLowerCase()));
  const sentence = words.join(' ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** Writes the four Documentation fields onto one term. */
function document(
  ontology: Ontology,
  owner: 'class' | 'relation' | 'attribute',
  ownerId: string,
  name: string,
  prose: Partial<Documented>,
): Ontology {
  let next = addAnnotation(
    ontology,
    owner,
    ownerId,
    'rdfs:label',
    prose.label ?? readableName(name),
    'en',
  );
  for (const [term, value] of [
    ['skos:definition', prose.definition],
    ['rdfs:comment', prose.comment],
    ['skos:example', prose.example],
  ] as const) {
    if (value) next = addAnnotation(next, owner, ownerId, term, value, 'en');
  }
  return next;
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

    ontology = document(ontology, 'class', classId, entry.name, entry);
    for (const [value, language] of entry.labels ?? []) {
      ontology = addAnnotation(ontology, 'class', classId, 'skos:prefLabel', value, language);
    }
    for (const attribute of entry.attributes ?? []) {
      const added = addAttributeToClass(ontology, {
        classId,
        localName: attribute.name,
        range: attribute.range,
      });
      ontology = document(added.ontology, 'attribute', added.propertyId, attribute.name, attribute);
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
      ontology = document(ontology, 'relation', propertyId, relation.name, relation);
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

  for (const spare of spec.spareProperties ?? []) {
    const added = addRelation(ontology, { localName: spare.name });
    ontology = document(added.ontology, 'relation', added.id, spare.name, spare);
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
