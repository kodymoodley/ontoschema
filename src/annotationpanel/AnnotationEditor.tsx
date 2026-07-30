import { useState } from 'react';
import {
  ANNOTATION_PREFIX_ORDER,
  ANNOTATION_TERMS,
  ONTOLOGY_ANNOTATION_TERMS,
  SUGGESTED_LANGUAGE_TAGS,
  findAnnotationTerm,
  isValidLanguageTag,
} from '../annotationvocabulary';
import type { AnnotationTerm } from '../annotationvocabulary';
import { findClass, findDatatypeProperty, findObjectProperty } from '../ontologymodel';
import type { Annotation, EntityRef } from '../ontologymodel';
import { useOntology, useProjectStore } from '../projectstore';
import { Button, EmptyState, Select, TextArea, TextInput } from '../designsystem';
import styles from './annotationpanel.module.css';

/**
 * Annotation editing for any selected entity, or for the ontology header.
 *
 * The term list is driven entirely by the vocabulary registry, so adding a term there
 * makes it available here and in every serializer without touching this file. Each term
 * declares how its value behaves, which is what decides whether a language tag applies.
 */

const DEFAULT_TERM = 'rdfs:label';

export function AnnotationEditor({ target }: { target: EntityRef }) {
  const ontology = useOntology();
  const annotate = useProjectStore((state) => state.annotate);
  const editAnnotation = useProjectStore((state) => state.editAnnotation);
  const deleteAnnotation = useProjectStore((state) => state.deleteAnnotation);

  const [newTerm, setNewTerm] = useState(DEFAULT_TERM);

  const annotations = annotationsOf(target);
  const available = target.kind === 'ontology' ? ONTOLOGY_ANNOTATION_TERMS : ANNOTATION_TERMS;

  function annotationsOf(ref: EntityRef): Annotation[] | null {
    switch (ref.kind) {
      case 'ontology':
        return ontology.annotations;
      case 'class':
        return findClass(ontology, ref.id)?.annotations ?? null;
      case 'objectProperty':
        return findObjectProperty(ontology, ref.id)?.annotations ?? null;
      case 'datatypeProperty':
        return findDatatypeProperty(ontology, ref.id)?.annotations ?? null;
    }
  }

  if (annotations === null) return null;

  return (
    <div className={styles.editor}>
      {annotations.length === 0 ? (
        <EmptyState>No annotations yet. Add a label, a definition, or provenance below.</EmptyState>
      ) : (
        annotations.map((annotation) => (
          <AnnotationRow
            key={annotation.id}
            annotation={annotation}
            terms={available}
            onChange={(patch) => editAnnotation(target, annotation.id, patch)}
            onRemove={() => deleteAnnotation(target, annotation.id)}
          />
        ))
      )}

      <div className={styles.addRow}>
        <Select
          value={newTerm}
          aria-label="Annotation term to add"
          onChange={(event) => setNewTerm(event.target.value)}
        >
          <TermOptions terms={available} />
        </Select>
        <Button
          onClick={() => {
            const term = findAnnotationTerm(newTerm);
            annotate(target, newTerm, '', term?.kind === 'text' ? 'en' : undefined);
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function TermOptions({ terms }: { terms: readonly AnnotationTerm[] }) {
  return (
    <>
      {ANNOTATION_PREFIX_ORDER.map((prefix) => {
        const group = terms.filter((term) => term.prefix === prefix);
        if (group.length === 0) return null;
        return (
          <optgroup key={prefix} label={prefix} className={styles.groupLabel}>
            {group.map((term) => (
              <option key={term.curie} value={term.curie}>
                {term.curie} — {term.label}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}

interface AnnotationRowProps {
  annotation: Annotation;
  terms: readonly AnnotationTerm[];
  onChange: (patch: Partial<Pick<Annotation, 'term' | 'value' | 'language'>>) => void;
  onRemove: () => void;
}

function AnnotationRow({ annotation, terms, onChange, onRemove }: AnnotationRowProps) {
  const term = findAnnotationTerm(annotation.term);
  const kind = term?.kind ?? 'text';
  const supportsLanguage = kind === 'text';
  const multiline = kind === 'text' && isLongFormTerm(annotation.term);
  const languageInvalid =
    Boolean(annotation.language) && !isValidLanguageTag(annotation.language ?? '');

  return (
    <div className={styles.annotation} data-annotation-term={annotation.term}>
      <div className={styles.annotationHead}>
        <Select
          className={styles.termSelect}
          value={annotation.term}
          aria-label="Annotation term"
          onChange={(event) => onChange({ term: event.target.value })}
        >
          <TermOptions terms={terms} />
        </Select>
        <button
          type="button"
          className={styles.remove}
          aria-label={`Remove ${annotation.term}`}
          onClick={onRemove}
        >
          ×
        </button>
      </div>

      <div className={styles.valueRow}>
        {multiline ? (
          <TextArea
            value={annotation.value}
            placeholder={term?.hint}
            aria-label={`${annotation.term} value`}
            onChange={(event) => onChange({ value: event.target.value })}
          />
        ) : (
          <TextInput
            value={annotation.value}
            placeholder={term?.hint}
            aria-label={`${annotation.term} value`}
            mono={kind === 'iri'}
            type={kind === 'date' ? 'date' : 'text'}
            onChange={(event) => onChange({ value: event.target.value })}
          />
        )}

        {supportsLanguage ? (
          <TextInput
            className={styles.language}
            value={annotation.language ?? ''}
            placeholder="lang"
            list="ontoschema-language-tags"
            aria-label={`${annotation.term} language tag`}
            invalid={languageInvalid}
            onChange={(event) => onChange({ language: event.target.value })}
          />
        ) : (
          <span className={styles.kindTag}>{kind === 'iri' ? 'IRI' : kind}</span>
        )}
      </div>
    </div>
  );
}

/** Terms whose values are typically a sentence or more get a textarea. */
function isLongFormTerm(curie: string): boolean {
  return [
    'rdfs:comment',
    'dcterms:description',
    'skos:definition',
    'skos:scopeNote',
    'skos:note',
    'skos:example',
    'skos:editorialNote',
    'dcterms:rights',
  ].includes(curie);
}

/** Shared datalist of suggested language tags, mounted once by the app shell. */
export function LanguageTagSuggestions() {
  return (
    <datalist id="ontoschema-language-tags">
      {SUGGESTED_LANGUAGE_TAGS.map((tag) => (
        <option key={tag} value={tag} />
      ))}
    </datalist>
  );
}
