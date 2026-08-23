import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Palette, SchemaCanvas, TaxonomyCanvas, frameAll, usePaletteCreate } from '../canvas';
import { HierarchyTree } from '../taxonomytree';
import { ProjectNameField, ProjectSwitcher } from '../projectswitcher';
import { ConnectionPicker, RelationMarkers } from '../relationeditor';
import {
  useCanvasView,
  useOntology,
  useProjectStore,
  useSelection,
  useTaxonomyRelations,
} from '../projectstore';
import type { CanvasView, TaxonomyRelations } from '../projectstore';
import type { EntityRef } from '../ontologymodel';
import { Button, Divider, RelationIcon, Spacer, Switch, Tabs, Toolbar } from '../designsystem';
import { Inspector } from './Inspector';
import {
  schemaEdgeTypes,
  schemaNodeTypes,
  taxonomyEdgeTypes,
  taxonomyNodeTypes,
} from './graphRenderers';
import { useThemePreference } from './useThemePreference';
import { useFullscreen } from './useFullscreen';
import { FOLD_DURATION_MS, usePanelPreference } from './usePanelPreference';
import { useMeasuredHeight } from './useMeasuredHeight';
import type { SidePanel } from './usePanelPreference';
import { useExportAction } from './useExportAction';
import { useDialogAction } from './useDialogAction';
import { OntologyMetadataForm } from '../ontologymetadata';
import { AnnotationSection } from '../annotationpanel';
import { EntitySearch } from '../entitysearch';
import {
  AppMark,
  EntitiesPanelIcon,
  InspectorPanelIcon,
  MetadataIcon,
  PanelsAsideIcon,
  PanelsBackIcon,
  RedoIcon,
  SearchIcon,
  UndoIcon,
} from './icons';
import styles from './appshell.module.css';

/**
 * The application shell: layout, global shortcuts, and the wiring between modules.
 * This is the only file permitted to import from more than one feature module.
 */

/**
 * The one line of prose in the canvas toolbar, which speaks only when it has something to say.
 *
 * The case it exists for is the second: switching the relation layer on with nothing selected
 * draws nothing, because there is no class whose relations to draw. Without a word about it the
 * switch reports a state that has no visible effect, which reads as a control that does not
 * work. It says so here rather than on the canvas, and stops saying it the moment a class is
 * clicked — a message that outlives the condition it describes is worse than none.
 *
 * Selecting something on the person's behalf was the alternative and was turned down: selection
 * opens the inspector, so a drawing option would have slid an editing panel open and changed
 * what they were working on.
 *
 * The taxonomy view used to describe its own layout here whenever it had nothing else to say.
 * That was a caption on a picture that explains itself, sitting in a toolbar where every other
 * character is a control, and it is gone.
 */
function canvasHint(state: {
  view: CanvasView;
  relations: TaxonomyRelations;
  hasSelection: boolean;
}): string {
  if (state.view === 'schema')
    return 'Drag from a class edge to another class to create a relation.';
  if (state.relations === 'selected' && !state.hasSelection) {
    return 'Select a class to see its relations.';
  }
  return '';
}

const VIEW_TABS = [
  { value: 'schema' as const, label: 'Schema' },
  { value: 'taxonomy' as const, label: 'Taxonomy' },
];

export function App() {
  const view = useCanvasView();
  const ontology = useOntology();
  const setView = useProjectStore((state) => state.setView);
  const taxonomyRelations = useTaxonomyRelations();
  const setTaxonomyRelations = useProjectStore((state) => state.setTaxonomyRelations);
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const deleteSelection = useProjectStore((state) => state.deleteSelection);
  const createRelation = useProjectStore((state) => state.createRelation);
  const { create, canCreateAttribute } = usePaletteCreate();
  const { theme, toggleTheme } = useThemePreference();
  const fullscreen = useFullscreen();
  const panels = usePanelPreference();
  /*
   * How far down the drawers start on a narrow screen. They used to start below the header,
   * which put them over the canvas toolbar and its Undo, Redo and Find.
   */
  const { measure: measureToolbar, height: toolbarHeight } = useMeasuredHeight();
  const saving = useExportAction('save');
  const exporting = useExportAction();
  /*
   * Beside the project name rather than in the canvas toolbar: the IRI, prefix, title and
   * licence are properties of the document, and the document's name is already here. The
   * toolbar stays about the canvas.
   */
  const metadata = useDialogAction({
    label: <MetadataIcon />,
    triggerLabel: 'Metadata',
    title: 'Schema metadata',
    testId: 'open-metadata',
    children: (
      <>
        <OntologyMetadataForm />
        <AnnotationSection target={{ kind: 'ontology', id: '' }} />
      </>
    ),
  });
  // Which side panel is showing when the viewport is too narrow for three columns.
  const [drawer, setDrawer] = useState<'none' | 'entities'>('none');
  /*
   * Selecting is what opens the inspector, on every width -- clicking a class is already the
   * gesture that means "tell me about this". On a narrow layout that slides the drawer in; on a
   * wide one the column is already there, unless it has been folded away, and then the
   * selection borrows it for as long as there is something to show. See `useRevealInspector`
   * for what borrowing means and why it is keyed on the selection changing.
   *
   * The same rule on both layouts is a decision, not an accident: a drawer that appears on a
   * phone and a column that appears on a desktop are the same idea at two sizes.
   */
  const selection = useSelection();
  const inspecting = selection !== null;
  useRevealInspector(selection, panels.reveal, panels.conceal);

  /*
   * The whole window for the canvas, and the way back. Folding is what makes the canvas bigger
   * and fitting is what makes the drawing fill it; either on its own leaves half the job undone,
   * which is why they are one gesture rather than two controls.
   *
   * Which way the next press goes is read off the panels themselves rather than remembered. A
   * flag would go stale the moment either panel was folded by its own toggle, or the moment a
   * selection unfolded the inspector -- and a control whose picture disagrees with the window is
   * worse than one with fewer states.
   */
  const bothFolded = panels.isFolded('entities') && panels.isFolded('inspector');
  const toggleBothPanels = () => {
    const move = bothFolded ? panels.show : panels.hide;
    move('entities');
    move('inspector');
    /*
     * Below the breakpoint the left panel is an overlay drawer with a state of its own, which
     * the fold does not reach. Same gesture, same result at both sizes: both panels away, or
     * both back. On a wide layout this line changes nothing anyone can see.
     */
    setDrawer(bothFolded ? 'entities' : 'none');
    /*
     * After the columns have finished moving, not before. React Flow measures the pane at the
     * moment `fitView` is called, so fitting first frames the drawing into a canvas 680px away
     * from the one it lands in. Framing on the way back matters just as much: the canvas has
     * shrunk, and a drawing left at the wider zoom would sit half outside it.
     */
    window.setTimeout(frameAll, FOLD_DURATION_MS + 20);
  };

  /*
   * Ctrl+K, because that is where people look. The dialog has a button too: a shortcut nobody
   * is told about is a feature only its author can use.
   */
  const finding = useDialogAction({
    label: <SearchIcon />,
    triggerLabel: 'Find an entity (Ctrl+K)',
    title: 'Find an entity',
    testId: 'open-search',
    size: 'default',
    children: (close: () => void) => <EntitySearch onChoose={close} />,
  });

  useGlobalShortcuts({
    undo,
    redo,
    deleteSelection,
    find: () => finding.setOpen(true),
    frame: toggleBothPanels,
  });

  const attributeCount = ontology.attributes.length;
  const relationCount = ontology.relations.length;

  return (
    <div
      className={styles.shell}
      style={{ '--canvas-toolbar-height': `${toolbarHeight}px` } as CSSProperties}
      data-drawer={drawer}
      data-inspecting={inspecting}
      data-fold-entities={panels.isFolded('entities')}
      data-fold-inspector={panels.isFolded('inspector')}
    >
      <RelationMarkers />
      <ConnectionPicker />

      <header className={styles.header}>
        <div className={styles.headerSide}>
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
        </div>

        {/*
          The document, in the middle of the bar. Its name and the button that edits everything
          else about it are the same subject, so they travel together.
        */}
        <div className={styles.headerTitle}>
          <ProjectNameField />
          {metadata.action}
        </div>

        <div className={`${styles.headerSide} ${styles.headerEnd}`}>
          <ProjectSwitcher
            extraActions={
              <>
                {saving.action}
                {exporting.action}
              </>
            }
          />
          <Divider />
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
        </div>
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
          <Toolbar ref={measureToolbar} className={styles.canvasToolbar}>
            {/*
              At the ends of the strip, on the side each one folds, so the control points at
              the thing it acts on. Only on a wide layout: below the breakpoint both panels are
              already drawers with toggles of their own.
            */}
            <Button
              size="small"
              variant="subtle"
              iconOnly
              className={styles.foldToggle}
              aria-pressed={!panels.isFolded('entities')}
              aria-controls="ontoschema-entities"
              onClick={() => panels.toggle('entities')}
              aria-label={panels.isFolded('entities') ? 'Show palette' : 'Hide palette'}
              title={panels.isFolded('entities') ? 'Show palette' : 'Hide palette'}
              data-testid="fold-entities"
            >
              <EntitiesPanelIcon />
            </Button>
            <Tabs options={VIEW_TABS} value={view} onChange={setView} ariaLabel="Canvas view" />
            {/*
              Only where it applies. The schema view always draws relations, so the control
              would be present and inert there, which misleads rather than merely fails.

              Ahead of the hint rather than after it, because the hint comes and goes with what
              is selected and a sentence that changes length drags whatever follows it along.
              A control that moves while you are reaching for it is the one thing a toolbar must
              not do; putting it before the prose costs nothing and needs no reserved width.
            */}
            {view === 'taxonomy' ? (
              <Switch
                checked={taxonomyRelations === 'selected'}
                onChange={(on) => setTaxonomyRelations(on ? 'selected' : 'off')}
                label="Show relations"
                data-testid="toggle-relations"
              >
                Show <RelationIcon />
              </Switch>
            ) : null}
            <span className={styles.viewHint} data-testid="canvas-hint">
              {canvasHint({ view, relations: taxonomyRelations, hasSelection: inspecting })}
            </span>
            <Spacer />
            <Button
              size="small"
              variant="subtle"
              iconOnly
              onClick={toggleBothPanels}
              aria-pressed={bothFolded}
              aria-label={bothFolded ? 'Show both panels' : 'Hide both panels'}
              title={
                bothFolded
                  ? 'Show both panels and fit the schema (Shift+F)'
                  : 'Hide both panels and fit the schema (Shift+F)'
              }
              data-testid="fold-both"
            >
              {bothFolded ? <PanelsBackIcon /> : <PanelsAsideIcon />}
            </Button>
            {finding.action}
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
            <Button
              size="small"
              variant="subtle"
              iconOnly
              className={styles.foldToggle}
              aria-pressed={!panels.isFolded('inspector')}
              aria-controls="ontoschema-inspector"
              onClick={() => panels.toggle('inspector')}
              aria-label={panels.isFolded('inspector') ? 'Show inspector' : 'Hide inspector'}
              title={panels.isFolded('inspector') ? 'Show inspector' : 'Hide inspector'}
              data-testid="fold-inspector"
            >
              <InspectorPanelIcon />
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

      {finding.dialog}
      {metadata.dialog}
      {saving.dialog}
      {exporting.dialog}
    </div>
  );
}

/**
 * Selecting an entity opens the inspector, at every width, however it was selected — and
 * deselecting gives the space back if that is all it was open for.
 *
 * On a narrow layout this has always been true: the inspector is a drawer that slides in when
 * something is selected and out again when nothing is. On a wide one the column is simply always
 * there — until todo 30 gave it a folded state, at which point clicking a class put its details
 * in a panel nobody could see. The owner's rule for that case was that the two layouts should
 * behave the same, so a folded inspector is lent to a selection and taken back afterwards.
 *
 * Lent, not opened: `reveal` leaves what the owner asked for alone, so an inspector that was
 * folded is folded again the moment nothing is selected, and is still folded after a reload.
 * A panel that was open all along is untouched by either call.
 *
 * Keyed on the selection *changing*, not on there being one, so clicking from one class to the
 * next does not move the column — that was the measured hazard, and it is the reason this is
 * two edges rather than a condition.
 */
function useRevealInspector(
  selection: EntityRef | null,
  reveal: (panel: SidePanel) => void,
  conceal: (panel: SidePanel) => void,
) {
  const key = selection ? `${selection.kind}:${selection.id}` : null;
  // Seeded with the first value, so a schema that opens with something already selected is not
  // treated as a click that has just happened.
  const previous = useRef(key);

  useEffect(() => {
    if (key === null) conceal('inspector');
    else if (key !== previous.current) reveal('inspector');
    previous.current = key;
  }, [key, reveal, conceal]);
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
  find: () => void;
  frame: () => void;
}) {
  const { undo, redo, deleteSelection, find, frame } = actions;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // A dialog is modal: nothing behind it may be edited or deleted from the keyboard.
      if (isDialogOpen()) return;
      const typing = isTextEntry(target);

      /*
       * Unlike the others, this one fires while typing. Ctrl+K means find wherever you are, and
       * a name field is exactly where you notice you have lost track of something.
       */
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        find();
        return;
      }
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
      /*
       * Shift+F, and it toggles like the button. Bare `f` was turned down: single letters
       * are the keys a future shortcut will want, and one that fires on an ordinary letter has
       * only the typing guard between it and a name field.
       */
      if (event.shiftKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'f') {
        if (typing) return;
        event.preventDefault();
        frame();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && !typing) {
        event.preventDefault();
        deleteSelection();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, deleteSelection, find, frame]);
}
