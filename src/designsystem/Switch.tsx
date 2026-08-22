import styles from './primitives.module.css';

/**
 * An on/off switch, drawn as one.
 *
 * A pressed button says the same thing to a screen reader and much less to an eye: you have to
 * notice that it looks slightly darker than it did, and compare it against nothing. A track and
 * a knob show both states at once — where the switch is now, and where it would be.
 *
 * `role="switch"` rather than a checkbox, because it takes effect immediately. A checkbox is a
 * choice that something later will act on; this is the something.
 */
export function Switch({
  checked,
  onChange,
  label,
  ...rest
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Shown beside the switch and used as its name, so the two can never disagree. */
  label: string;
  'data-testid'?: string | undefined;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={styles.switch}
      onClick={() => onChange(!checked)}
      {...rest}
    >
      <span className={styles.switchTrack} aria-hidden="true">
        <span className={styles.switchKnob} />
      </span>
      <span className={styles.switchLabel}>{label}</span>
    </button>
  );
}
