import {
  addAnnotation,
  addAttributeToClass,
  addClass,
  addObjectProperty,
  addRelationBetween,
  addSubClassOf,
  attachProperty,
  createEmptyOntology,
  createId,
  setSuperObjectProperty,
} from '../../src/ontologymodel';
import type { Ontology } from '../../src/ontologymodel';

/**
 * Ontology shapes the tidy Car/Dealership fixture never reaches.
 *
 * Each one exists because some part of the system behaves differently on it: dagre on a
 * deep tree, the forest builder on a diamond, `sh:or` on a property with several ranges,
 * the three writers on scripts and escapes, `uniqueLocalName` on names that collide once
 * sanitised, the derivation indexes at scale, and every defensive branch on a document that
 * has been corrupted.
 */

export interface Scenario {
  name: string;
  ontology: Ontology;
}

/* ------------------------------------------------------------ deep and wide */

/**
 * Eight levels of subclass with siblings at each, which is where a naive recursive forest
 * builder or an unbounded layout starts to misbehave.
 */
export function buildDeepTaxonomy(depth = 8, siblings = 3): Ontology {
  let ontology = createEmptyOntology('https://example.org/deep/', 'deep');
  const root = addClass(ontology, { localName: 'Thing' });
  ontology = root.ontology;

  let parents = [root.id];
  for (let level = 1; level <= depth; level += 1) {
    const next: string[] = [];
    for (const parent of parents) {
      for (let index = 0; index < siblings; index += 1) {
        const child = addClass(ontology, { localName: `L${level}N${next.length}` });
        ontology = addSubClassOf(child.ontology, child.id, parent);
        next.push(child.id);
      }
      // Only the first branch keeps fanning out, or the fixture explodes exponentially.
      break;
    }
    parents = next.slice(0, 1);
    if (parents.length === 0) break;
  }

  return ontology;
}

/* -------------------------------------------------------------- the diamond */

/**
 * `AmphibiousCar` inherits from both `Car` and `Boat`, which share `Vehicle`. The class is
 * reachable from one root by two paths, so anything that walks the hierarchy has to cope
 * with meeting it twice.
 */
export function buildDiamond(): { ontology: Ontology; ids: Record<string, string> } {
  let ontology = createEmptyOntology('https://example.org/diamond/', 'dia');
  const ids: Record<string, string> = {};

  for (const localName of ['Vehicle', 'Car', 'Boat', 'AmphibiousCar', 'Unrelated']) {
    const added = addClass(ontology, { localName });
    ontology = added.ontology;
    ids[localName] = added.id;
  }

  ontology = addSubClassOf(ontology, ids.Car!, ids.Vehicle!);
  ontology = addSubClassOf(ontology, ids.Boat!, ids.Vehicle!);
  ontology = addSubClassOf(ontology, ids.AmphibiousCar!, ids.Car!);
  ontology = addSubClassOf(ontology, ids.AmphibiousCar!, ids.Boat!);

  const wheels = addAttributeToClass(ontology, {
    classId: ids.AmphibiousCar!,
    localName: 'wheelCount',
    range: 'integer',
  });
  ontology = wheels.ontology;

  return { ontology, ids };
}

/* ------------------------------------------- one property, several ranges */

/**
 * `hasPart` used three times from `Car` and once from `Bicycle`. The three on `Car` must
 * collapse into a single property shape with `sh:or`, because separate shapes on one path
 * are conjunctive and would demand every part be a wheel *and* a door *and* an engine.
 */
export function buildMultiTarget(): { ontology: Ontology; ids: Record<string, string> } {
  let ontology = createEmptyOntology('https://example.org/parts/', 'part');
  const ids: Record<string, string> = {};

  for (const localName of ['Car', 'Bicycle', 'Wheel', 'Door', 'Engine']) {
    const added = addClass(ontology, { localName });
    ontology = added.ontology;
    ids[localName] = added.id;
  }

  const hasPart = addObjectProperty(ontology, { localName: 'hasPart' });
  ontology = hasPart.ontology;
  ids.hasPart = hasPart.id;

  for (const target of ['Wheel', 'Door', 'Engine']) {
    ontology = attachProperty(ontology, {
      propertyId: hasPart.id,
      subjectClassId: ids.Car!,
      objectClassId: ids[target]!,
    }).ontology;
  }
  // A second class using the same property with a single target, so both branches appear.
  ontology = attachProperty(ontology, {
    propertyId: hasPart.id,
    subjectClassId: ids.Bicycle!,
    objectClassId: ids.Wheel!,
  }).ontology;

  return { ontology, ids };
}

/* --------------------------------------------------------------- languages */

/** Every escaping and language-tag hazard the three writers have to survive. */
export const AWKWARD_TEXT = {
  markup: 'A <heavy> "goods" vehicle & trailer',
  newlines: 'First line\nSecond line\tand a tab',
  quotes: 'She said "hello" and \'goodbye\'',
  unicode: 'Zürich — naïve café 汉字 עברית العربية 🚗',
  long: 'x'.repeat(2_000),
} as const;

export function buildMultilingual(): { ontology: Ontology; ids: Record<string, string> } {
  let ontology = createEmptyOntology('https://example.org/i18n/', 'i18n');
  const car = addClass(ontology, { localName: 'Car' });
  ontology = car.ontology;

  const labels: [string, string][] = [
    ['Car', 'en'],
    ['Auto', 'nl'],
    ['Wagen', 'de'],
    ['Voiture', 'fr'],
    ['سيارة', 'ar'],
    ['מכונית', 'he'],
    ['汽車', 'zh-Hant-TW'],
    ['車', 'ja'],
    ['Lorry', 'en-GB'],
  ];
  for (const [value, language] of labels) {
    ontology = addAnnotation(ontology, 'class', car.id, 'skos:altLabel', value, language);
  }

  for (const [key, value] of Object.entries(AWKWARD_TEXT)) {
    ontology = addAnnotation(ontology, 'class', car.id, 'skos:note', value, 'en');
    void key;
  }

  // An IRI-valued annotation carrying characters that must be escaped in XML.
  ontology = addAnnotation(
    ontology,
    'class',
    car.id,
    'rdfs:seeAlso',
    'https://example.org/lookup?make=man&model=tgx#anchor',
  );

  return { ontology, ids: { car: car.id } };
}

/* ----------------------------------------------------------------- naming */

/**
 * Names that collide once sanitised, names that shadow a generated shape, and names drawn
 * from RDF's own vocabulary. Nothing here may produce a duplicate IRI.
 */
export function buildAdversarialNames(): Ontology {
  let ontology = createEmptyOntology('https://example.org/edge/', 'edge');

  const wanted = [
    'Used Car', // -> UsedCar
    'used car', // collides with the above
    'used_car', // and again
    'UsedCar', // and again, exactly
    'CarShape', // shadows the node shape generated for a class called Car
    'Car',
    'type', // rdf:type's local name
    'first', // rdf:first
    'nil', // rdf:nil
    '3Series', // must not start with a digit
    '_private',
    'A'.repeat(120), // very long
  ];
  for (const localName of wanted) {
    ontology = addClass(ontology, { localName }).ontology;
  }

  const car = ontology.classes.find((entity) => entity.localName === 'Car');
  if (car) {
    ontology = addAttributeToClass(ontology, { classId: car.id, localName: 'label' }).ontology;
    ontology = addAttributeToClass(ontology, { classId: car.id, localName: 'Label' }).ontology;
  }

  return ontology;
}

/* ------------------------------------------------------ property hierarchy */

/** Sub-property chains, which the tidy fixture never exercises. */
export function buildPropertyHierarchy(): { ontology: Ontology; ids: Record<string, string> } {
  let ontology = createEmptyOntology('https://example.org/props/', 'p');
  const ids: Record<string, string> = {};

  for (const localName of ['Agent', 'Person', 'Organization']) {
    const added = addClass(ontology, { localName });
    ontology = added.ontology;
    ids[localName] = added.id;
  }
  ontology = addSubClassOf(ontology, ids.Person!, ids.Agent!);
  ontology = addSubClassOf(ontology, ids.Organization!, ids.Agent!);

  const related = addObjectProperty(ontology, { localName: 'isRelatedTo' });
  ontology = related.ontology;
  const knows = addRelationBetween(ontology, {
    localName: 'knows',
    subjectClassId: ids.Person!,
    objectClassId: ids.Person!,
  });
  ontology = knows.ontology;
  const employs = addRelationBetween(ontology, {
    localName: 'employs',
    subjectClassId: ids.Organization!,
    objectClassId: ids.Person!,
  });
  ontology = employs.ontology;

  ontology = setSuperObjectProperty(ontology, knows.propertyId, related.id);
  ontology = setSuperObjectProperty(ontology, employs.propertyId, related.id);

  ids.isRelatedTo = related.id;
  ids.knows = knows.propertyId;
  ids.employs = employs.propertyId;
  return { ontology, ids };
}

/* ------------------------------------------------------------------ scale */

/** A schema far larger than anything hand-built, for the derivation and layout paths. */
export function buildLarge(classCount = 200): Ontology {
  let ontology = createEmptyOntology('https://example.org/big/', 'big');
  const classIds: string[] = [];

  for (let index = 0; index < classCount; index += 1) {
    const added = addClass(ontology, { localName: `Class${index}` });
    ontology = added.ontology;
    classIds.push(added.id);
    // A broad, shallow forest: every tenth class starts a new root.
    if (index % 10 !== 0) {
      ontology = addSubClassOf(ontology, added.id, classIds[index - (index % 10)]!);
    }
  }

  for (let index = 0; index < classCount; index += 1) {
    ontology = addAttributeToClass(ontology, {
      classId: classIds[index]!,
      localName: `field${index}`,
      range: index % 2 === 0 ? 'string' : 'integer',
    }).ontology;

    if (index + 1 < classCount) {
      ontology = addRelationBetween(ontology, {
        localName: `links${index}`,
        subjectClassId: classIds[index]!,
        objectClassId: classIds[index + 1]!,
      }).ontology;
    }
  }

  return ontology;
}

/* ------------------------------------------------------------- degenerate */

/**
 * A document that a hand-edited project file or an older version could produce: a relation
 * pointing at its own class, usages referring to entities that no longer exist, and a
 * subclass link to a deleted parent. Built by hand precisely because the mutation API
 * refuses to create it.
 */
export function buildDegenerate(): { ontology: Ontology; ids: Record<string, string> } {
  const base = createEmptyOntology('https://example.org/broken/', 'bad');
  const car = addClass(base, { localName: 'Car' });
  const withProperty = addObjectProperty(car.ontology, { localName: 'sameAs' });
  const attached = attachProperty(withProperty.ontology, {
    propertyId: withProperty.id,
    subjectClassId: car.id,
    objectClassId: car.id,
  });

  const ontology: Ontology = {
    ...attached.ontology,
    classes: attached.ontology.classes.map((entity) => ({
      ...entity,
      superClassIds: ['class_deleted'],
    })),
    usages: [
      ...attached.ontology.usages,
      { id: createId('use'), propertyId: 'gone', subjectClassId: car.id, objectClassId: null },
      {
        id: createId('use'),
        propertyId: withProperty.id,
        subjectClassId: 'class_gone',
        objectClassId: car.id,
      },
      {
        id: createId('use'),
        propertyId: withProperty.id,
        subjectClassId: car.id,
        objectClassId: 'class_gone',
      },
    ],
  };

  return { ontology, ids: { car: car.id, sameAs: withProperty.id } };
}

/* ----------------------------------------------------------------- the set */

export function allScenarios(): Scenario[] {
  return [
    { name: 'deep taxonomy', ontology: buildDeepTaxonomy() },
    { name: 'diamond inheritance', ontology: buildDiamond().ontology },
    { name: 'one property, several ranges', ontology: buildMultiTarget().ontology },
    { name: 'many languages and escapes', ontology: buildMultilingual().ontology },
    { name: 'adversarial names', ontology: buildAdversarialNames() },
    { name: 'property hierarchy', ontology: buildPropertyHierarchy().ontology },
    { name: 'degenerate document', ontology: buildDegenerate().ontology },
  ];
}

/* ------------------------------------------------------- seeded randomness */

/**
 * mulberry32: small, fast and deterministic. A fuzzed editing session has to be replayable
 * from its seed, or a failure is just noise.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(random: () => number, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(random() * items.length)];
}
