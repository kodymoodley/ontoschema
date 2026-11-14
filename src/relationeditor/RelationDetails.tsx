import {
  CLASS_SIDES,
  canSubproperty,
  entityIri,
  findClass,
  findRelation,
  isClassSide,
  toPropertyLocalName,
  usagesOfProperty,
} from '../ontologymodel';
import type { ClassSide } from '../ontologymodel';
import { useOntology, useProjectStore, useShowTerms } from '../projectstore';
import { Badge, Button, DeleteIcon, Field, NameInput, Select } from '../designsystem';
import styles from './relationeditor.module.css';

/**
 * Which side of each class one drawn line meets: pinned to a side, or Auto, following the classes
 * to whichever sides face each other.
 *
 * The same thing dragging a line's end does on the canvas, for every way in that dragging does
 * not serve: a finger, which cannot grab the end of a line, a keyboard, and a screen reader.
 */
function SidesOfLine({
  relation,
  subject,
  object,
  pinned,
  onPin,
}: {
  relation: string;
  subject: string;
  object: string;
  pinned: { source?: ClassSide; target?: ClassSide } | undefined;
  onPin: (end: 'source' | 'target', side: ClassSide | null) => void;
}) {
  const choose = (end: 'source' | 'target', ofClass: string) => (
    <Select
      value={pinned?.[end] ?? ''}
      aria-label={`Side of ${ofClass} the ${relation} line ${end === 'source' ? 'leaves from' : 'arrives at'}`}
      title="Auto follows the classes to whichever sides face each other"
      onChange={(event) => onPin(end, isClassSide(event.target.value) ? event.target.value : null)}
    >
      <option value="">Auto</option>
      {CLASS_SIDES.map((side) => (
        <option key={side} value={side}>
          {side.charAt(0).toUpperCase() + side.slice(1)}
        </option>
      ))}
    </Select>
  );

  // One line per end, labelled: side by side, the two selects were too narrow to show their value.
  return (
    <div className={styles.usageSides}>
      <span className={styles.usageSidesLabel}>From side</span>
      {choose('source', subject)}
      <span className={styles.usageSidesLabel}>To side</span>
      {choose('target', object)}
    </div>
  );
}

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
  const showTerms = useShowTerms();
  const entity = findRelation(ontology, propertyId);

  const rename = useProjectStore((state) => state.renameRelationById);
  const reparent = useProjectStore((state) => state.reparentRelation);
  const setUsageTarget = useProjectStore((state) => state.setUsageTarget);
  const detachUsage = useProjectStore((state) => state.detachUsageById);
  const pinEnd = useProjectStore((state) => state.pinUsageEndById);
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

      {/*
        Behind the same switch that names the RDF terms, and for the same reason: an IRI is what
        this becomes in a file, not something anyone types or edits. It is derived — the base IRI
        plus the name above it — so it says nothing the two fields around it do not already say,
        and it took a third of the panel to say it.
      */}
      {showTerms ? (
        <Field label="IRI">
          <code className={styles.iri}>{entityIri(ontology.iri, entity.localName)}</code>
        </Field>
      ) : null}

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
                  {usage.objectClassId !== null ? (
                    <SidesOfLine
                      relation={entity.localName}
                      subject={subject.localName}
                      object={findClass(ontology, usage.objectClassId)?.localName ?? ''}
                      pinned={usage.pinned}
                      onPin={(end, side) => pinEnd(usage.id, end, side)}
                    />
                  ) : null}
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
