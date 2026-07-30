import styles from './canvas.module.css';

/**
 * The drag source for the three things that can be dropped onto the schema canvas.
 * Each palette entry carries its kind through the drag payload; the canvas decides what
 * to create on drop.
 */

export type PaletteKind = 'class' | 'attribute' | 'genericProperty';

export const PALETTE_MIME = 'application/x-ontoschema-palette';

interface PaletteEntry {
  kind: PaletteKind;
  name: string;
  hint: string;
  swatch: string;
}

const ENTRIES: PaletteEntry[] = [
  {
    kind: 'class',
    name: 'Class',
    hint: 'A kind of thing — Car, Dealership. Drag onto the canvas.',
    swatch: styles.swatchClass ?? '',
  },
  {
    kind: 'attribute',
    name: 'Datatype property',
    hint: 'An attribute with an xsd range — make, year, price. Drop it on a class to attach it.',
    swatch: styles.swatchAttribute ?? '',
  },
  {
    kind: 'genericProperty',
    name: 'Generic object property',
    hint: 'Reusable across classes — hasPart, isRelatedTo. No fixed domain or range.',
    swatch: styles.swatchGeneric ?? '',
  },
];

interface PaletteProps {
  onCreate: (kind: PaletteKind) => void;
}

export function Palette({ onCreate }: PaletteProps) {
  return (
    <div className={styles.palette}>
      {ENTRIES.map((entry) => (
        <button
          key={entry.kind}
          type="button"
          className={styles.paletteItem}
          draggable
          data-palette-kind={entry.kind}
          aria-label={`Add ${entry.name}`}
          onDragStart={(event) => {
            event.dataTransfer.setData(PALETTE_MIME, entry.kind);
            event.dataTransfer.effectAllowed = 'copy';
          }}
          // Click is the keyboard- and test-friendly equivalent of dragging onto the canvas.
          onClick={() => onCreate(entry.kind)}
        >
          <span className={`${styles.swatch} ${entry.swatch}`} aria-hidden="true" />
          <span className={styles.paletteText}>
            <span className={styles.paletteName}>{entry.name}</span>
            <span className={styles.paletteHint}>{entry.hint}</span>
          </span>
        </button>
      ))}
      <p className={styles.paletteNote}>
        Draw a <strong>relation</strong> by dragging from the right edge of one class to another.
        The direction sets <code>rdfs:domain</code> and <code>rdfs:range</code>.
      </p>
    </div>
  );
}
