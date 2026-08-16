import { DRAG_MIME, encodeDragPayload } from '../projectstore';
import styles from './canvas.module.css';

/**
 * What can be brought onto the canvas.
 *
 * Classes and datatype properties are dragged. An object property is *created*, not
 * dragged: it lives in the property pool until it is used between two classes, at which
 * point it appears as an edge. There is no such thing as a property floating on the canvas.
 */

interface PaletteEntry {
  kind: 'class' | 'attribute';
  name: string;
  hint: string;
  swatch: string;
}

const DRAGGABLE: PaletteEntry[] = [
  {
    kind: 'class',
    name: 'Class',
    hint: 'A kind of thing e.g., Car, Dealership. Drag onto canvas.',
    swatch: styles.swatchClass ?? '',
  },
  {
    kind: 'attribute',
    name: 'Datatype property',
    hint: 'An attribute with an xsd range e.g., make, year. Must be dropped onto a class.',
    swatch: styles.swatchAttribute ?? '',
  },
];

interface PaletteProps {
  /** Click fallback for the draggable entries; the attribute needs a selected class. */
  onCreate: (kind: 'class' | 'attribute') => void;
  onCreateRelation: () => void;
  /** A datatype property can only be created against a class. */
  canCreateAttribute: boolean;
}

export function Palette({ onCreate, onCreateRelation, canCreateAttribute }: PaletteProps) {
  return (
    <div className={styles.palette}>
      {DRAGGABLE.map((entry) => {
        const disabled = entry.kind === 'attribute' && !canCreateAttribute;
        return (
          <button
            key={entry.kind}
            type="button"
            className={styles.paletteItem}
            draggable
            data-palette-kind={entry.kind}
            aria-label={`Add ${entry.name}`}
            onDragStart={(event) => {
              event.dataTransfer.setData(
                DRAG_MIME,
                encodeDragPayload({ kind: entry.kind === 'class' ? 'newClass' : 'newAttribute' }),
              );
              event.dataTransfer.effectAllowed = 'copy';
            }}
            // Click is the keyboard- and test-friendly equivalent of dragging onto the canvas.
            onClick={() => onCreate(entry.kind)}
            disabled={disabled}
            title={
              disabled
                ? 'Select a class first — a datatype property must belong to one.'
                : undefined
            }
          >
            <span className={`${styles.swatch} ${entry.swatch}`} aria-hidden="true" />
            <span className={styles.paletteText}>
              <span className={styles.paletteName}>{entry.name}</span>
              <span className={styles.paletteHint}>{entry.hint}</span>
            </span>
          </button>
        );
      })}

      <button
        type="button"
        className={styles.paletteItem}
        data-palette-kind="relation"
        aria-label="Add Object property"
        onClick={onCreateRelation}
      >
        <span className={`${styles.swatch} ${styles.swatchGeneric}`} aria-hidden="true" />
        <span className={styles.paletteText}>
          <span className={styles.paletteName}>Object property</span>
          <span className={styles.paletteHint}>
            Reusable e.g., hasPart, isRelatedTo. Added to the property list; draw it between two
            classes to use it.
          </span>
        </span>
      </button>
    </div>
  );
}
