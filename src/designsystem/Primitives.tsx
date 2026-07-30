import { useEffect, useId, useRef } from 'react';
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
      {...rest}
    />
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export function Select({ invalid, className, children, ...rest }: SelectProps) {
  return (
    <select
      className={cx(styles.control, styles.select, invalid && styles.invalid, className)}
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

export function Modal({ title, open, onClose, children, footer }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    // Move focus into the dialog so keyboard users are not left behind on the page.
    dialogRef.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
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
    </div>
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
