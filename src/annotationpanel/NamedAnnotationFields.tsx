import { useState } from 'react';
import { findAnnotationTerm } from '../annotationvocabulary';
import type { Annotation, EntityRef } from '../ontologymodel';
import { useOntology, useProjectStore, useShowTerms } from '../projectstore';
import { Field, Select, Switch, TextArea, TextInput } from '../designsystem';
import { annotationsOf } from './annotated';
import { LanguageOptions } from './LanguageOptions';
import { namedValue } from './namedfields';
import type { NamedField } from './namedfields';

import styles from './annotationpanel.module.css';

/**
 * The annotations that have earned a labelled box, edited as an ordinary form.
 *
 * Everything here writes the same annotations the list behind "Other properties" writes; the
 * difference is that nobody has to know a term to fill one in. What the form holds, in what
 * order and under what labels, is `namedfields.ts` — this file is only how it is drawn.
 *
 * A field with nothing in it is not an annotation. Typing into an empty field creates one and
 * emptying a field removes it, rather than leaving `dcterms:title ""` behind to be exported: an
 * empty literal is a claim that the title is the empty string, which is not what an untouched
 * box means.
 */

interface Props {
  target: EntityRef;
  fields: readonly NamedField[];
}

export function NamedAnnotationFields({ target, fields }: Props) {
  const ontology = useOntology();
  const annotations = annotationsOf(ontology, target);
  if (!annotations) return null;

  return (
    <div className={styles.namedFields}>
      {fields.map((field) => (
        <NamedAnnotationField
          key={field.term}
          target={target}
          field={field}
          current={namedValue(annotations, field.term)}
        />
      ))}
    </div>
  );
}

interface FieldProps {
  target: EntityRef;
  field: NamedField;
  current: Annotation | undefined;
}

function NamedAnnotationField({ target, field, current }: FieldProps) {
  const annotate = useProjectStore((state) => state.annotate);
  const editAnnotation = useProjectStore((state) => state.editAnnotation);
  const deleteAnnotation = useProjectStore((state) => state.deleteAnnotation);
  const showTerms = useShowTerms();

  const term = findAnnotationTerm(field.term);
  const takesLanguage = term?.kind === 'text';
  // Offered where the form says it is prose, and wherever a tag has already been written.
  const offerLanguage = takesLanguage && (field.language === true || current?.language);
  const value = current?.value ?? '';

  const write = (next: string) => {
    if (current && next === '') deleteAnnotation(target, current.id);
    else if (current) editAnnotation(target, current.id, { value: next });
    else if (next !== '') annotate(target, field.term, next, takesLanguage ? 'en' : undefined);
  };

  /* The term as it is written, in a chip: a CURIE is case-sensitive and labels here are not. */
  const label = showTerms ? (
    <>
      {field.label} <code>{field.term}</code>
    </>
  ) : (
    field.label
  );

  if (field.control === 'boolean') {
    return (
      <Switch
        checked={value === 'true'}
        label={showTerms ? `${field.label} (${field.term})` : field.label}
        onChange={(on) => {
          if (on) annotate(target, field.term, 'true');
          else if (current) deleteAnnotation(target, current.id);
        }}
      >
        {label}
      </Switch>
    );
  }

  return (
    <Field label={label} hint={field.hint}>
      <div className={styles.namedValue}>
        {field.control === 'multiline' ? (
          <TextArea
            value={value}
            aria-label={field.label}
            onChange={(event) => write(event.target.value)}
          />
        ) : field.control === 'licence' ? (
          <LicenceField value={value} onChange={write} label={field.label} />
        ) : (
          <TextInput
            value={value}
            aria-label={field.label}
            onChange={(event) => write(event.target.value)}
          />
        )}

        {offerLanguage && current ? (
          <Select
            className={styles.language}
            value={current.language ?? ''}
            aria-label={`${field.label} language`}
            onChange={(event) =>
              editAnnotation(target, current.id, { language: event.target.value })
            }
          >
            <LanguageOptions />
          </Select>
        ) : null}
      </div>
    </Field>
  );
}

/**
 * A licence, which is an IRI whether or not anyone remembers which one.
 *
 * The list is the licences a schema is actually published under; anything else is typed as a
 * URL. Kept as IRIs in the model either way, because that is what `dcterms:license` means and
 * what every consumer of the file expects.
 */
const LICENCES = [
  ['https://creativecommons.org/licenses/by/4.0/', 'CC BY 4.0'],
  ['https://creativecommons.org/licenses/by-sa/4.0/', 'CC BY-SA 4.0'],
  ['https://creativecommons.org/publicdomain/zero/1.0/', 'CC0 1.0 (public domain)'],
  ['https://opensource.org/licenses/MIT', 'MIT'],
  ['https://opensource.org/licenses/Apache-2.0', 'Apache 2.0'],
  ['https://www.gnu.org/licenses/gpl-3.0', 'GPL 3.0'],
] as const;

const OTHER = 'other';

function LicenceField({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (next: string) => void;
}) {
  const known = LICENCES.some(([iri]) => iri === value);
  // Sticky, so choosing "another URL" does not snap back to the list on the first empty render.
  const [typing, setTyping] = useState(false);
  const showField = typing || (value !== '' && !known);

  return (
    <>
      <Select
        value={showField ? OTHER : value}
        aria-label={label}
        onChange={(event) => {
          const next = event.target.value;
          setTyping(next === OTHER);
          onChange(next === OTHER ? '' : next);
        }}
      >
        <option value="">— none —</option>
        {LICENCES.map(([iri, name]) => (
          <option key={iri} value={iri}>
            {name}
          </option>
        ))}
        <option value={OTHER}>another URL…</option>
      </Select>

      {showField ? (
        <TextInput
          value={value}
          mono
          aria-label={`${label} URL`}
          placeholder="https://example.org/licence"
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
    </>
  );
}
