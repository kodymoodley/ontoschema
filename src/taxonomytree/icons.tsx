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

/** An open eye: the relation is drawn, and pressing hides it. */
export function EyeIcon(_props: IconProps) {
  return (
    <svg {...common} width={15} height={15}>
      <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8Z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

/** The eye struck through: the relation is hidden, and pressing shows it. */
export function EyeOffIcon(_props: IconProps) {
  return (
    <svg {...common} width={15} height={15}>
      <path d="M6.2 3.8A6.6 6.6 0 0 1 8 3.5c4.1 0 6.5 4.5 6.5 4.5a12 12 0 0 1-1.7 2.2" />
      <path d="M10.6 11.9A6.4 6.4 0 0 1 8 12.5C3.9 12.5 1.5 8 1.5 8a12.3 12.3 0 0 1 2.4-2.9" />
      <path d="M2 2l12 12" />
    </svg>
  );
}
