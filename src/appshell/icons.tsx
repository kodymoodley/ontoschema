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

/**
 * Editing the document itself: a card with its top-right corner left open, and a pencil
 * crossing where the corner would be.
 *
 * The open corner is what makes it read as editing rather than as a page — a closed square
 * with a pencil beside it looks like two objects, where this looks like one act. Sits beside
 * the project name, so it is about the document, not about what is selected.
 */
export function MetadataIcon() {
  return (
    <svg {...common}>
      <path d="M13 8.75v3.5a1.25 1.25 0 0 1-1.25 1.25h-8A1.25 1.25 0 0 1 2.5 12.25v-8A1.25 1.25 0 0 1 3.75 3h3.5" />
      <path d="M11.6 2.15a1.2 1.2 0 0 1 1.7 1.7L8.4 8.75 6.2 9.3l.55-2.2z" />
    </svg>
  );
}

/** A magnifier: the one drawing nobody has to be taught. */
export function SearchIcon() {
  return (
    <svg {...common}>
      <circle cx="7" cy="7" r="4.25" />
      <path d="M10.1 10.1L13.5 13.5" />
    </svg>
  );
}

/**
 * The two side panels, as the shell arranges them: a frame with one column filled.
 *
 * Mirrored rather than drawn twice, so the pair cannot drift apart -- the same reasoning as the
 * undo and redo arrows. Which side is filled is which panel the button folds.
 */
function PanelGlyph({ right }: { right: boolean }) {
  return (
    <svg {...common} style={right ? { transform: 'scaleX(-1)' } : undefined}>
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.5" />
      <path d="M6 2.75v10.5" />
      <path d="M3.4 5.4h1.2M3.4 8h1.2M3.4 10.6h1.2" />
    </svg>
  );
}

export function EntitiesPanelIcon() {
  return <PanelGlyph right={false} />;
}

export function InspectorPanelIcon() {
  return <PanelGlyph right />;
}
