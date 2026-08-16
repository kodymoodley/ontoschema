import { useEffect, useRef, useState } from 'react';
import styles from './classeditor.module.css';

/**
 * A name that can be edited where it sits.
 *
 * Two things on a class node are renamed this way — the class in the header, and each datatype
 * property row — and both want the same rules: Enter and blur commit, Escape abandons, and a
 * name the model would reject is flagged rather than silently reverted, so the field can be
 * cleared and retyped.
 *
 * Validation is passed in rather than imported, because a class name and a property name are
 * sanitised differently and this component has no business knowing which is which.
 */

interface InlineNameProps {
  value: string;
  /** True when the text would survive the model's sanitiser. */
  isValid: (draft: string) => boolean;
  onCommit: (draft: string) => void;
  label: string;
  /** Applied to the text when it is not being edited, so each caller keeps its own type. */
  textClassName: string | undefined;
  /** Applied to the field, so it matches the text it replaces rather than jumping in size. */
  inputClassName: string | undefined;
  /** Shown beside the field while editing, to say how far a rename will reach. */
  hint?: string;
  /**
   * Opens the editor from a double-click on the text itself, for callers that want the gesture
   * to belong to the name rather than to whatever the name sits in. Callers whose container
   * already owns the gesture leave this out.
   */
  onTextDoubleClick?: (event: React.MouseEvent) => void;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}

export function InlineName({
  value,
  textClassName,
  editing,
  onTextDoubleClick,
  ...editable
}: InlineNameProps) {
  if (!editing) {
    return (
      <span className={textClassName} title={value} onDoubleClick={onTextDoubleClick}>
        {value}
      </span>
    );
  }

  /*
   * The field is a separate component so that opening the editor mounts it, and the draft can
   * start from the current name as ordinary initial state. Holding the draft out here instead
   * would mean resetting it from an effect every time editing opened, which is both a cascading
   * render and a way to overwrite what someone is halfway through typing.
   */
  return <NameField value={value} {...editable} />;
}

type NameFieldProps = Omit<InlineNameProps, 'textClassName' | 'editing'>;

function NameField({
  value,
  isValid,
  onCommit,
  label,
  hint,
  inputClassName,
  onEditingChange,
}: NameFieldProps) {
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement>(null);

  // Select on open, so typing replaces the name rather than appending to it.
  useEffect(() => {
    input.current?.select();
  }, []);

  const valid = isValid(draft);
  const commit = () => {
    if (!valid) return;
    onEditingChange(false);
    if (draft !== value) onCommit(draft);
  };

  return (
    <>
      <input
        ref={input}
        className={`${inputClassName} ${valid ? '' : styles.nameInputInvalid}`}
        value={draft}
        aria-label={label}
        aria-invalid={valid ? undefined : true}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => (valid ? commit() : onEditingChange(false))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') onEditingChange(false);
        }}
      />
      {hint ? <span className={styles.renameHint}>{hint}</span> : null}
    </>
  );
}
