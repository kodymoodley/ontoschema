/**
 * Header icons, drawn here rather than pulled from a package, for the same reasons as the
 * taxonomy toolbar's: two glyphs do not justify a dependency, and `currentColor` means the
 * subtle and pressed states of a button need no special handling.
 */

const common = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/**
 * A class with two subclasses, the same mark as the app icon.
 *
 * It stands for the entities panel, which is a palette of things to create above a tree of the
 * things that exist — and a small hierarchy says both. Drawn rather than a generic list or
 * hamburger, because the file menu already uses stacked lines and two of those in one header
 * would be one too many.
 */
export function EntitiesIcon() {
  return (
    <svg {...common}>
      <rect x="5.5" y="1.75" width="5" height="3.5" rx="1" />
      <path d="M8 5.25v2" />
      <path d="M3.25 7.25h9.5" />
      <path d="M3.25 7.25v1.5M12.75 7.25v1.5" />
      <rect x="1.25" y="8.75" width="4" height="3.5" rx="1" />
      <rect x="10.75" y="8.75" width="4" height="3.5" rx="1" />
    </svg>
  );
}
