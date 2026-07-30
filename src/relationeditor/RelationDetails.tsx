import { canSubproperty, entityIri, findObjectProperty, validateLocalName } from '../ontologymodel';
import { useOntology, useProjectStore } from '../projectstore';
import { Badge, Button, Field, Select, TextInput } from '../designsystem';
import styles from './relationeditor.module.css';

/**
 * Inspector section for a selected object property, of either kind.
 *
 * A scoped property shows its domain and range and can be re-pointed; a generic one shows
 * why it deliberately has neither, and offers promotion to a scoped relation.
 */
export function RelationDetails({ propertyId }: { propertyId: string }) {
  const ontology = useOntology();
  const entity = findObjectProperty(ontology, propertyId);

  const rename = useProjectStore((state) => state.renameObjectPropertyById);
  const setEndpoints = useProjectStore((state) => state.setRelationEndpoints);
  const reparent = useProjectStore((state) => state.reparentObjectProperty);
  const remove = useProjectStore((state) => state.deleteObjectPropertyById);

  if (!entity) return null;
  const nameCheck = validateLocalName(entity.localName);
  const superPropertyId = entity.superPropertyIds[0] ?? '';

  return (
    <div className={styles.section}>
      <Field label="Kind">
        <div>
          <Badge tone="relation">
            {entity.kind === 'scoped' ? 'Scoped relation' : 'Generic property'}
          </Badge>
        </div>
      </Field>

      <Field label="Local name" error={nameCheck.valid ? undefined : nameCheck.message}>
        <TextInput
          value={entity.localName}
          aria-label="Object property local name"
          onChange={(event) => rename(propertyId, event.target.value)}
        />
      </Field>

      <Field label="IRI">
        <code className={styles.iri}>{entityIri(ontology.iri, entity.localName)}</code>
      </Field>

      {entity.kind === 'scoped' ? (
        <Field label="Domain and range" hint="The edge direction: domain → range.">
          <div className={styles.endpoints}>
            <Select
              value={entity.domainClassId ?? ''}
              aria-label="Relation domain"
              onChange={(event) =>
                setEndpoints(propertyId, { domainClassId: event.target.value || null })
              }
            >
              <option value="">— none —</option>
              {ontology.classes.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.localName}
                </option>
              ))}
            </Select>
            <span className={styles.arrow} aria-hidden="true">
              →
            </span>
            <Select
              value={entity.rangeClassId ?? ''}
              aria-label="Relation range"
              onChange={(event) =>
                setEndpoints(propertyId, { rangeClassId: event.target.value || null })
              }
            >
              <option value="">— none —</option>
              {ontology.classes.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.localName}
                </option>
              ))}
            </Select>
          </div>
        </Field>
      ) : (
        <p className={styles.kindNote}>
          A generic property is reusable between any classes, so it is exported without{' '}
          <code>rdfs:domain</code> or <code>rdfs:range</code>. Give it a domain and range below to
          turn it into a scoped relation on the canvas.
        </p>
      )}

      {entity.kind === 'generic' ? (
        <Field label="Promote to a scoped relation">
          <div className={styles.endpoints}>
            <Select
              value=""
              aria-label="Promote domain"
              onChange={(event) => {
                const domainClassId = event.target.value || null;
                if (domainClassId) setEndpoints(propertyId, { domainClassId });
              }}
            >
              <option value="">choose domain…</option>
              {ontology.classes.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.localName}
                </option>
              ))}
            </Select>
            <span className={styles.arrow} aria-hidden="true">
              →
            </span>
            <Select
              value=""
              aria-label="Promote range"
              onChange={(event) => {
                const rangeClassId = event.target.value || null;
                if (rangeClassId) setEndpoints(propertyId, { rangeClassId });
              }}
            >
              <option value="">choose range…</option>
              {ontology.classes.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.localName}
                </option>
              ))}
            </Select>
          </div>
        </Field>
      ) : null}

      <Field label="Superproperty">
        <Select
          value={superPropertyId}
          aria-label="Superproperty"
          onChange={(event) => reparent(propertyId, event.target.value || null)}
        >
          <option value="">— none —</option>
          {ontology.objectProperties
            .filter(
              (candidate) =>
                candidate.id !== propertyId && canSubproperty(ontology, propertyId, candidate.id),
            )
            .map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.localName}
              </option>
            ))}
        </Select>
      </Field>

      <div className={styles.actions}>
        <Button variant="danger" onClick={() => remove(propertyId)}>
          Delete property
        </Button>
      </div>
    </div>
  );
}
