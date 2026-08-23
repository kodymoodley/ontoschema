import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { UNTITLED, useActiveProject, useProjectStore, useProjects } from '../projectstore';
import { EXAMPLES, exampleSize } from '../examplelibrary';
import {
  Button,
  Field,
  HamburgerIcon,
  downloadFile,
  Menu,
  MenuGroup,
  MenuSeparator,
  Modal,
  TextInput,
} from '../designsystem';
import { formatForFilename, readOntology } from '../serialization';
import { projectNameFromFilename, summariseImport, worthReporting } from './importSummary';
import type { ImportSummary } from './importSummary';
import styles from './projectswitcher.module.css';

interface ProjectSwitcherProps {
  /**
   * Extra items for the file menu, supplied by whoever assembles the header.
   *
   * Export belongs in this menu and lives in a module of its own, and two UI modules may not
   * import each other — so the menu takes the item rather than reaching for it. The rule is what
   * keeps the panels independent, and a slot is the ordinary way past it.
   */
  extraActions?: ReactNode;
}

/**
 * Managing several ontologies: switch between them, start a new one, rename, delete, and
 * move projects between machines as a JSON file.
 *
 * Project files are the ontology *document* — layout included — as distinct from an RDF
 * export, which is the ontology itself.
 */
export function ProjectSwitcher({ extraActions }: ProjectSwitcherProps = {}) {
  const projects = useProjects();
  const active = useActiveProject();
  const fileInput = useRef<HTMLInputElement>(null);

  const switchProject = useProjectStore((state) => state.switchProject);
  const newProject = useProjectStore((state) => state.newProject);
  const openAsNewProject = useProjectStore((state) => state.openAsNewProject);
  const deleteProject = useProjectStore((state) => state.deleteProject);
  const importProject = useProjectStore((state) => state.importProject);
  const exportWorkspaceFile = useProjectStore((state) => state.exportWorkspaceFile);
  const restoreWorkspace = useProjectStore((state) => state.restoreWorkspace);

  const [creating, setCreating] = useState(false);
  const [browsingExamples, setBrowsingExamples] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  /* The chosen backup, held between picking the file and agreeing to replace everything. */
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);
  /* What the last opened document left behind, shown once and dismissed. */
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const backupInput = useRef<HTMLInputElement>(null);

  const create = () => {
    newProject(newName.trim() || UNTITLED);
    setNewName('');
    setCreating(false);
  };

  /*
   * Named for the day rather than for a project, because a backup is a snapshot of this
   * browser and belongs to no one project. The date is what tells two of them apart.
   */
  const backUp = () => {
    const today = new Date().toISOString().slice(0, 10);
    downloadFile(`ontoschema-backup-${today}.json`, 'application/json', exportWorkspaceFile());
  };

  /**
   * One picker for a schema and for a project file, told apart by extension.
   *
   * Both mean the same thing to the person doing it -- open what I have got -- and asking
   * them which kind of file it is before they choose it would be asking them to know
   * something the file already says. A backup is the exception, because restoring one is
   * destructive; opening either of these is not.
   */
  const openFile = async (file: File) => {
    const format = formatForFilename(file.name);
    const content = await file.text();

    if (!format) {
      const imported = importProject(content);
      setImportError(imported ? null : 'That file is not a valid OntoSchema project.');
      return;
    }

    try {
      const { ontology, report } = await readOntology(content, format);
      openAsNewProject(projectNameFromFilename(file.name), ontology);
      const summary = summariseImport(ontology, report);
      if (worthReporting(summary)) setImportSummary(summary);
    } catch {
      setImportError(
        `${file.name} could not be read as ${format === 'turtle' ? 'Turtle' : 'RDF/XML'}.`,
      );
    }
  };

  const restore = () => {
    if (pendingRestore === null) return;
    const restored = restoreWorkspace(pendingRestore);
    setPendingRestore(null);
    if (restored === null) setImportError('That file is not an OntoSchema backup.');
  };

  return (
    <div className={styles.switcher}>
      <select
        className={styles.select}
        value={active?.id ?? ''}
        aria-label="Active project"
        onChange={(event) => switchProject(event.target.value)}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>

      {/*
        One menu rather than a row of buttons. The header was the most crowded strip in the app
        and the first thing to run out of room on a phone, and these are all the same kind of
        thing -- what to do with the project as a whole -- so they read better gathered than
        spread. The project selector stays outside, because switching project is navigation
        rather than an action and is used far more often than any of these.

        Four groups, in the order every file menu uses: start something, write it out, the
        workspace as a whole, destroy. An ellipsis means the item asks for something before it
        acts -- a dialog or a file picker -- which is why backing up has none and restoring
        does. Confirming is not asking, so deleting has none either.
      */}
      <Menu label="File" triggerLabel={<HamburgerIcon />} data-testid="file-menu">
        <Button
          size="small"
          variant="subtle"
          onClick={() => setCreating(true)}
          data-testid="new-project"
        >
          New project…
        </Button>
        <Button
          size="small"
          variant="subtle"
          onClick={() => setBrowsingExamples(true)}
          data-testid="open-examples"
        >
          New from example…
        </Button>
        <Button size="small" variant="subtle" onClick={() => fileInput.current?.click()}>
          Open…
        </Button>

        <MenuSeparator />
        {/* Save and Export, filled by whoever assembles the header. */}
        {extraActions}

        <MenuSeparator />
        {/*
          Folded away because it is the rarest thing here and the only one that is about the
          browser rather than about the schema in front of you.
        */}
        <MenuGroup label="Workspace" data-testid="workspace-group">
          <Button size="small" variant="subtle" onClick={backUp} data-testid="back-up">
            Back up
          </Button>
          <Button
            size="small"
            variant="subtle"
            onClick={() => backupInput.current?.click()}
            data-testid="restore-backup"
          >
            Restore…
          </Button>
        </MenuGroup>

        <MenuSeparator />
        <Button
          size="small"
          variant="danger"
          onClick={() => setConfirmingDelete(true)}
          disabled={!active}
          data-testid="delete-project"
        >
          Delete project
        </Button>
      </Menu>

      <input
        ref={fileInput}
        type="file"
        accept=".json,.ttl,.rdf,.owl,application/json,text/turtle,application/rdf+xml"
        className={styles.hiddenInput}
        aria-label="Open project file"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          await openFile(file);
        }}
      />

      {/*
        A second input rather than one that accepts either kind of file. Restoring replaces
        everything in this browser, and an action that destructive should be chosen on purpose
        rather than arrived at by opening a file that turned out to be a backup.
      */}
      <input
        ref={backupInput}
        type="file"
        accept="application/json,.json"
        className={styles.hiddenInput}
        aria-label="Restore a backup file"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          setPendingRestore(await file.text());
        }}
      />

      <Modal
        title="Replace everything in this browser?"
        open={pendingRestore !== null}
        onClose={() => setPendingRestore(null)}
        footer={
          <>
            <Button variant="subtle" onClick={() => setPendingRestore(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={restore} data-testid="confirm-restore">
              Restore
            </Button>
          </>
        }
      >
        <p className={styles.confirmText}>
          Restoring puts the workspace back exactly as the backup has it.{' '}
          <strong>
            {projects.length === 1
              ? 'The one project open here'
              : `All ${projects.length} projects here`}
          </strong>{' '}
          will be replaced. Back up first if you have not already.
        </p>
      </Modal>

      <Modal
        title="New project"
        open={creating}
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button variant="subtle" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={create} data-testid="confirm-new-project">
              Create
            </Button>
          </>
        }
      >
        <Field label="Project name">
          <TextInput
            value={newName}
            data-autofocus
            placeholder="Automotive Schema"
            aria-label="New project name"
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') create();
            }}
          />
        </Field>
      </Modal>

      <Modal
        title="Open an example"
        open={browsingExamples}
        onClose={() => setBrowsingExamples(false)}
        footer={
          <Button variant="subtle" onClick={() => setBrowsingExamples(false)}>
            Close
          </Button>
        }
      >
        <p className={styles.confirmText}>
          Each opens as a new project, so anything you are already working on is left alone.
        </p>
        <ul className={styles.exampleList}>
          {EXAMPLES.map((example) => {
            const size = exampleSize(example);
            return (
              <li key={example.key}>
                <button
                  type="button"
                  className={styles.exampleItem}
                  data-example={example.key}
                  onClick={() => {
                    openAsNewProject(example.title, example.build());
                    setBrowsingExamples(false);
                  }}
                >
                  <span className={styles.exampleTitle}>{example.title}</span>
                  <span className={styles.exampleSummary}>{example.summary}</span>
                  <span className={styles.exampleCounts}>
                    {size.classes} classes · {size.relations} relations · {size.attributes}{' '}
                    attributes
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Modal>

      <Modal
        title="Delete this project?"
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        footer={
          <>
            <Button variant="subtle" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (active) deleteProject(active.id);
                setConfirmingDelete(false);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className={styles.confirmText}>
          <strong>{active?.name}</strong> and everything in it will be removed from this browser.
          Save it to a file first if you want to keep it.
        </p>
      </Modal>

      {/*
        Shown after the file is open, not before. Nothing here is a question -- the document is
        already in front of them -- so it reports rather than asks, and it appears only when
        there is something to say.
      */}
      <Modal
        title="Opened, with some of the file left behind"
        open={importSummary !== null}
        onClose={() => setImportSummary(null)}
        footer={
          <Button
            variant="primary"
            onClick={() => setImportSummary(null)}
            data-testid="import-report-ok"
          >
            OK
          </Button>
        }
      >
        <p className={styles.confirmText}>
          OntoSchema kept {importSummary?.kept} What it does not model was left out rather than
          refused, so the schema opens as far as it goes.
        </p>
        {importSummary && importSummary.dropped.length > 0 ? (
          <>
            <p className={styles.confirmText}>
              <strong>Left out</strong>
            </p>
            <ul className={styles.reportList}>
              {importSummary.dropped.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        ) : null}
        {importSummary && importSummary.changed.length > 0 ? (
          <>
            <p className={styles.confirmText}>
              <strong>Changed</strong>
            </p>
            <ul className={styles.reportList}>
              {importSummary.changed.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        ) : null}
        <p className={styles.confirmText}>
          Saving from here writes what OntoSchema kept, not the file you opened. Keep the original
          if you need everything in it.
        </p>
      </Modal>

      <Modal
        title="Could not open that file"
        open={importError !== null}
        onClose={() => setImportError(null)}
        footer={
          <Button variant="primary" onClick={() => setImportError(null)}>
            OK
          </Button>
        }
      >
        <p className={styles.confirmText}>{importError}</p>
      </Modal>
    </div>
  );
}

/** Renaming lives in the header next to the title, so it is edited where it is read. */
export function ProjectNameField() {
  const active = useActiveProject();
  const renameProject = useProjectStore((state) => state.renameProject);
  // A draft lets the field be cleared while typing; the store keeps the last valid name.
  const [draft, setDraft] = useState<string | null>(null);

  if (!active) return null;

  return (
    <input
      className={styles.nameField}
      value={draft ?? active.name}
      aria-label="Project name"
      onChange={(event) => {
        setDraft(event.target.value);
        renameProject(active.id, event.target.value);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
