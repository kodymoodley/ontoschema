import {
  canSubproperty,
  entityIri,
  findClass,
  findRelation,
  toPropertyLocalName,
  usagesOfProperty,
} from '../ontologymodel';
import { useOntology, useProjectStore } from '../projectstore';
import { Badge, Button, DeleteIcon, Field, NameInput, Select } from '../designsystem';
import styles from './relationeditor.module.css';

/**
 * Inspector section for a selected relation: what it is, and every pair of classes
 * it is drawn between.
 *
 * There is no "generic" flag any more — a property is simply used zero, one or many times.
 * Unused, it sits in the list with nothing on the canvas; used once, RDFS can state its
 * domain and range; used many times, only the SHACL shapes can express it without lying.
 */
export function RelationDetails({ propertyId }: { propertyId: string }) {
  const ontology = useOntology();
  const entity = findRelation(ontology, propertyId);

  const rename = useProjectStore((state) => state.renameRelationById);
  const reparent = useProjectStore((state) => state.reparentRelation);
  const setUsageTarget = useProjectStore((state) => state.setUsageTarget);
  const detachUsage = useProjectStore((state) => state.detachUsageById);
  const remove = useProjectStore((state) => state.deleteRelationById);
  const select = useProjectStore((state) => state.select);

  if (!entity) return null;

  const usages = usagesOfProperty(ontology, propertyId);
  const superPropertyId = entity.superPropertyIds[0] ?? '';

  return (
    <div className={styles.section}>
      <Field label="Status">
        <div>
          <Badge tone="relation">
            {usages.length === 0
              ? 'Unused'
              : usages.length === 1
                ? 'Used once'
                : `Reused (${usages.length}×)`}
          </Badge>
        </div>
      </Field>

      {/*
        Called "Name" to a reader and "Relation local name" to a screen reader. The visible word is
        the plain one; the accessible name keeps "local" because the canvas has a rename field
        of its own answering to "Relation name", and two controls with one name is a problem for
        anyone reaching them by name.
      */}
      <Field label="Name">
        <NameInput
          value={entity.localName}
          aria-label="Relation local name"
          onCommit={(value) => rename(propertyId, value)}
          validate={(value) =>
            toPropertyLocalName(value) === '' ? 'A relation needs a name.' : undefined
          }
        />
      </Field>

      <Field label="IRI">
        <code className={styles.iri}>{entityIri(ontology.iri, entity.localName)}</code>
      </Field>

      <Field
        label={`Used between (${usages.length})`}
        hint={
          usages.length > 1
            ? 'Reused, so rdfs:domain and rdfs:range are omitted — they could only say which classes take part, not which goes with which. The SHACL shapes saved beside the axioms keep every pair.'
            : usages.length === 1
              ? 'A single use exports as rdfs:domain and rdfs:range as well as a SHACL shape.'
              : undefined
        }
      >
        {usages.length === 0 ? (
          <p className={styles.unusedNote}>
            Not used yet, so nothing is drawn on the canvas. Drag an edge between two classes and
            pick this property to use it.
          </p>
        ) : (
          <ul className={styles.list}>
            {usages.map((usage) => {
              const subject = findClass(ontology, usage.subjectClassId);
              if (!subject) return null;
              return (
                <li key={usage.id} className={styles.usageRow}>
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => select({ kind: 'class', id: subject.id })}
                  >
                    {subject.localName}
                  </button>
                  <span className={styles.arrow} aria-hidden="true">
                    →
                  </span>
                  <Select
                    value={usage.objectClassId ?? ''}
                    aria-label={`Range of ${entity.localName} on ${subject.localName}`}
                    onChange={(event) => setUsageTarget(usage.id, event.target.value || null)}
                  >
                    <option value="">— none —</option>
                    {ontology.classes.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.localName}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    className={styles.removeButton}
                    aria-label={`Remove the ${entity.localName} relation on ${subject.localName}`}
                    onClick={() => detachUsage(usage.id)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Field>

      <Field label="Superproperty">
        <Select
          value={superPropertyId}
          aria-label="Superproperty"
          onChange={(event) => reparent(propertyId, event.target.value || null)}
        >
          <option value="">— none —</option>
          {ontology.relations
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
        <Button
          variant="danger"
          iconOnly
          onClick={() => remove(propertyId)}
          aria-label="Delete relation"
          title="Delete relation"
        >
          <DeleteIcon />
        </Button>
      </div>
    </div>
  );
}
