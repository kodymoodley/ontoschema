import { useEffect, useState } from 'react';
import { Palette, SchemaCanvas, TaxonomyCanvas, usePaletteCreate } from '../canvas';
import { HierarchyTree } from '../taxonomytree';
import { ProjectNameField, ProjectSwitcher } from '../projectswitcher';
import { ConnectionPicker, RelationMarkers } from '../relationeditor';
import { useCanvasView, useOntology, useProjectStore } from '../projectstore';
import { Button, Divider, Spacer, Tabs, Toolbar } from '../designsystem';
import { Inspector } from './Inspector';
import {
  schemaEdgeTypes,
  schemaNodeTypes,
  taxonomyEdgeTypes,
  taxonomyNodeTypes,
} from './graphRenderers';
import { useThemePreference } from './useThemePreference';
import { useFullscreen } from './useFullscreen';
import { useExportAction } from './useExportAction';
import { AppMark, RedoIcon, UndoIcon } from './icons';
import styles from './appshell.module.css';

/**
 * The application shell: layout, global shortcuts, and the wiring between modules.
 * This is the only file permitted to import from more than one feature module.
 */

const VIEW_TABS = [
  { value: 'schema' as const, label: 'Schema' },
  { value: 'taxonomy' as const, label: 'Taxonomy' },
];

export function App() {
  const view = useCanvasView();
  const ontology = useOntology();
  const setView = useProjectStore((state) => state.setView);
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const deleteSelection = useProjectStore((state) => state.deleteSelection);
  const createRelation = useProjectStore((state) => state.createRelation);
  const { create, canCreateAttribute } = usePaletteCreate();
  const { theme, toggleTheme } = useThemePreference();
  const fullscreen = useFullscreen();
  const saving = useExportAction('save');
  const exporting = useExportAction();
  // Which side panel is showing when the viewport is too narrow for three columns.
  const [drawer, setDrawer] = useState<'none' | 'entities' | 'inspector'>('none');

  useGlobalShortcuts({ undo, redo, deleteSelection });

  const attributeCount = ontology.attributes.length;
  const relationCount = ontology.relations.length;

  return (
    <div className={styles.shell} data-drawer={drawer}>
      <RelationMarkers />
      <ConnectionPicker />

      <header className={styles.header}>
        <div className={styles.brand}>
          <AppMark />
          <span className={styles.brandName}>OntoSchema</span>
        </div>

        {/*
          Below the three-column breakpoint the side panels become drawers. The toggles are
          always in the DOM and always operable — CSS only decides whether they are shown —
          so the narrow layout needs no separate keyboard story.
        */}
        <Button
          size="small"
          variant="subtle"
          className={styles.drawerToggle}
          aria-expanded={drawer === 'entities'}
          aria-controls="ontoschema-entities"
          onClick={() => setDrawer((current) => (current === 'entities' ? 'none' : 'entities'))}
          aria-label="Entities"
          title="Entities"
        >
          {/*
            The mark itself is the button on this layout. It was a separate control beside the
            logo, and once the logo became the app's own mark the two sat inches apart looking
            almost the same. One of them had to go, and the one carrying meaning is the mark.
          */}
          <AppMark />
        </Button>
        <ProjectNameField />
        <Spacer />
        <ProjectSwitcher
          extraActions={
            <>
              {saving.action}
              {exporting.action}
            </>
          }
        />
        <Divider />
        <Button
          size="small"
          variant="subtle"
          className={styles.drawerToggle}
          aria-expanded={drawer === 'inspector'}
          aria-controls="ontoschema-inspector"
          onClick={() => setDrawer((current) => (current === 'inspector' ? 'none' : 'inspector'))}
        >
          Inspector
        </Button>
        {/*
          Only drawn where it can work. Safari on iOS allows fullscreen for video and nothing
          else, and an app launched from the home screen has no chrome left to hide; in both
          cases the button would be present and inert, which misleads rather than merely fails.
        */}
        {fullscreen.offered ? (
          <Button
            size="small"
            variant="subtle"
            onClick={fullscreen.toggle}
            aria-pressed={fullscreen.active}
            aria-label={fullscreen.active ? 'Leave full screen' : 'Fill the screen'}
            title={fullscreen.active ? 'Leave full screen' : 'Fill the screen'}
          >
            {fullscreen.active ? '⤡' : '⤢'}
          </Button>
        ) : null}
        <Button
          size="small"
          variant="subtle"
          onClick={toggleTheme}
          aria-label="Toggle colour theme"
          title="Toggle colour theme"
        >
          {theme === 'dark' ? '☾' : '☀'}
        </Button>
      </header>

      <div className={styles.body}>
        <aside id="ontoschema-entities" className={styles.left} aria-label="Palette and hierarchy">
          <h2 className={styles.sectionTitle}>Palette</h2>
          <div className={styles.sectionBody}>
            {/*
              Creating from the palette closes the drawer, because on a narrow viewport the
              drawer covers the canvas the new shape has just landed on.
            */}
            <Palette
              onCreate={(kind) => {
                create(kind);
                setDrawer('none');
              }}
              onCreateRelation={() => {
                createRelation();
                setDrawer('none');
              }}
              canCreateAttribute={canCreateAttribute}
            />
          </div>
          <h2 className={styles.sectionTitle}>Entities</h2>
          <div className={styles.scroll}>
            <div className={styles.sectionBody}>
              <HierarchyTree />
            </div>
          </div>
        </aside>

        {/*
          Touching the canvas puts a drawer away. A drawer covers the thing being worked on, so
          reaching past it to the canvas is a clear enough signal that it is no longer wanted --
          and having to find the toggle again to dismiss it is the sort of small tax that makes an
          interface feel stubborn. Captured on the way down so the canvas still receives the same
          gesture: this closes the drawer, it does not swallow the click.
        */}
        <main
          className={styles.center}
          onPointerDownCapture={() => {
            if (drawer !== 'none') setDrawer('none');
          }}
        >
          <Toolbar className={styles.canvasToolbar}>
            <Tabs options={VIEW_TABS} value={view} onChange={setView} ariaLabel="Canvas view" />
            <span className={styles.viewHint}>
              {view === 'schema'
                ? 'Drag from a class edge to another class to create a relation.'
                : 'Laid out automatically — one module per root class, superclasses above.'}
            </span>
            <Spacer />
            <Button
              size="small"
              variant="subtle"
              iconOnly
              onClick={undo}
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
            >
              <UndoIcon />
            </Button>
            <Button
              size="small"
              variant="subtle"
              iconOnly
              onClick={redo}
              aria-label="Redo"
              title="Redo (Ctrl+Shift+Z)"
            >
              <RedoIcon />
            </Button>
          </Toolbar>

          {view === 'schema' ? (
            <SchemaCanvas nodeTypes={schemaNodeTypes} edgeTypes={schemaEdgeTypes} />
          ) : (
            <TaxonomyCanvas nodeTypes={taxonomyNodeTypes} edgeTypes={taxonomyEdgeTypes} />
          )}

          <div className={styles.statusBar}>
            <span className={styles.statusItem}>
              <span className={`${styles.statusDot} ${styles.dotClass}`} />
              {ontology.classes.length} classes
            </span>
            <span className={styles.statusItem}>
              <span className={`${styles.statusDot} ${styles.dotRelation}`} />
              {relationCount} relations
            </span>
            <span className={styles.statusItem}>
              <span className={`${styles.statusDot} ${styles.dotAttribute}`} />
              {attributeCount} attributes
            </span>
            <Spacer />
            <span>
              {ontology.prefix}: {ontology.iri}
            </span>
          </div>
        </main>

        <Inspector />
      </div>

      {saving.dialog}
      {exporting.dialog}
    </div>
  );
}

/**
 * Undo, redo and delete are global gestures, but must not fire while the user is typing
 * into a field — otherwise Ctrl+Z in a text box would roll back the model instead of the
 * text, and Delete would remove the selected class mid-word.
 */
/** True when the key event lands in something the user is typing into. */
export function isTextEntry(target: HTMLElement | null): boolean {
  if (!target) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

/**
 * Dialogs are portalled to the body, so one query answers "is anything modal on screen".
 * Without this, Delete or Backspace typed into an open dialog reaches the canvas behind it
 * and removes the selected class.
 */
export function isDialogOpen(): boolean {
  return typeof document !== 'undefined' && document.querySelector('[role="dialog"]') !== null;
}

function useGlobalShortcuts(actions: {
  undo: () => void;
  redo: () => void;
  deleteSelection: () => void;
}) {
  const { undo, redo, deleteSelection } = actions;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // A dialog is modal: nothing behind it may be edited or deleted from the keyboard.
      if (isDialogOpen()) return;
      const typing = isTextEntry(target);

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        if (typing) return;
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        if (typing) return;
        event.preventDefault();
        redo();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && !typing) {
        event.preventDefault();
        deleteSelection();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, deleteSelection]);
}
