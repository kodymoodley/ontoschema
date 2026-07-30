import { describe, expect, it } from 'vitest';
import { buildAutoOntology } from '../../tests/fixtures/autoOntology';
import {
  OWL_CLASS,
  OWL_DATATYPE_PROPERTY,
  OWL_OBJECT_PROPERTY,
  OWL_ONTOLOGY,
  RDFS_DOMAIN,
  RDFS_RANGE,
  RDFS_SUBCLASS_OF,
  RDF_TYPE,
} from '../annotationvocabulary';
import { addAnnotation, addClass, addObjectProperty, updateAnnotation } from './mutations';
import { createEmptyOntology } from './ontology';
import { ontologyToTriples } from './triples';
import type { Triple } from './triples';

const AUTO = 'https://example.org/auto/';

function has(
  triples: Triple[],
  subject: string,
  predicate: string,
  object: Partial<Triple['object']>,
): boolean {
  return triples.some(
    (triple) =>
      triple.subject === subject &&
      triple.predicate === predicate &&
      Object.entries(object).every(
        ([key, value]) => (triple.object as Record<string, unknown>)[key] === value,
      ),
  );
}

describe('ontologyToTriples', () => {
  const { ontology } = buildAutoOntology();
  const triples = ontologyToTriples(ontology);

  it('declares the ontology header at the namespace IRI without its terminator', () => {
    expect(has(triples, 'https://example.org/auto', RDF_TYPE, { value: OWL_ONTOLOGY })).toBe(true);
  });

  it('types classes, object properties and datatype properties', () => {
    expect(has(triples, `${AUTO}Car`, RDF_TYPE, { value: OWL_CLASS })).toBe(true);
    expect(has(triples, `${AUTO}offeredBy`, RDF_TYPE, { value: OWL_OBJECT_PROPERTY })).toBe(true);
    expect(has(triples, `${AUTO}price`, RDF_TYPE, { value: OWL_DATATYPE_PROPERTY })).toBe(true);
  });

  it('writes the subclass hierarchy', () => {
    expect(has(triples, `${AUTO}Car`, RDFS_SUBCLASS_OF, { value: `${AUTO}Vehicle` })).toBe(true);
    expect(has(triples, `${AUTO}Truck`, RDFS_SUBCLASS_OF, { value: `${AUTO}Vehicle` })).toBe(true);
    expect(
      has(triples, `${AUTO}Dealership`, RDFS_SUBCLASS_OF, { value: `${AUTO}Organization` }),
    ).toBe(true);
  });

  it('takes domain and range from the direction of a scoped relation', () => {
    expect(has(triples, `${AUTO}offeredBy`, RDFS_DOMAIN, { value: `${AUTO}Car` })).toBe(true);
    expect(has(triples, `${AUTO}offeredBy`, RDFS_RANGE, { value: `${AUTO}Dealership` })).toBe(true);
  });

  it('leaves a generic object property without domain or range', () => {
    expect(has(triples, `${AUTO}hasPart`, RDF_TYPE, { value: OWL_OBJECT_PROPERTY })).toBe(true);
    expect(triples.some((t) => t.subject === `${AUTO}hasPart` && t.predicate === RDFS_DOMAIN)).toBe(
      false,
    );
    expect(triples.some((t) => t.subject === `${AUTO}hasPart` && t.predicate === RDFS_RANGE)).toBe(
      false,
    );
  });

  it('gives each attribute an xsd range and its class as domain', () => {
    expect(
      has(triples, `${AUTO}year`, RDFS_RANGE, {
        value: 'http://www.w3.org/2001/XMLSchema#integer',
      }),
    ).toBe(true);
    expect(
      has(triples, `${AUTO}price`, RDFS_RANGE, {
        value: 'http://www.w3.org/2001/XMLSchema#decimal',
      }),
    ).toBe(true);
    expect(has(triples, `${AUTO}make`, RDFS_DOMAIN, { value: `${AUTO}Car` })).toBe(true);
  });

  it('carries language tags through onto text annotations', () => {
    const labels = triples.filter(
      (triple) =>
        triple.subject === `${AUTO}Car` &&
        triple.predicate === 'http://www.w3.org/2004/02/skos/core#prefLabel',
    );
    expect(labels).toHaveLength(2);
    expect(labels.map((t) => t.object.type === 'literal' && t.object.language).sort()).toEqual([
      'en',
      'nl',
    ]);
  });

  it('writes a date annotation as an xsd:date literal, not a plain string', () => {
    const created = triples.find((t) => t.predicate === 'http://purl.org/dc/terms/created');
    expect(created?.object).toMatchObject({
      type: 'literal',
      value: '2026-07-30',
      datatype: 'http://www.w3.org/2001/XMLSchema#date',
    });
  });

  it('writes an IRI-valued annotation as an IRI, not a literal', () => {
    const license = triples.find((t) => t.predicate === 'http://purl.org/dc/terms/license');
    expect(license?.object).toEqual({
      type: 'iri',
      value: 'https://creativecommons.org/licenses/by/4.0/',
    });
  });

  it('writes a non-IRI value for an IRI-kind term as a literal rather than a broken IRI', () => {
    const withText = addAnnotation(
      ontology,
      'class',
      ontology.classes[0]?.id ?? '',
      'rdfs:seeAlso',
      'see the manual',
    );
    const seeAlso = ontologyToTriples(withText).find(
      (t) => t.predicate === 'http://www.w3.org/2000/01/rdf-schema#seeAlso',
    );
    expect(seeAlso?.object).toEqual({ type: 'literal', value: 'see the manual' });
  });

  it('skips blank annotation values instead of emitting empty literals', () => {
    const withBlank = addAnnotation(
      ontology,
      'class',
      ontology.classes[0]?.id ?? '',
      'rdfs:comment',
      '   ',
    );
    expect(ontologyToTriples(withBlank)).toHaveLength(triples.length);
  });

  it('never emits duplicate triples', () => {
    const keys = triples.map(
      (t) =>
        `${t.subject}|${t.predicate}|${t.object.value}|${
          t.object.type === 'literal' ? (t.object.language ?? '') : ''
        }`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('follows a rename in the emitted IRIs', () => {
    const { ontology: base, ids } = buildAutoOntology();
    const renamed = {
      ...base,
      classes: base.classes.map((c) => (c.id === ids.car ? { ...c, localName: 'Automobile' } : c)),
    };
    const after = ontologyToTriples(renamed);
    expect(after.some((t) => t.subject === `${AUTO}Car`)).toBe(false);
    expect(has(after, `${AUTO}offeredBy`, RDFS_DOMAIN, { value: `${AUTO}Automobile` })).toBe(true);
  });
});

describe('edge cases', () => {
  it('an empty ontology still declares its header', () => {
    const triples = ontologyToTriples(createEmptyOntology('https://example.org/blank/', 'blank'));
    expect(triples).toHaveLength(1);
    expect(triples[0]?.predicate).toBe(RDF_TYPE);
    expect(triples[0]?.object.value).toBe(OWL_ONTOLOGY);
  });

  it('a half-drawn relation emits only the endpoint it has', () => {
    const withClass = addClass(createEmptyOntology('https://example.org/x/', 'x'), {
      localName: 'Car',
    });
    const dangling = addObjectProperty(withClass.ontology, {
      localName: 'offeredBy',
      kind: 'scoped',
      domainClassId: withClass.id,
      rangeClassId: null,
    });
    const triples = ontologyToTriples(dangling.ontology);
    expect(
      has(triples, 'https://example.org/x/offeredBy', RDFS_DOMAIN, {
        value: 'https://example.org/x/Car',
      }),
    ).toBe(true);
    expect(
      triples.some(
        (t) => t.subject === 'https://example.org/x/offeredBy' && t.predicate === RDFS_RANGE,
      ),
    ).toBe(false);
  });

  it('drops a language tag that is not a well-formed BCP 47 tag', () => {
    const { ontology, ids } = buildAutoOntology();
    const annotationId = ontology.classes.find((c) => c.id === ids.car)?.annotations[0]?.id ?? '';
    const broken = {
      ...ontology,
      classes: ontology.classes.map((c) =>
        c.id === ids.car
          ? {
              ...c,
              annotations: c.annotations.map((a) =>
                a.id === annotationId ? { ...a, language: 'not a tag!' } : a,
              ),
            }
          : c,
      ),
    };
    const label = ontologyToTriples(broken).find(
      (t) =>
        t.subject === `${AUTO}Car` &&
        t.predicate === 'http://www.w3.org/2004/02/skos/core#prefLabel' &&
        t.object.value === 'Car',
    );
    expect(label?.object).toEqual({ type: 'literal', value: 'Car' });
  });

  it('an unattached attribute still declares its type and range', () => {
    const { ontology, ids } = buildAutoOntology();
    const detached = {
      ...ontology,
      datatypeProperties: ontology.datatypeProperties.map((p) =>
        p.id === ids.make ? { ...p, domainClassId: null } : p,
      ),
    };
    const triples = ontologyToTriples(detached);
    expect(has(triples, `${AUTO}make`, RDF_TYPE, { value: OWL_DATATYPE_PROPERTY })).toBe(true);
    expect(triples.some((t) => t.subject === `${AUTO}make` && t.predicate === RDFS_DOMAIN)).toBe(
      false,
    );
  });

  it('normalises a base IRI that lacks a terminator', () => {
    const ontology = createEmptyOntology('https://example.org/auto', 'auto');
    const withClass = addClass(ontology, { localName: 'Car' });
    const triples = ontologyToTriples(withClass.ontology);
    expect(triples.some((t) => t.subject === 'https://example.org/auto#Car')).toBe(true);
  });

  it('ignores an annotation whose term is not in the vocabulary', () => {
    const { ontology, ids } = buildAutoOntology();
    const annotated = addAnnotation(ontology, 'class', ids.truck, 'rdfs:label', 'Truck');
    const id = annotated.classes.find((c) => c.id === ids.truck)?.annotations[0]?.id ?? '';
    const bogus = updateAnnotation(annotated, 'class', ids.truck, id, { term: 'nope:whatever' });
    expect(
      ontologyToTriples(bogus).some(
        (t) => t.object.type === 'literal' && t.object.value === 'Truck',
      ),
    ).toBe(false);
  });
});
