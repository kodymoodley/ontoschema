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
import { Button, DeleteIcon, Field, NameInput, Select } from '../designsystem';
import styles from './details.module.css';

/**
 * Inspector section for a selected class: identity, superclass, the attributes it carries
 * and the relations that touch it. Annotations are handled by the annotation panel.
 */
export function ClassDetails({ classId }: { classId: string }) {
  const ontology = useOntology();
  const entity = findClass(ontology, classId);

  const renameClass = useProjectStore((state) => state.renameClassById);
  const addSuperClass = useProjectStore((state) => state.addSuperClass);
  const removeSuperClass = useProjectStore((state) => state.removeSuperClass);
  const deleteClass = useProjectStore((state) => state.deleteClassById);
  const createAttributeOn = useProjectStore((state) => state.createAttributeOn);
  const detachUsage = useProjectStore((state) => state.detachUsageById);
  const select = useProjectStore((state) => state.select);

  const [attributeName, setAttributeName] = useState('');
  const [attributeRange, setAttributeRange] = useState<XsdDatatype>('string');

  if (!entity) return null;

  const attributeUsages = attributeUsagesOfClass(ontology, classId);
  const relationUsages = relationUsagesTouchingClass(ontology, classId);
  const superClasses = entity.superClassIds
    .map((id) => findClass(ontology, id))
    .filter((parent): parent is NonNullable<typeof parent> => parent !== undefined);

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

      {/*
        Several parents, not one. A class is often two things at once -- a LeaseAgreement is a
        Contract and a FinancialInstrument -- and the model, the exporters and the taxonomy view
        have always allowed it. Only this control did not, and it silently replaced one parent
        with the other. Listed rather than multi-selected, so the same list-and-remove shape as
        the attributes and relations below it, which also works by touch and by keyboard.
      */}
      <Field
        label={`Superclasses (${superClasses.length})`}
        hint={superClasses.length === 0 ? 'No parent, so this is a root class.' : undefined}
      >
        {superClasses.length > 0 ? (
          <ul className={styles.list}>
            {superClasses.map((parent) => (
              <li key={parent.id} className={styles.row}>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => select({ kind: 'class', id: parent.id })}
                >
                  {parent.localName}
                </button>
                <button
                  type="button"
                  className={styles.removeButton}
                  aria-label={`Remove ${parent.localName} as a superclass of ${entity.localName}`}
                  title="Stop this class being a subclass of that one"
                  onClick={() => removeSuperClass(classId, parent.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <Select
          value=""
          aria-label="Add a superclass"
          onChange={(event) => event.target.value && addSuperClass(classId, event.target.value)}
        >
          <option value="">— add a superclass —</option>
          {ontology.classes
            .filter(
              (candidate) =>
                candidate.id !== classId &&
                !entity.superClassIds.includes(candidate.id) &&
                canSubclass(ontology, classId, candidate.id),
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
                    title="Remove from this class — the attribute stays in the list"
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
          <Button
            onClick={addAttribute}
            disabled={!attributeName.trim()}
            /* The palette has an "Add Attribute" of its own, and role names match without
               regard to case. This one says which class it adds to, which it should anyway. */
            aria-label="Add attribute to this class"
          >
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
                    title="Remove this use — the relation stays in the list"
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
          iconOnly
          onClick={() => deleteClass(classId)}
          aria-label="Delete class"
          title="Delete class — also removes every attribute row and relation attached to it"
        >
          <DeleteIcon />
        </Button>
      </div>
    </div>
  );
}
