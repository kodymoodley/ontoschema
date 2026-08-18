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
 * The app's own mark: a class with two subclasses, the same drawing as `public/icon.svg`.
 *
 * Kept in step with that file by hand. It is the smallest picture of what the tool is for, and
 * having the header show the same thing as the home-screen icon is the point — an app that looks
 * like one thing in the tab and another in the window looks like two.
 */
export function AppMark() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 16 16"
      fill="none"
      stroke="var(--accent-class)"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="OntoSchema"
    >
      <rect x="5.5" y="1.75" width="5" height="3.5" rx="1" fill="var(--accent-class-soft)" />
      <path d="M8 5.25v2" />
      <path d="M3.25 7.25h9.5" />
      <path d="M3.25 7.25v1.5M12.75 7.25v1.5" />
      <rect x="1.25" y="8.75" width="4" height="3.5" rx="1" fill="var(--accent-class)" />
      <rect x="10.75" y="8.75" width="4" height="3.5" rx="1" fill="var(--accent-class)" />
    </svg>
  );
}

/**
 * A panel hinged off the left edge, for the button that slides one in and out.
 *
 * Deliberately not the app mark, which this used to be. The header now shows that mark as the
 * logo, and the same drawing twice in one strip reads as a mistake rather than as a theme. A
 * sidebar is also the more honest picture: the button does not stand for the entities, it stands
 * for the panel they live in.
 */
export function EntitiesIcon() {
  return (
    <svg {...common}>
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.75" />
      <path d="M6.25 2.75v10.5" />
      <path d="M3.5 6h1.25M3.5 8.5h1.25" />
    </svg>
  );
}
