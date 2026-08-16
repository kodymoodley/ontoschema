/**
 * The three toolbar icons, drawn here rather than pulled from a package.
 *
 * Three glyphs do not justify a dependency, and an icon library would arrive with hundreds of
 * others plus its own sizing and colour conventions to reconcile with the design tokens. These
 * inherit both: `currentColor` follows the button's own text colour, so the danger variant and
 * the disabled state need no special handling.
 *
 * Adding a root and adding a child are the same act at two levels, and no drawing distinguishes
 * them on its own — which is why the buttons carry a label and a tooltip as well. The plain plus
 * is the root; the elbow before the plus is the indent. Both are reminders for someone who
 * already knows, not explanations.
 */

interface IconProps {
  /** Marked decorative: the button carries the accessible name, so the drawing must stay silent. */
  title?: never;
}

const common = {
  width: 17,
  height: 17,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/** A plain plus: a new entry, at the top level unless the elbow below says otherwise. */
export function AddRootIcon(_props: IconProps) {
  return (
    <svg {...common}>
      <path d="M8 3.5v9" />
      <path d="M3.5 8h9" />
    </svg>
  );
}

/** A plus at the end of an elbow: a new entry one level in, under what is selected. */
export function AddChildIcon(_props: IconProps) {
  return (
    <svg {...common}>
      <path d="M4 2.75v5.5h3.5" />
      <path d="M11 8.5v5" />
      <path d="M8.5 11h5" />
    </svg>
  );
}

/** A waste basket, which reads as delete far more widely than a cross or a minus does. */
export function DeleteIcon(_props: IconProps) {
  return (
    <svg {...common}>
      <path d="M2.75 4.5h10.5" />
      <path d="M6.5 4.5V3.25h3V4.5" />
      <path d="M4.25 4.5l.6 8.25h6.3l.6-8.25" />
      <path d="M6.75 7v3.5M9.25 7v3.5" />
    </svg>
  );
}
