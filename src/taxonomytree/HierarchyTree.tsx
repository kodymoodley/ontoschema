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
import { AddChildIcon, AddRootIcon, DeleteIcon } from './icons';
import styles from './taxonomytree.module.css';

/**
 * The panel where the property pool lives and taxonomies are built.
 *
 * Classes and relations are hierarchies, so they get trees: drag a node onto
 * another to re-parent it, or onto empty space to promote it to a root. Attributes
 * get a flat list instead — arranging attributes into a taxonomy is rarely meaningful, and
 * the useful question is only which ones exist and where they are used. Dragging one from
 * that list onto a class on the canvas is how a property gets reused.
 */

type PanelTab = 'classes' | 'relations' | 'attributes';

const TABS = [
  { value: 'classes' as const, label: 'Classes' },
  { value: 'relations' as const, label: 'Relations' },
  { value: 'attributes' as const, label: 'Attributes' },
];

export function HierarchyTree() {
  const [tab, setTab] = useState<PanelTab>('classes');

  return (
    <>
      <Tabs options={TABS} value={tab} onChange={setTab} ariaLabel="Ontology entities" />
      {tab === 'attributes' ? <AttributePool /> : <HierarchyFor kind={tab} key={tab} />}
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

  /*
   * Named for the tree they belong to. This component renders both the class hierarchy and the
   * relation hierarchy, and "Add child" alone would be ambiguous between them once the word is
   * only in a tooltip.
   *
   * "selected" is in the delete labels to keep them distinct from the inspector's own "Delete
   * class", which acts on the same thing from elsewhere. Two buttons answering to one name is a
   * problem for anyone navigating by name, and it broke three tests that meant the other one.
   */
  const label = isClasses
    ? { root: 'Add root class', child: 'Add child class', remove: 'Delete selected class' }
    : {
        root: 'Add root relation',
        child: 'Add child relation',
        remove: 'Delete selected relation',
      };

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
      {/*
        Icons rather than words, because three labelled buttons took most of a narrow panel. Each
        keeps a name and a tooltip: an icon alone would leave the two "add" buttons looking like
        the same button twice, and would say nothing at all to a screen reader.
      */}
      <div className={styles.toolbar}>
        <Button size="small" iconOnly onClick={addRoot} aria-label={label.root} title={label.root}>
          <AddRootIcon />
        </Button>
        <Button
          size="small"
          iconOnly
          onClick={addChild}
          disabled={!hasSelection}
          aria-label={label.child}
          title={label.child}
        >
          <AddChildIcon />
        </Button>
        <Button
          size="small"
          iconOnly
          variant="danger"
          onClick={removeSelected}
          disabled={!hasSelection}
          aria-label={label.remove}
          title={label.remove}
        >
          <DeleteIcon />
        </Button>
      </div>

      {forest.length === 0 ? (
        <EmptyState>
          {isClasses
            ? 'No classes yet. Add one here or drag a class onto the canvas.'
            : 'No relations yet. Add one here, then draw an edge between two classes to use it.'}
        </EmptyState>
      ) : (
        <div
          className={styles.tree}
          role="tree"
          aria-label={isClasses ? 'Class hierarchy' : 'Relation hierarchy'}
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

/* -------------------------------------------------- attribute pool */

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
          iconOnly
          variant="danger"
          onClick={() => selected && deleteProperty(selected)}
          disabled={selected === null}
          aria-label="Delete attribute"
          title="Delete attribute"
        >
          <DeleteIcon />
        </Button>
      </div>

      {properties.length === 0 ? (
        <EmptyState>
          No attributes yet. Drop one from the palette onto a class, or add one from a class in the
          inspector.
        </EmptyState>
      ) : (
        <ul className={styles.pool} aria-label="Attributes">
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
