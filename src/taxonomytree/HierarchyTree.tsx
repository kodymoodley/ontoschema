import { useMemo, useState } from 'react';
import { xsdDatatypeCurie } from '../annotationvocabulary';
import {
  canSubclass,
  canSubproperty,
  classForest,
  attributeList,
  relationForest,
  usagesOfProperty,
} from '../ontologymodel';
import type { Relation, OntologyClass, TaxonomyNode } from '../ontologymodel';
import {
  DRAG_MIME,
  encodeDragPayload,
  useOntology,
  useProjectStore,
  useSelection,
} from '../projectstore';
import { Button, EmptyState, Tabs } from '../designsystem';
import styles from './taxonomytree.module.css';

/**
 * The panel where the property pool lives and taxonomies are built.
 *
 * Classes and object properties are hierarchies, so they get trees: drag a node onto
 * another to re-parent it, or onto empty space to promote it to a root. Datatype properties
 * get a flat list instead — arranging attributes into a taxonomy is rarely meaningful, and
 * the useful question is only which ones exist and where they are used. Dragging one from
 * that list onto a class on the canvas is how a property gets reused.
 */

type PanelTab = 'classes' | 'relations' | 'attributes';

const TABS = [
  { value: 'classes' as const, label: 'Classes' },
  { value: 'relations' as const, label: 'Object props' },
  { value: 'attributes' as const, label: 'Data props' },
];

export function HierarchyTree() {
  const [tab, setTab] = useState<PanelTab>('classes');

  return (
    <>
      <Tabs options={TABS} value={tab} onChange={setTab} ariaLabel="Ontology entities" />
      {tab === 'attributes' ? <AttributePool /> : <HierarchyFor kind={tab} key={tab} />}
      <p className={styles.hint}>
        {tab === 'attributes'
          ? 'Drag a property onto a class on the canvas to use it there. The same property can be used on any number of classes.'
          : 'Drag an item onto another to make it a subclass; drop it on empty space to promote it to a root.'}
      </p>
    </>
  );
}

/* ----------------------------------------------------------- hierarchies */

function HierarchyFor({ kind }: { kind: 'classes' | 'relations' }) {
  const ontology = useOntology();
  const selection = useSelection();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const select = useProjectStore((state) => state.select);
  const createClass = useProjectStore((state) => state.createClass);
  const createRelation = useProjectStore((state) => state.createRelation);
  const reparentClass = useProjectStore((state) => state.reparentClass);
  const reparentRelation = useProjectStore((state) => state.reparentRelation);
  const deleteClass = useProjectStore((state) => state.deleteClassById);
  const deleteRelation = useProjectStore((state) => state.deleteRelationById);

  const classes = useMemo(() => classForest(ontology), [ontology]);
  const properties = useMemo(() => relationForest(ontology), [ontology]);

  const isClasses = kind === 'classes';
  const forest: TaxonomyNode<OntologyClass | Relation>[] = isClasses ? classes : properties;
  const selectableKind = isClasses ? 'class' : 'relation';
  const hasSelection = selection?.kind === selectableKind;

  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canDrop = (childId: string, parentId: string) =>
    isClasses
      ? canSubclass(ontology, childId, parentId)
      : canSubproperty(ontology, childId, parentId);

  const reparent = (childId: string, parentId: string | null) =>
    isClasses ? reparentClass(childId, parentId) : reparentRelation(childId, parentId);

  const addRoot = () => (isClasses ? createClass() : createRelation());

  const addChild = () => {
    const parentId = selection?.id;
    const id = isClasses ? createClass() : createRelation();
    if (parentId && hasSelection && id) reparent(id, parentId);
  };

  const removeSelected = () => {
    if (!selection || !hasSelection) return;
    if (isClasses) deleteClass(selection.id);
    else deleteRelation(selection.id);
  };

  const renderNode = (node: TaxonomyNode<OntologyClass | Relation>) => {
    const { entity, children } = node;
    const isCollapsed = collapsed.has(entity.id);
    const isSelected = selection?.kind === selectableKind && selection.id === entity.id;
    const uses = isClasses ? null : usagesOfProperty(ontology, entity.id).length;

    return (
      <div className={styles.node} key={`${entity.id}:${node.depth}`}>
        <div
          className={[
            styles.row,
            isSelected ? styles.rowSelected : '',
            dropTarget === entity.id ? styles.rowDropTarget : '',
            dragging === entity.id ? styles.dragging : '',
          ]
            .filter(Boolean)
            .join(' ')}
          role="treeitem"
          aria-selected={isSelected}
          aria-expanded={children.length > 0 ? !isCollapsed : undefined}
          tabIndex={0}
          data-tree-item={entity.localName}
          draggable
          onClick={() => select({ kind: selectableKind, id: entity.id })}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              select({ kind: selectableKind, id: entity.id });
            }
          }}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            setDragging(entity.id);
          }}
          onDragEnd={() => {
            setDragging(null);
            setDropTarget(null);
          }}
          onDragOver={(event) => {
            if (!dragging || dragging === entity.id || !canDrop(dragging, entity.id)) return;
            event.preventDefault();
            setDropTarget(entity.id);
          }}
          onDragLeave={() => setDropTarget((current) => (current === entity.id ? null : current))}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (dragging && dragging !== entity.id && canDrop(dragging, entity.id)) {
              reparent(dragging, entity.id);
            }
            setDragging(null);
            setDropTarget(null);
          }}
        >
          {children.length > 0 ? (
            <button
              type="button"
              className={`${styles.twisty} ${isCollapsed ? '' : styles.twistyOpen}`}
              aria-label={
                isCollapsed ? `Expand ${entity.localName}` : `Collapse ${entity.localName}`
              }
              onClick={(event) => {
                event.stopPropagation();
                toggle(entity.id);
              }}
            >
              ▶
            </button>
          ) : (
            <span className={styles.twistySpacer} />
          )}
          <span className={styles.label}>{entity.localName}</span>
          {uses !== null ? (
            <span className={uses === 0 ? styles.unusedCount : styles.count}>
              {uses === 0 ? 'unused' : `${uses}×`}
            </span>
          ) : null}
          {children.length > 0 ? <span className={styles.count}>{children.length}</span> : null}
        </div>

        {children.length > 0 && !isCollapsed ? (
          <div className={styles.children}>{children.map(renderNode)}</div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <div className={styles.toolbar}>
        <Button size="small" onClick={addRoot}>
          + Root
        </Button>
        <Button size="small" onClick={addChild} disabled={!hasSelection}>
          + Child
        </Button>
        <Button size="small" variant="danger" onClick={removeSelected} disabled={!hasSelection}>
          Delete
        </Button>
      </div>

      {forest.length === 0 ? (
        <EmptyState>
          {isClasses
            ? 'No classes yet. Add one here or drag a class onto the canvas.'
            : 'No object properties yet. Add one here, then draw an edge between two classes to use it.'}
        </EmptyState>
      ) : (
        <div
          className={styles.tree}
          role="tree"
          aria-label={isClasses ? 'Class hierarchy' : 'Object property hierarchy'}
          // Dropping into the blank area below the tree promotes a node to a root.
          onDragOver={(event) => {
            if (dragging) event.preventDefault();
          }}
          onDrop={() => {
            if (dragging) reparent(dragging, null);
            setDragging(null);
            setDropTarget(null);
          }}
        >
          {forest.map(renderNode)}
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------- datatype property pool */

function AttributePool() {
  const ontology = useOntology();
  const selection = useSelection();
  const select = useProjectStore((state) => state.select);
  const deleteProperty = useProjectStore((state) => state.deleteAttributeById);

  const properties = useMemo(() => attributeList(ontology), [ontology]);
  const selected = selection?.kind === 'attribute' ? selection.id : null;

  return (
    <>
      <div className={styles.toolbar}>
        <Button
          size="small"
          variant="danger"
          onClick={() => selected && deleteProperty(selected)}
          disabled={selected === null}
        >
          Delete
        </Button>
      </div>

      {properties.length === 0 ? (
        <EmptyState>
          No datatype properties yet. Drop one from the palette onto a class, or add one from a
          class in the inspector.
        </EmptyState>
      ) : (
        <ul className={styles.pool} aria-label="Datatype properties">
          {properties.map((property) => {
            const uses = usagesOfProperty(ontology, property.id).length;
            return (
              <li key={property.id}>
                <div
                  className={`${styles.poolRow} ${selected === property.id ? styles.rowSelected : ''}`}
                  role="button"
                  tabIndex={0}
                  draggable
                  data-datatype-property={property.localName}
                  title={`Drag ${property.localName} onto a class to use it there`}
                  onClick={() => select({ kind: 'attribute', id: property.id })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      select({ kind: 'attribute', id: property.id });
                    }
                  }}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      DRAG_MIME,
                      encodeDragPayload({ kind: 'existingAttribute', propertyId: property.id }),
                    );
                    event.dataTransfer.effectAllowed = 'copy';
                  }}
                >
                  <span className={styles.poolMarker} aria-hidden="true" />
                  <span className={styles.label}>{property.localName}</span>
                  <span className={styles.poolRange}>{xsdDatatypeCurie(property.range)}</span>
                  <span className={uses === 0 ? styles.unusedCount : styles.count}>
                    {uses === 0 ? 'unused' : `${uses}×`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
