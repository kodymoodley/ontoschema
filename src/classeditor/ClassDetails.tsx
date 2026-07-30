import { useState } from 'react';
import { XSD_DATATYPES, xsdDatatypeCurie } from '../annotationvocabulary';
import type { XsdDatatype } from '../annotationvocabulary';
import {
  attributesOfClass,
  canSubclass,
  entityIri,
  findClass,
  relationsTouchingClass,
  validateLocalName,
} from '../ontologymodel';
import { useOntology, useProjectStore } from '../projectstore';
import { Button, Field, Select, TextInput } from '../designsystem';
import styles from './details.module.css';

/**
 * Inspector section for a selected class: identity, superclass, its attributes and the
 * relations that touch it. Annotations are handled separately by the annotation panel.
 */
export function ClassDetails({ classId }: { classId: string }) {
  const ontology = useOntology();
  const entity = findClass(ontology, classId);

  const renameClass = useProjectStore((state) => state.renameClassById);
  const reparentClass = useProjectStore((state) => state.reparentClass);
  const deleteClass = useProjectStore((state) => state.deleteClassById);
  const createAttribute = useProjectStore((state) => state.createDatatypeProperty);
  const select = useProjectStore((state) => state.select);

  const [attributeName, setAttributeName] = useState('');
  const [attributeRange, setAttributeRange] = useState<XsdDatatype>('string');

  if (!entity) return null;

  const attributes = attributesOfClass(ontology, classId);
  const relations = relationsTouchingClass(ontology, classId);
  const nameCheck = validateLocalName(entity.localName);
  const superClassId = entity.superClassIds[0] ?? '';

  const addAttribute = () => {
    const name = attributeName.trim();
    if (!name) return;
    createAttribute({ localName: name, domainClassId: classId, range: attributeRange });
    // Adding from here is usually one of several in a row, so keep the class selected
    // rather than following the new attribute into its own inspector.
    select({ kind: 'class', id: classId });
    setAttributeName('');
  };

  return (
    <div className={styles.section}>
      <Field label="Local name" error={nameCheck.valid ? undefined : nameCheck.message}>
        <TextInput
          value={entity.localName}
          aria-label="Class local name"
          onChange={(event) => renameClass(classId, event.target.value)}
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

      <Field label={`Attributes (${attributes.length})`}>
        {attributes.length > 0 ? (
          <ul className={styles.list}>
            {attributes.map((attribute) => (
              <li key={attribute.id} className={styles.row}>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => select({ kind: 'datatypeProperty', id: attribute.id })}
                >
                  {attribute.localName}
                </button>
                <span className={styles.rowMeta}>{xsdDatatypeCurie(attribute.range)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className={styles.inlineAdd}>
          <TextInput
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

      {relations.length > 0 ? (
        <Field label={`Relations (${relations.length})`}>
          <ul className={styles.list}>
            {relations.map((relation) => {
              const other =
                relation.domainClassId === classId ? relation.rangeClassId : relation.domainClassId;
              const otherName = other ? findClass(ontology, other)?.localName : undefined;
              const outgoing = relation.domainClassId === classId;
              return (
                <li key={relation.id} className={styles.row}>
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => select({ kind: 'objectProperty', id: relation.id })}
                  >
                    {relation.localName}
                  </button>
                  <span className={styles.rowMeta}>
                    {outgoing ? '→' : '←'} {otherName ?? '—'}
                  </span>
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
          title="Deletes this class, its attributes and any relation that touches it"
        >
          Delete class
        </Button>
      </div>
    </div>
  );
}
