import { XSD_DATATYPES, xsdDatatypeCurie } from '../annotationvocabulary';
import type { XsdDatatype } from '../annotationvocabulary';
import {
  entityIri,
  findClass,
  findDatatypeProperty,
  toPropertyLocalName,
  usagesOfProperty,
} from '../ontologymodel';
import { useOntology, useProjectStore } from '../projectstore';
import { Button, Field, NameInput, Select } from '../designsystem';
import styles from './details.module.css';

/**
 * Inspector section for a selected datatype property: what it is, and which classes use it.
 *
 * The xsd range lives on the property rather than on each use, because `price` is a decimal
 * wherever it appears — which is also what makes `rdfs:range` always safe to export.
 */
export function AttributeDetails({ propertyId }: { propertyId: string }) {
  const ontology = useOntology();
  const entity = findDatatypeProperty(ontology, propertyId);

  const rename = useProjectStore((state) => state.renameDatatypePropertyById);
  const setRange = useProjectStore((state) => state.setAttributeRange);
  const attachToClass = useProjectStore((state) => state.attachPropertyToClass);
  const detachUsage = useProjectStore((state) => state.detachUsageById);
  const remove = useProjectStore((state) => state.deleteDatatypePropertyById);
  const select = useProjectStore((state) => state.select);

  if (!entity) return null;

  const usages = usagesOfProperty(ontology, propertyId);
  const usedClassIds = new Set(usages.map((usage) => usage.subjectClassId));
  const available = ontology.classes.filter((candidate) => !usedClassIds.has(candidate.id));

  return (
    <div className={styles.section}>
      <Field label="Local name">
        <NameInput
          value={entity.localName}
          aria-label="Attribute local name"
          onCommit={(value) => rename(propertyId, value)}
          validate={(value) =>
            toPropertyLocalName(value) === '' ? 'A property needs a name.' : undefined
          }
        />
      </Field>

      <Field label="IRI">
        <code className={styles.iri}>{entityIri(ontology.iri, entity.localName)}</code>
      </Field>

      <Field label="Range" hint="The xsd datatype of the value, wherever this property is used.">
        <Select
          value={entity.range}
          aria-label="Attribute range"
          onChange={(event) => setRange(propertyId, event.target.value as XsdDatatype)}
        >
          {XSD_DATATYPES.map((datatype) => (
            <option key={datatype} value={datatype}>
              {xsdDatatypeCurie(datatype)}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={`Used on (${usages.length})`}
        hint={
          usages.length > 1
            ? 'Reused, so rdfs:domain is omitted — the SHACL shapes carry one constraint per class.'
            : 'A single use exports as rdfs:domain as well as a SHACL shape.'
        }
      >
        {usages.length === 0 ? (
          <p className={styles.unusedNote}>
            Not used by any class yet. Drag it from the Datatype properties list onto a class.
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
        <Button variant="danger" onClick={() => remove(propertyId)}>
          Delete property
        </Button>
      </div>
    </div>
  );
}
