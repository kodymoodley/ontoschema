import { Fragment, useState } from 'react';
import { Handle, Position, useConnection } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { xsdDatatypeLabel } from '../annotationvocabulary';
import { nameProblem } from '../ontologymodel';
import type { Attribute, NamedKind, OntologyClass } from '../ontologymodel';
import { useDoubleTap } from '../designsystem';
import { activeOntology, useProjectStore } from '../projectstore';
import { InlineName } from './InlineName';
import styles from './classeditor.module.css';

/**
 * The class shape on the schema canvas: a header carrying the local name, the superclass
 * it sits under, and its attributes rendered as typed rows inside the box.
 *
 * Double-clicking the header renames in place; the full editing surface is the inspector.
 */

interface AttributeRow {
  usageId: string;
  property: Attribute;
  /** How many other classes carry this same property. */
  usedOnOtherClasses: number;
}

/*
 * Why a name typed on the canvas cannot be had. The schema is read when the question is asked
 * rather than subscribed to, so a class does not re-render for every edit anywhere else.
 */
function problemWith(kind: NamedKind, draft: string, except: string): string | undefined {
  const ontology = activeOntology(useProjectStore.getState());
  return ontology ? nameProblem(ontology, kind, draft, except) : undefined;
}

interface ClassNodeData {
  entity: OntologyClass;
  attributes: AttributeRow[];
  superClassNames: string[];
}

/** Handle ids match what `canvas/layout.ts` chooses when it routes an edge. */
const SIDES = [
  { side: 'left', position: Position.Left, zone: styles.dropLeft },
  { side: 'right', position: Position.Right, zone: styles.dropRight },
  { side: 'top', position: Position.Top, zone: styles.dropTop },
  { side: 'bottom', position: Position.Bottom, zone: styles.dropBottom },
] as const;

export function ClassNode({ data, selected }: NodeProps) {
  const { entity, attributes, superClassNames } = data as unknown as ClassNodeData;
  const renameClass = useProjectStore((state) => state.renameClassById);
  const focusClass = useProjectStore((state) => state.focusClass);

  // Whether a relation is being drawn or moved anywhere, which is when this class can take one.
  const connecting = useConnection((connection) => connection.inProgress);
  const [editingName, setEditingName] = useState(false);
  const [editingUsageId, setEditingUsageId] = useState<string | null>(null);

  return (
    <div
      className={`${styles.classNode} ${selected ? styles.selected : ''} ${connecting ? styles.connecting : ''}`}
      data-class-node-id={entity.id}
      data-class-name={entity.localName}
      data-testid={`class-node-${entity.localName}`}
      // Double-click, or double-tap, anywhere but the header brings this class into focus.
      // The header keeps the gesture for renaming in place and stops it propagating here.
      onDoubleClick={() => focusClass(entity.id)}
    >
      {/*
        A dot on every side to draw a relation from, so it can leave wherever the two classes
        face each other rather than always looping right-to-left.

        And the whole class to let it go on. Each side's target covers the band of the class
        along that side, and one more covers the middle, so wherever the pointer is over the
        class there is something under it: React Flow takes the target under the pointer before
        the nearest one. Letting go near a side pins the line there; letting go over the middle
        leaves it free, routed to whichever side faces the other class. The targets take the
        pointer only while a relation is being drawn, so the rest of the time they are not
        there at all.
      */}
      {SIDES.map(({ side, position, zone }) => (
        <Fragment key={side}>
          <Handle
            type="source"
            position={position}
            id={`source-${side}`}
            isConnectable
            className={styles.sourceHandle}
          />
          <Handle
            type="target"
            position={position}
            id={`target-${side}`}
            isConnectableStart={false}
            className={`${styles.dropZone} ${zone}`}
          />
        </Fragment>
      ))}
      <Handle
        type="target"
        position={Position.Top}
        id="target-middle"
        isConnectableStart={false}
        className={`${styles.dropZone} ${styles.dropMiddle}`}
      />

      {/*
        The header owns no gesture of its own. Renaming belongs to the name itself, so the rest
        of the strip is free for the double-click that zooms to the class -- which had almost
        nowhere to land before, since the header, every attribute row and the relation labels
        each claimed their own area and left only the footer.
      */}
      <header className={styles.header}>
        <span className={styles.marker} aria-hidden="true" />
        <InlineName
          value={entity.localName}
          validate={(draft) => problemWith('class', draft, entity.id)}
          onCommit={(draft) => renameClass(entity.id, draft)}
          label="Class name"
          textClassName={styles.name}
          inputClassName={styles.nameInput}
          onTextDoubleClick={(event) => {
            event.stopPropagation();
            setEditingName(true);
          }}
          editing={editingName}
          onEditingChange={setEditingName}
        />
      </header>

      {superClassNames.length > 0 ? (
        <div className={styles.superclass}>⊂ {superClassNames.join(', ')}</div>
      ) : null}

      <div className={styles.attributes}>
        {attributes.length === 0 ? (
          <p className={styles.emptyAttributes}>Drop an attribute here.</p>
        ) : (
          attributes.map((row) => (
            <AttributeItem
              key={row.usageId}
              row={row}
              editing={editingUsageId === row.usageId}
              onEditingChange={(open) => setEditingUsageId(open ? row.usageId : null)}
            />
          ))
        )}
      </div>

      <footer className={styles.footer}>
        <span>
          {attributes.length} {attributes.length === 1 ? 'attribute' : 'attributes'}
        </span>
        {entity.annotations.length > 0 ? (
          <span className={styles.annotationCount}>{entity.annotations.length} annotations</span>
        ) : null}
      </footer>
    </div>
  );
}

/**
 * One attribute inside a class box.
 *
 * A single click selects the property; a double-click renames it here rather than sending you
 * to the inspector. The gesture has to be stopped from reaching the node, which answers a
 * double-click by zooming — before this, double-clicking a row zoomed the canvas instead.
 *
 * Renaming reaches every class holding the property, because the property is one thing in a
 * shared pool. The field says so while it is open, since the other classes are usually not on
 * screen to be noticed changing.
 */
interface AttributeItemProps {
  row: AttributeRow;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}

function AttributeItem({ row, editing, onEditingChange }: AttributeItemProps) {
  const select = useProjectStore((state) => state.select);
  const renameProperty = useProjectStore((state) => state.renameAttributeById);

  /*
   * A double-tap has to be recognised by hand. A node is draggable, so React Flow calls
   * preventDefault on its touch events, and only Chromium still synthesises a double-click
   * from two taps. Firefox and WebKit do not, which would leave this gesture working with a
   * mouse and silently doing nothing on a phone.
   */
  const doubleTap = useDoubleTap(() => onEditingChange(true));

  const elsewhere = row.usedOnOtherClasses;
  const shared = elsewhere > 0;
  const range = (
    <span className={styles.attributeRange}>{xsdDatatypeLabel(row.property.range)}</span>
  );

  if (editing) {
    return (
      <div
        className={styles.attribute}
        data-attribute-name={row.property.localName}
        data-usage-id={row.usageId}
      >
        <span className={styles.attributeMarker} aria-hidden="true" />
        <InlineName
          value={row.property.localName}
          validate={(draft) => problemWith('attribute', draft, row.property.id)}
          onCommit={(draft) => renameProperty(row.property.id, draft)}
          label="Attribute name"
          textClassName={styles.attributeName}
          inputClassName={styles.attributeNameInput}
          {...(shared ? { hint: `↗ ${elsewhere} more` } : {})}
          editing
          onEditingChange={onEditingChange}
        />
        {/*
          The range takes the trailing slot when idle and the warning takes it while editing.
          Showing both would squeeze the field in a box only 224px wide, and which class a
          property points at matters less mid-rename than how many classes the rename reaches.
        */}
        {shared ? null : range}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={styles.attribute}
      data-attribute-name={row.property.localName}
      data-usage-id={row.usageId}
      title={
        shared ? `${row.property.localName} is also used on other classes` : row.property.localName
      }
      onClick={(event) => {
        event.stopPropagation();
        select({ kind: 'attribute', id: row.property.id });
      }}
      onDoubleClick={(event) => {
        // The node zooms on a double-click; this one belongs to the row.
        event.stopPropagation();
        onEditingChange(true);
      }}
      ref={doubleTap}
      onKeyDown={(event) => {
        // F2 renames in place, the same convention as a file manager, so the gesture is not
        // reachable only with a mouse.
        if (event.key !== 'F2') return;
        event.preventDefault();
        onEditingChange(true);
      }}
    >
      <span className={styles.attributeMarker} aria-hidden="true" />
      <span className={styles.attributeName}>{row.property.localName}</span>
      {shared ? (
        <span className={styles.sharedMark} aria-label="shared">
          ↗
        </span>
      ) : null}
      {range}
    </button>
  );
}
