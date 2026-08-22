/**
 * Glyphs shared by more than one panel, drawn here rather than pulled from a package.
 *
 * The design system is where a drawing lands once a second module needs it: UI modules may not
 * import each other, so the alternative is the same path copied twice and left to drift.
 *
 * `currentColor` throughout, so a button's danger and disabled states need no special handling,
 * and decorative by default — the button carries the accessible name, so the drawing stays
 * silent to a screen reader.
 */

/*
 * 17px on a 16px canvas, at stroke 1.6, because the bin's most constrained home is the taxonomy
 * toolbar where it sits between two icons drawn to those numbers. Matching them keeps that row
 * even; standing alone in the inspector, either would have done.
 */
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

/** A waste bin: lid, handle, tapered body, two stripes. */
export function DeleteIcon() {
  return (
    <svg {...common}>
      <path d="M2.75 4.5h10.5" />
      <path d="M6.5 4.5V3.25h3V4.5" />
      <path d="M4.25 4.5l.6 8.25h6.3l.6-8.25" />
      <path d="M6.75 7v3.5M9.25 7v3.5" />
    </svg>
  );
}

/**
 * A relation as the canvas draws one: a line, broken by its name, with an arrowhead.
 *
 * The palette's relation swatch was the other candidate and says less — it is a rounded
 * rectangle in the relation colour, which tells you the colour and nothing else. This is a
 * small picture of the thing the control reveals, including the part that took longest to get
 * right: the name sits *in* the line rather than under it.
 */
export function RelationIcon() {
  return (
    <svg {...common} strokeWidth={1.4}>
      <path d="M0.9 8h3" />
      <rect x="3.9" y="6" width="7.6" height="4" rx="2" />
      <path d="M11.5 8h1.9" />
      <path d="M13.1 6.9 15.1 8l-2 1.1z" fill="currentColor" stroke="none" />
    </svg>
  );
}
