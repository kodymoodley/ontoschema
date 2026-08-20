import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useActiveProject, useProjectStore, useProjects } from '../projectstore';
import { EXAMPLES, exampleSize } from '../examplelibrary';
import { Button, HamburgerIcon, Menu, Field, Modal, TextInput } from '../designsystem';
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
  const openExample = useProjectStore((state) => state.openExample);
  const deleteProject = useProjectStore((state) => state.deleteProject);
  const importProject = useProjectStore((state) => state.importProject);
  const exportProjectFile = useProjectStore((state) => state.exportProjectFile);
  const exportWorkspaceFile = useProjectStore((state) => state.exportWorkspaceFile);
  const restoreWorkspace = useProjectStore((state) => state.restoreWorkspace);

  const [creating, setCreating] = useState(false);
  const [browsingExamples, setBrowsingExamples] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  /* The chosen backup, held between picking the file and agreeing to replace everything. */
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);
  const backupInput = useRef<HTMLInputElement>(null);

  const create = () => {
    newProject(newName.trim() || 'Untitled ontology');
    setNewName('');
    setCreating(false);
  };

  const download = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const saveToFile = () => {
    const content = exportProjectFile();
    if (!content || !active) return;
    const name = active.name.replace(/[^A-Za-z0-9._-]+/g, '-') || 'project';
    download(`${name}.ontoschema.json`, content);
  };

  /*
   * Named for the day rather than for a project, because a backup is a snapshot of this
   * browser and belongs to no one project. The date is what tells two of them apart.
   */
  const backUp = () => {
    const today = new Date().toISOString().slice(0, 10);
    download(`ontoschema-backup-${today}.json`, exportWorkspaceFile());
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
        aria-label="Active ontology project"
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
      */}
      <Menu label="File" triggerLabel={<HamburgerIcon />} data-testid="file-menu">
        <Button
          size="small"
          variant="subtle"
          onClick={() => setCreating(true)}
          data-testid="new-project"
        >
          New project
        </Button>
        <Button
          size="small"
          variant="subtle"
          onClick={() => setBrowsingExamples(true)}
          data-testid="open-examples"
        >
          Examples
        </Button>
        <Button size="small" variant="subtle" onClick={saveToFile}>
          Save to file
        </Button>
        <Button size="small" variant="subtle" onClick={() => fileInput.current?.click()}>
          Open a file
        </Button>
        <Button size="small" variant="subtle" onClick={backUp} data-testid="back-up">
          Back up everything
        </Button>
        <Button
          size="small"
          variant="subtle"
          onClick={() => backupInput.current?.click()}
          data-testid="restore-backup"
        >
          Restore a backup
        </Button>
        {extraActions}
        <Button
          size="small"
          variant="danger"
          onClick={() => setConfirmingDelete(true)}
          disabled={!active}
        >
          Delete project
        </Button>
      </Menu>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className={styles.hiddenInput}
        aria-label="Open project file"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          const imported = importProject(await file.text());
          setImportError(imported ? null : 'That file is not a valid OntoSchema project.');
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
        title="New ontology project"
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
                    openExample(example.title, example.build());
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
