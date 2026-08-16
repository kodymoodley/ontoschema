import { useState } from 'react';
import { XSD_DATATYPES, xsdDatatypeCurie } from '../annotationvocabulary';
import type { XsdDatatype } from '../annotationvocabulary';
import {
  attributeUsagesOfClass,
  canSubclass,
  entityIri,
  findClass,
  findAttribute,
  findRelation,
  relationUsagesTouchingClass,
  toClassLocalName,
} from '../ontologymodel';
import { useOntology, useProjectStore } from '../projectstore';
import { Button, Field, NameInput, Select } from '../designsystem';
import styles from './details.module.css';

/**
 * Inspector section for a selected class: identity, superclass, the attributes it carries
 * and the relations that touch it. Annotations are handled by the annotation panel.
 */
export function ClassDetails({ classId }: { classId: string }) {
  const ontology = useOntology();
  const entity = findClass(ontology, classId);

  const renameClass = useProjectStore((state) => state.renameClassById);
  const reparentClass = useProjectStore((state) => state.reparentClass);
  const deleteClass = useProjectStore((state) => state.deleteClassById);
  const createAttributeOn = useProjectStore((state) => state.createAttributeOn);
  const detachUsage = useProjectStore((state) => state.detachUsageById);
  const select = useProjectStore((state) => state.select);

  const [attributeName, setAttributeName] = useState('');
  const [attributeRange, setAttributeRange] = useState<XsdDatatype>('string');

  if (!entity) return null;

  const attributeUsages = attributeUsagesOfClass(ontology, classId);
  const relationUsages = relationUsagesTouchingClass(ontology, classId);
  const superClassId = entity.superClassIds[0] ?? '';

  const addAttribute = () => {
    const name = attributeName.trim();
    if (!name) return;
    createAttributeOn(classId, { localName: name, range: attributeRange });
    setAttributeName('');
  };

  return (
    <div className={styles.section}>
      <Field label="Local name">
        <NameInput
          value={entity.localName}
          aria-label="Class local name"
          onCommit={(value) => renameClass(classId, value)}
          validate={(value) =>
            toClassLocalName(value) === '' ? 'A class needs a name.' : undefined
          }
        />
      </Field>

      <Field label="IRI">
        <code className={styles.iri}>{entityIri(ontology.iri, entity.localName)}</code>
      </Field>

      <Field
        label="Superclass"
        hint="A class may sit under one parent here; use the hierarchy panel for more."
      >
        <Select
          value={superClassId}
          aria-label="Superclass"
          onChange={(event) => reparentClass(classId, event.target.value || null)}
        >
          <option value="">— none (root class) —</option>
          {ontology.classes
            .filter(
              (candidate) =>
                candidate.id !== classId && canSubclass(ontology, classId, candidate.id),
            )
            .map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.localName}
              </option>
            ))}
        </Select>
      </Field>

      <Field label={`Attributes (${attributeUsages.length})`}>
        {attributeUsages.length > 0 ? (
          <ul className={styles.list}>
            {attributeUsages.map((usage) => {
              const property = findAttribute(ontology, usage.propertyId);
              if (!property) return null;
              return (
                <li key={usage.id} className={styles.row}>
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => select({ kind: 'attribute', id: property.id })}
                  >
                    {property.localName}
                  </button>
                  <span className={styles.rowMeta}>{xsdDatatypeCurie(property.range)}</span>
                  <button
                    type="button"
                    className={styles.removeButton}
                    aria-label={`Remove ${property.localName} from ${entity.localName}`}
                    title="Remove from this class — the property stays in the list"
                    onClick={() => detachUsage(usage.id)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className={styles.inlineAdd}>
          <input
            className={styles.addInput}
            value={attributeName}
            placeholder="new attribute"
            aria-label="New attribute name"
            onChange={(event) => setAttributeName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addAttribute();
            }}
          />
          <Select
            value={attributeRange}
            aria-label="New attribute range"
            onChange={(event) => setAttributeRange(event.target.value as XsdDatatype)}
          >
            {XSD_DATATYPES.map((datatype) => (
              <option key={datatype} value={datatype}>
                {xsdDatatypeCurie(datatype)}
              </option>
            ))}
          </Select>
          <Button onClick={addAttribute} disabled={!attributeName.trim()}>
            Add
          </Button>
        </div>
      </Field>

      {relationUsages.length > 0 ? (
        <Field label={`Relations (${relationUsages.length})`}>
          <ul className={styles.list}>
            {relationUsages.map((usage) => {
              const property = findRelation(ontology, usage.propertyId);
              if (!property) return null;
              const outgoing = usage.subjectClassId === classId;
              const otherId = outgoing ? usage.objectClassId : usage.subjectClassId;
              const otherName = otherId ? findClass(ontology, otherId)?.localName : undefined;
              return (
                <li key={usage.id} className={styles.row}>
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => select({ kind: 'relation', id: property.id })}
                  >
                    {property.localName}
                  </button>
                  <span className={styles.rowMeta}>
                    {outgoing ? '→' : '←'} {otherName ?? '—'}
                  </span>
                  <button
                    type="button"
                    className={styles.removeButton}
                    aria-label={`Remove the ${property.localName} relation`}
                    title="Remove this relation — the property stays in the list"
                    onClick={() => detachUsage(usage.id)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </Field>
      ) : null}

      <div className={styles.actions}>
        <Button
          variant="danger"
          onClick={() => deleteClass(classId)}
          title="Deletes this class and every attribute row and relation attached to it"
        >
          Delete class
        </Button>
      </div>
    </div>
  );
}
