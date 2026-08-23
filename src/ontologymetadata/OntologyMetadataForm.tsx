import { useState } from 'react';
import { ontologyIri, validateNamespaceIri, validatePrefix } from '../ontologymodel';
import { useOntology, useProjectStore } from '../projectstore';
import { Field, TextInput } from '../designsystem';
import styles from './ontologymetadata.module.css';

/**
 * The ontology header: the namespace every entity IRI is built from, and its prefix.
 *
 * Each field holds a draft only while it is being edited, and commits to the store as soon
 * as the value is valid. A null draft means "show whatever the store has", so switching
 * projects updates the form without any synchronising effect.
 */
export function OntologyMetadataForm() {
  const ontology = useOntology();
  const setBaseIri = useProjectStore((state) => state.setBaseIri);
  const setPrefix = useProjectStore((state) => state.setPrefix);

  const [iriDraft, setIriDraft] = useState<string | null>(null);
  const [prefixDraft, setPrefixDraft] = useState<string | null>(null);

  const iriValue = iriDraft ?? ontology.iri;
  const prefixValue = prefixDraft ?? ontology.prefix;

  const iriCheck = validateNamespaceIri(iriValue);
  const prefixCheck = validatePrefix(prefixValue);

  return (
    <div className={styles.form}>
      <Field
        label="Base IRI"
        error={iriCheck.valid ? undefined : iriCheck.message}
        hint={iriCheck.valid ? 'Entity IRIs are this namespace plus the local name.' : undefined}
      >
        <TextInput
          value={iriValue}
          mono
          aria-label="Base IRI"
          placeholder="https://example.org/auto/"
          onChange={(event) => {
            setIriDraft(event.target.value);
            if (validateNamespaceIri(event.target.value).valid) setBaseIri(event.target.value);
          }}
          onBlur={() => setIriDraft(null)}
        />
      </Field>

      <Field label="Prefix" error={prefixCheck.valid ? undefined : prefixCheck.message}>
        <TextInput
          value={prefixValue}
          mono
          aria-label="Prefix"
          placeholder="ex"
          onChange={(event) => {
            setPrefixDraft(event.target.value);
            if (validatePrefix(event.target.value).valid) setPrefix(event.target.value);
          }}
          onBlur={() => setPrefixDraft(null)}
        />
      </Field>

      <Field label="Schema IRI">
        <code className={styles.iri}>{ontologyIri(ontology.iri)}</code>
      </Field>
    </div>
  );
}
