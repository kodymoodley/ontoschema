import { useState } from 'react';
import { findClass, toPropertyLocalName, usagesOfProperty } from '../ontologymodel';
import { useOntology, useProjectStore } from '../projectstore';
import { Button, Field, Modal, Select } from '../designsystem';
import styles from './relationeditor.module.css';

/**
 * Shown when an edge has been drawn but not yet given a property.
 *
 * Drawing a connection is not the same as inventing a property. Choosing an existing one is
 * what makes a property reusable — and what puts an otherwise-unused property onto the
 * canvas for the first time.
 */
export function ConnectionPicker() {
  const ontology = useOntology();
  const pending = useProjectStore((state) => state.pendingConnection);
  const cancel = useProjectStore((state) => state.cancelConnection);
  const completeWith = useProjectStore((state) => state.completeConnectionWith);
  const completeWithNew = useProjectStore((state) => state.completeConnectionWithNewProperty);

  const [choice, setChoice] = useState('');
  const [newName, setNewName] = useState('');

  if (!pending) return null;

  const subject = findClass(ontology, pending.subjectClassId);
  const object = findClass(ontology, pending.objectClassId);
  if (!subject || !object) return null;

  const creatingNew = choice === '';
  const cleanedNewName = toPropertyLocalName(newName);
  const canConfirm = creatingNew ? cleanedNewName !== '' : true;

  const close = () => {
    setChoice('');
    setNewName('');
    cancel();
  };

  const confirm = () => {
    if (!canConfirm) return;
    if (creatingNew) completeWithNew(newName);
    else completeWith(choice);
    setChoice('');
    setNewName('');
  };

  return (
    <Modal
      title="Which relation?"
      open
      onClose={close}
      footer={
        <>
          <Button variant="subtle" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={confirm}
            disabled={!canConfirm}
            data-testid="confirm-connection"
          >
            Use property
          </Button>
        </>
      }
    >
      <p className={styles.pendingSummary}>
        <strong>{subject.localName}</strong> <span aria-hidden="true">→</span>{' '}
        <strong>{object.localName}</strong>
      </p>

      <Field label="Relation" hint="Reuse one you already have, or create a new one.">
        <Select
          value={choice}
          aria-label="Relation to use"
          onChange={(event) => setChoice(event.target.value)}
        >
          <option value="">— create a new relation —</option>
          {ontology.relations.map((property) => {
            const uses = usagesOfProperty(ontology, property.id).length;
            return (
              <option key={property.id} value={property.id}>
                {property.localName}
                {uses === 0 ? ' (unused)' : ` (used ${uses}×)`}
              </option>
            );
          })}
        </Select>
      </Field>

      {creatingNew ? (
        <Field
          label="New relation name"
          error={newName.trim() && cleanedNewName === '' ? 'That name cannot be used.' : undefined}
        >
          <input
            className={`${styles.nameField} ${
              newName.trim() && cleanedNewName === '' ? styles.nameFieldInvalid : ''
            }`}
            value={newName}
            // The dialog owns initial focus; this marks the field it should land on.
            data-autofocus
            placeholder="offeredBy"
            aria-label="New relation name"
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') confirm();
            }}
          />
        </Field>
      ) : null}
    </Modal>
  );
}
