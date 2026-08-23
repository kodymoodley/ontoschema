import { useState } from 'react';
import {
  ANNOTATION_PREFIX_ORDER,
  ANNOTATION_TERMS,
  ONTOLOGY_ANNOTATION_TERMS,
  findAnnotationTerm,
} from '../annotationvocabulary';
import type { AnnotationTerm } from '../annotationvocabulary';
import type { Annotation, EntityRef } from '../ontologymodel';
import { useOntology, useProjectStore } from '../projectstore';
import { Button, EmptyState, Select, TextArea, TextInput } from '../designsystem';
import { annotationsOf } from './annotated';
import { LanguageOptions } from './LanguageOptions';
import { isNamedTerm, unnamedAnnotations } from './namedfields';
import type { NamedField } from './namedfields';
import styles from './annotationpanel.module.css';

/**
 * Every annotation the form above does not have a box for, and the way to add any term at all.
 *
 * The term list is driven entirely by the vocabulary registry, so adding a term there
 * makes it available here and in every serializer without touching this file. Each term
 * declares how its value behaves, which is what decides whether a language tag applies.
 *
 * What it shows is what the named fields leave: every term without a field of its own, and the
 * second and later values of the terms that have one. Nothing is unreachable — an entity with
 * three examples shows the first in its Example box and the other two here.
 */

interface EditorProps {
  target: EntityRef;
  /** The fields drawn above this, whose values it should not show a second time. */
  fields: readonly NamedField[];
}

export function AnnotationEditor({ target, fields }: EditorProps) {
  const ontology = useOntology();
  const annotate = useProjectStore((state) => state.annotate);
  const editAnnotation = useProjectStore((state) => state.editAnnotation);
  const deleteAnnotation = useProjectStore((state) => state.deleteAnnotation);

  /*
   * Held as null until something is chosen, because what this list offers depends on the
   * target and on what has already been written: the ontology takes a different set of terms,
   * and a term with a field of its own is dropped from the list until it is already in use.
   * A constant default meant the select could show one term while Add added another.
   */
  const [chosen, setChosen] = useState<string | null>(null);

  const all = annotationsOf(ontology, target);
  const available = target.kind === 'ontology' ? ONTOLOGY_ANNOTATION_TERMS : ANNOTATION_TERMS;

  if (all === null) return null;
  const annotations = unnamedAnnotations(all, fields);

  /*
   * A term with a field of its own is offered here only once it is already in use, because then
   * adding it means adding *another* one — a second example, a second label — and this is where
   * those live. Offered while unused, it would create a row that vanished as it appeared: the
   * field above would claim it, and the Add button would look broken.
   */
  const addable = available.filter(
    (term) =>
      !isNamedTerm(term.curie, fields) || all.some((existing) => existing.term === term.curie),
  );
  // Whatever was chosen, as long as it is still on offer; otherwise whatever the list opens on.
  const newTerm =
    (chosen && addable.some((term) => term.curie === chosen) ? chosen : undefined) ??
    addable[0]?.curie ??
    '';

  return (
    <div className={styles.editor}>
      {annotations.length === 0 ? (
        <EmptyState>
          Nothing here. This is where the rest of the vocabulary lives — alternative labels, scope
          notes, provenance, and anything written more than once.
        </EmptyState>
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
          onChange={(event) => setChosen(event.target.value)}
        >
          <TermOptions terms={addable} />
        </Select>
        {/*
          Named for what it adds, not just "Add". The inspector is one panel now, so this button
          and the one that adds an attribute are on screen together, and two controls answering
          to one name is a problem for anyone reaching them by name.
        */}
        <Button
          aria-label="Add annotation"
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
          <Select
            className={styles.language}
            value={annotation.language ?? ''}
            aria-label={`${annotation.term} language tag`}
            onChange={(event) => onChange({ language: event.target.value })}
          >
            <LanguageOptions />
          </Select>
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
