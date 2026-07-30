import { useMemo, useState } from 'react';
import { canSubclass, canSubproperty, classForest, objectPropertyForest } from '../ontologymodel';
import type { ObjectProperty, OntologyClass, TaxonomyNode } from '../ontologymodel';
import { useOntology, useProjectStore, useSelection } from '../projectstore';
import { Button, EmptyState, Tabs } from '../designsystem';
import styles from './taxonomytree.module.css';

/**
 * The Protégé-style hierarchy panel: the place where taxonomies are actually built.
 *
 * Classes and object properties each get a tab. A node can be dragged onto another to
 * re-parent it, or onto the empty area below to become a root. Datatype properties are
 * deliberately absent — they belong to their class, not to a hierarchy of their own.
 */

type TreeTab = 'classes' | 'objectProperties';

const TABS = [
  { value: 'classes' as const, label: 'Classes' },
  { value: 'objectProperties' as const, label: 'Object properties' },
];

export function HierarchyTree() {
  const ontology = useOntology();
  const selection = useSelection();
  const [tab, setTab] = useState<TreeTab>('classes');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const select = useProjectStore((state) => state.select);
  const createClass = useProjectStore((state) => state.createClass);
  const createObjectProperty = useProjectStore((state) => state.createObjectProperty);
  const reparentClass = useProjectStore((state) => state.reparentClass);
  const reparentObjectProperty = useProjectStore((state) => state.reparentObjectProperty);
  const deleteClass = useProjectStore((state) => state.deleteClassById);
  const deleteObjectProperty = useProjectStore((state) => state.deleteObjectPropertyById);

  const classes = useMemo(() => classForest(ontology), [ontology]);
  const properties = useMemo(() => objectPropertyForest(ontology), [ontology]);

  const isClasses = tab === 'classes';
  const forest: TaxonomyNode<OntologyClass | ObjectProperty>[] = isClasses ? classes : properties;

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
    isClasses ? reparentClass(childId, parentId) : reparentObjectProperty(childId, parentId);

  const addSibling = () => {
    if (isClasses) createClass();
    else createObjectProperty({ kind: 'generic' });
  };

  const addChild = () => {
    const parentId = selection?.id;
    if (isClasses) {
      const id = createClass();
      if (parentId && selection?.kind === 'class' && id) reparentClass(id, parentId);
    } else {
      const id = createObjectProperty({ kind: 'generic' });
      if (parentId && selection?.kind === 'objectProperty' && id) {
        reparentObjectProperty(id, parentId);
      }
    }
  };

  const removeSelected = () => {
    if (!selection) return;
    if (isClasses && selection.kind === 'class') deleteClass(selection.id);
    if (!isClasses && selection.kind === 'objectProperty') deleteObjectProperty(selection.id);
  };

  const selectableKind = isClasses ? 'class' : 'objectProperty';
  const hasSelection = selection?.kind === selectableKind;

  const renderNode = (node: TaxonomyNode<OntologyClass | ObjectProperty>) => {
    const { entity, children } = node;
    const isCollapsed = collapsed.has(entity.id);
    const isSelected = selection?.kind === selectableKind && selection.id === entity.id;

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
      <Tabs options={TABS} value={tab} onChange={setTab} ariaLabel="Hierarchy" />

      <div className={styles.toolbar} style={{ margin: 'var(--space-2) 0' }}>
        <Button size="small" onClick={addSibling}>
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
            : 'No object properties yet. Draw a relation between two classes, or add a generic property.'}
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

      <p className={styles.hint}>
        Drag an item onto another to make it a subclass; drop it on empty space to promote it to a
        root.
      </p>
    </>
  );
}
