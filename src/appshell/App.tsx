import { useEffect } from 'react';
import { Palette, SchemaCanvas, TaxonomyCanvas, useSpawnAtFreeSpot } from '../canvas';
import { HierarchyTree } from '../taxonomytree';
import { ProjectNameField, ProjectSwitcher } from '../projectswitcher';
import { LanguageTagSuggestions } from '../annotationpanel';
import { RelationMarkers } from '../relationeditor';
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
  const spawn = useSpawnAtFreeSpot();
  const { theme, toggleTheme } = useThemePreference();

  useGlobalShortcuts({ undo, redo, deleteSelection });

  const attributeCount = ontology.datatypeProperties.length;
  const relationCount = ontology.objectProperties.length;

  return (
    <div className={styles.shell}>
      <RelationMarkers />
      <LanguageTagSuggestions />

      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            OS
          </span>
          <span className={styles.brandName}>OntoSchema</span>
        </div>
        <ProjectNameField />
        <Spacer />
        <ProjectSwitcher />
        <Divider />
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
        <aside className={styles.left} aria-label="Palette and hierarchy">
          <h2 className={styles.sectionTitle}>Palette</h2>
          <div className={styles.sectionBody}>
            <Palette onCreate={spawn} />
          </div>
          <h2 className={styles.sectionTitle}>Hierarchy</h2>
          <div className={styles.scroll}>
            <div className={styles.sectionBody}>
              <HierarchyTree />
            </div>
          </div>
        </aside>

        <main className={styles.center}>
          <Toolbar className={styles.canvasToolbar}>
            <Tabs options={VIEW_TABS} value={view} onChange={setView} ariaLabel="Canvas view" />
            <span className={styles.viewHint}>
              {view === 'schema'
                ? 'Drag from a class edge to another class to create a relation.'
                : 'Laid out automatically — one module per root class, superclasses above.'}
            </span>
            <Spacer />
            <Button size="small" variant="subtle" onClick={undo} title="Undo (Ctrl+Z)">
              Undo
            </Button>
            <Button size="small" variant="subtle" onClick={redo} title="Redo (Ctrl+Shift+Z)">
              Redo
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
              {relationCount} object properties
            </span>
            <span className={styles.statusItem}>
              <span className={`${styles.statusDot} ${styles.dotAttribute}`} />
              {attributeCount} datatype properties
            </span>
            <Spacer />
            <span>
              {ontology.prefix}: {ontology.iri}
            </span>
          </div>
        </main>

        <Inspector />
      </div>
    </div>
  );
}

/**
 * Undo, redo and delete are global gestures, but must not fire while the user is typing
 * into a field — otherwise Ctrl+Z in a text box would roll back the model instead of the
 * text, and Delete would remove the selected class mid-word.
 */
function useGlobalShortcuts(actions: {
  undo: () => void;
  redo: () => void;
  deleteSelection: () => void;
}) {
  const { undo, redo, deleteSelection } = actions;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

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
