import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import styles from './primitives.module.css';

/**
 * Presentational primitives shared by every panel. This module is a leaf: it knows nothing
 * about ontologies, so it can be restyled or replaced without touching domain code.
 */

function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

/* ---------------------------------------------------------------- Button */

type ButtonVariant = 'default' | 'primary' | 'subtle' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'default' | 'small';
  iconOnly?: boolean;
}

export function Button({
  variant = 'default',
  size = 'default',
  iconOnly = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        styles.button,
        variant === 'primary' && styles.primary,
        variant === 'subtle' && styles.subtle,
        variant === 'danger' && styles.danger,
        size === 'small' && styles.small,
        iconOnly && styles.iconOnly,
        className,
      )}
      {...rest}
    />
  );
}

/* ----------------------------------------------------------------- Field */

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, children, className }: FieldProps) {
  return (
    <div className={cx(styles.field, className)}>
      {label ? <span className={styles.label}>{label}</span> : null}
      {children}
      {error ? (
        <span className={styles.error}>{error}</span>
      ) : hint ? (
        <span className={styles.hint}>{hint}</span>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- Input */

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  mono?: boolean;
}

export function TextInput({ invalid, mono, className, ...rest }: TextInputProps) {
  return (
    <input
      className={cx(styles.control, mono && styles.mono, invalid && styles.invalid, className)}
      // A red border alone tells a sighted mouse user; `aria-invalid` tells everyone else.
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function TextArea({ invalid, className, ...rest }: TextAreaProps) {
  return (
    <textarea
      className={cx(styles.control, styles.textarea, invalid && styles.invalid, className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

/**
 * A name field that may be emptied while it is being edited.
 *
 * Binding an input straight to a value the model refuses to accept makes the field feel
 * broken — deleting the last character silently snaps the old name back, so the name can
 * never be replaced by typing. Instead the field holds its own draft, marks itself invalid
 * the way a required form field would, and only commits once the value is acceptable.
 */
interface NameInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onCommit: (value: string) => void;
  validate?: (value: string) => string | undefined;
  mono?: boolean;
}

export function NameInput({
  value,
  onCommit,
  validate,
  mono,
  className,
  onBlur,
  onKeyDown,
  ...rest
}: NameInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const error = draft === null ? undefined : validate?.(draft);

  const commit = (next: string) => {
    if (validate?.(next)) return;
    setDraft(null);
    if (next !== value) onCommit(next);
  };

  return (
    <>
      <input
        className={cx(styles.control, mono && styles.mono, error && styles.invalid, className)}
        value={shown}
        aria-invalid={error ? true : undefined}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          // Commit as you type while the value is usable, so the canvas stays in step.
          if (!validate?.(next)) onCommit(next);
        }}
        onBlur={(event) => {
          // Leaving an unusable value behind would strand the field; fall back to the model.
          if (error) setDraft(null);
          else commit(event.target.value);
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(event.currentTarget.value);
          if (event.key === 'Escape') setDraft(null);
          onKeyDown?.(event);
        }}
        {...rest}
      />
      {error ? <span className={styles.error}>{error}</span> : null}
    </>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export function Select({ invalid, className, children, ...rest }: SelectProps) {
  return (
    <select
      className={cx(styles.control, styles.select, invalid && styles.invalid, className)}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}

/* ------------------------------------------------------------------ Tabs */

export interface TabOption<T extends string> {
  value: T;
  label: string;
}

interface TabsProps<T extends string> {
  options: readonly TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

export function Tabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: TabsProps<T>) {
  return (
    <div className={cx(styles.tabs, className)} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={cx(styles.tab, option.value === value && styles.tabActive)}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- Panel */

interface PanelProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Panel({ title, actions, children, className, bodyClassName }: PanelProps) {
  return (
    <section className={cx(styles.panel, className)}>
      {title || actions ? (
        <header className={styles.panelHeader}>
          {title ? <h2 className={styles.panelTitle}>{title}</h2> : <span />}
          {actions}
        </header>
      ) : null}
      <div className={cx(styles.panelBody, bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

/* ----------------------------------------------------------------- Badge */

type BadgeTone = 'class' | 'relation' | 'attribute' | 'neutral';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cx(
        styles.badge,
        tone === 'class' && styles.badgeClass,
        tone === 'relation' && styles.badgeRelation,
        tone === 'attribute' && styles.badgeAttribute,
        tone === 'neutral' && styles.badgeNeutral,
      )}
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- Modal */

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableWithin(root: HTMLElement | null): HTMLElement[] {
  return root ? [...root.querySelectorAll<HTMLElement>(FOCUSABLE)] : [];
}

export function Modal({ title, open, onClose, children, footer }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [host] = useState(() =>
    typeof document === 'undefined' ? null : document.createElement('div'),
  );

  /*
   * `onClose` is almost always an inline arrow, so its identity changes on every render.
   * Keeping it in a ref is what stops the listeners below from being torn down and rebuilt
   * on each keystroke — which is what used to yank focus out of the field being typed into.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Mount the dialog outside the app tree and hide the rest of the page from assistive
  // technology, so a screen reader cannot wander behind an open dialog.
  useEffect(() => {
    if (!open || !host) return;
    document.body.append(host);
    const others = [...document.body.children].filter((element) => element !== host);
    const previous = others.map(
      (element) => [element, element.getAttribute('aria-hidden')] as const,
    );
    for (const element of others) element.setAttribute('aria-hidden', 'true');

    return () => {
      for (const [element, value] of previous) {
        if (value === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', value);
      }
      host.remove();
    };
  }, [open, host]);

  // Focus management, keyed on `open` alone so it runs exactly once per opening.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;

    const preferred = dialog?.querySelector<HTMLElement>('[data-autofocus]');
    (preferred ?? focusableWithin(dialog)[0])?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      // Trap Tab inside the dialog; otherwise it walks off into the page behind.
      const focusable = focusableWithin(dialog);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Hand focus back to whatever opened the dialog rather than dropping it on the body.
      opener?.focus();
    };
  }, [open]);

  if (!open || !host) return null;

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        <div className={styles.dialogHeader}>
          <h2 className={styles.dialogTitle} id={titleId}>
            {title}
          </h2>
        </div>
        <div className={styles.dialogBody}>{children}</div>
        {footer ? <div className={styles.dialogFooter}>{footer}</div> : null}
      </div>
    </div>,
    host,
  );
}

/* --------------------------------------------------------------- Toolbar */

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.toolbar, className)}>{children}</div>;
}

export function Spacer() {
  return <div className={styles.spacer} />;
}

export function Divider() {
  return <div className={styles.divider} />;
}

export { cx };
