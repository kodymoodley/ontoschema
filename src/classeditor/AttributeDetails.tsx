import { XSD_DATATYPES, xsdDatatypeLabel } from '../annotationvocabulary';
import type { XsdDatatype } from '../annotationvocabulary';
import {
  entityIri,
  findClass,
  findAttribute,
  toPropertyLocalName,
  usagesOfProperty,
} from '../ontologymodel';
import { useOntology, useProjectStore } from '../projectstore';
import { Button, DeleteIcon, Field, NameInput, Select } from '../designsystem';
import styles from './details.module.css';

/**
 * Inspector section for a selected attribute: what it is, and which classes use it.
 *
 * The xsd range lives on the property rather than on each use, because `price` is a decimal
 * wherever it appears — which is also what makes `rdfs:range` always safe to export.
 */
export function AttributeDetails({ propertyId }: { propertyId: string }) {
  const ontology = useOntology();
  const entity = findAttribute(ontology, propertyId);

  const rename = useProjectStore((state) => state.renameAttributeById);
  const setRange = useProjectStore((state) => state.setAttributeRange);
  const attachToClass = useProjectStore((state) => state.attachPropertyToClass);
  const detachUsage = useProjectStore((state) => state.detachUsageById);
  const remove = useProjectStore((state) => state.deleteAttributeById);
  const select = useProjectStore((state) => state.select);

  if (!entity) return null;

  const usages = usagesOfProperty(ontology, propertyId);
  const usedClassIds = new Set(usages.map((usage) => usage.subjectClassId));
  const available = ontology.classes.filter((candidate) => !usedClassIds.has(candidate.id));

  return (
    <div className={styles.section}>
      {/*
        Called "Name" to a reader and "Attribute local name" to a screen reader. The visible word is
        the plain one; the accessible name keeps "local" because the canvas has a rename field
        of its own answering to "Attribute name", and two controls with one name is a problem for
        anyone reaching them by name.
      */}
      <Field label="Name">
        <NameInput
          value={entity.localName}
          aria-label="Attribute local name"
          onCommit={(value) => rename(propertyId, value)}
          validate={(value) =>
            toPropertyLocalName(value) === '' ? 'An attribute needs a name.' : undefined
          }
        />
      </Field>

      <Field label="IRI">
        <code className={styles.iri}>{entityIri(ontology.iri, entity.localName)}</code>
      </Field>

      <Field label="Value type" hint="The datatype of the value, wherever this attribute is used.">
        <Select
          value={entity.range}
          aria-label="Attribute range"
          onChange={(event) => setRange(propertyId, event.target.value as XsdDatatype)}
        >
          {XSD_DATATYPES.map((datatype) => (
            <option key={datatype} value={datatype}>
              {xsdDatatypeLabel(datatype)}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={`Used on (${usages.length})`}
        hint={
          usages.length > 1
            ? 'Reused, so rdfs:domain is omitted — the SHACL shapes saved beside the axioms carry one constraint per class.'
            : 'A single use exports as rdfs:domain as well as a SHACL shape.'
        }
      >
        {usages.length === 0 ? (
          <p className={styles.unusedNote}>
            Not used by any class yet. Drag it from the Attributes list onto a class.
          </p>
        ) : (
          <ul className={styles.list}>
            {usages.map((usage) => {
              const owner = findClass(ontology, usage.subjectClassId);
              if (!owner) return null;
              return (
                <li key={usage.id} className={styles.row}>
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => select({ kind: 'class', id: owner.id })}
                  >
                    {owner.localName}
                  </button>
                  <button
                    type="button"
                    className={styles.removeButton}
                    aria-label={`Remove ${entity.localName} from ${owner.localName}`}
                    onClick={() => detachUsage(usage.id)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {available.length > 0 ? (
          <Select
            value=""
            aria-label="Add this attribute to a class"
            onChange={(event) => {
              if (event.target.value) attachToClass(propertyId, event.target.value);
            }}
          >
            <option value="">add to a class…</option>
            {available.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.localName}
              </option>
            ))}
          </Select>
        ) : null}
      </Field>

      <div className={styles.actions}>
        <Button
          variant="danger"
          iconOnly
          onClick={() => remove(propertyId)}
          aria-label="Delete attribute"
          title="Delete attribute"
        >
          <DeleteIcon />
        </Button>
      </div>
    </div>
  );
}
