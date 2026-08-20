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
