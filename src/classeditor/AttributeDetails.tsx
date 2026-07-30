import { XSD_DATATYPES, xsdDatatypeCurie } from '../annotationvocabulary';
import type { XsdDatatype } from '../annotationvocabulary';
import { entityIri, findDatatypeProperty, validateLocalName } from '../ontologymodel';
import { useOntology, useProjectStore } from '../projectstore';
import { Button, Field, Select, TextInput } from '../designsystem';
import styles from './details.module.css';

/** Inspector section for a selected datatype property. */
export function AttributeDetails({ propertyId }: { propertyId: string }) {
  const ontology = useOntology();
  const entity = findDatatypeProperty(ontology, propertyId);

  const rename = useProjectStore((state) => state.renameDatatypePropertyById);
  const setRange = useProjectStore((state) => state.setAttributeRange);
  const setDomain = useProjectStore((state) => state.setAttributeDomain);
  const remove = useProjectStore((state) => state.deleteDatatypePropertyById);

  if (!entity) return null;
  const nameCheck = validateLocalName(entity.localName);

  return (
    <div className={styles.section}>
      <Field label="Local name" error={nameCheck.valid ? undefined : nameCheck.message}>
        <TextInput
          value={entity.localName}
          aria-label="Attribute local name"
          onChange={(event) => rename(propertyId, event.target.value)}
        />
      </Field>

      <Field label="IRI">
        <code className={styles.iri}>{entityIri(ontology.iri, entity.localName)}</code>
      </Field>

      <Field label="Domain" hint="The class this attribute belongs to (rdfs:domain).">
        <Select
          value={entity.domainClassId ?? ''}
          aria-label="Attribute domain"
          onChange={(event) => setDomain(propertyId, event.target.value || null)}
        >
          <option value="">— unattached —</option>
          {ontology.classes.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.localName}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Range" hint="The xsd datatype of the value (rdfs:range).">
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

      <div className={styles.actions}>
        <Button variant="danger" onClick={() => remove(propertyId)}>
          Delete attribute
        </Button>
      </div>
    </div>
  );
}
