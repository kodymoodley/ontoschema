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
 * Undo and redo: an arrow curving back on itself, the shape every editor uses for these.
 *
 * Mirrored rather than drawn twice, so the pair cannot drift apart. The arrowhead is part of the
 * path rather than a separate marker, which keeps the stroke weight even at 16px.
 */
function CurvedArrow({ flip }: { flip: boolean }) {
  return (
    <svg {...common} style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M3 8.5a5 5 0 0 1 9.5 2.2" />
      <path d="M2.5 4.75V8.5h3.75" />
    </svg>
  );
}

export function UndoIcon() {
  return <CurvedArrow flip={false} />;
}

export function RedoIcon() {
  return <CurvedArrow flip />;
}
