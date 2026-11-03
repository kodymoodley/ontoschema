import { useState } from 'react';
import { serialize } from '../serialization';
import { isOntologyEmpty } from '../ontologymodel';
import { useActiveProject, useOntology } from '../projectstore';
import { Button, downloadFile } from '../designsystem';
import { canLinkFiles, fileLinks, pickFileToSave, writableFormat } from '../filelink';
import { filesFor } from './files';
import type { WritableFile } from './files';
import styles from './exportpanel.module.css';

/**
 * Writing the schema out, for one of two purposes.
 *
 * **Saving** produces a document this app can open again: the axioms and the layout, in
 * Turtle or RDF/XML. **Exporting** produces something it cannot — the SHACL shapes as a file
 * of their own, JSON-LD, a diagram.
 *
 * One component because the mechanics are identical — pick a file, see it, download it — and
 * the difference is which files are on offer and what to say about them. Two components would
 * have been the same code twice with a different list at the top.
 *
 * There are no layer checkboxes any more. What each file contains is a property of the file:
 * an ontology has axioms and a layout, a shapes file has shapes. Asking the person to assemble
 * that was asking them to know why the layers existed.
 */

interface ExportPanelProps {
  purpose?: 'save' | 'export';
}

export function ExportPanel({ purpose = 'export' }: ExportPanelProps) {
  const ontology = useOntology();
  const project = useActiveProject();
  const files = filesFor(purpose);
  const [previewKey, setPreviewKey] = useState(files[0]?.key ?? '');

  const baseName = project?.name ?? 'ontology';
  const previewed = files.find((file) => file.key === previewKey) ?? files[0];
  /*
   * Not memoised by hand. The compiler does it, and doing it here needed `previewed` as a
   * dependency -- an object rebuilt on every render, which defeats the memo and makes the
   * compiler skip the whole component rather than optimise around it.
   */
  const previewText = previewed
    ? serialize(ontology, previewed.format, baseName, previewed.options).content
    : '';

  /*
   * Saving, where the browser allows it, asks where to put the file and links the schema to it,
   * so every later edit is saved into that file too. Everything else downloads, as it always has.
   */
  const linking = purpose === 'save' && canLinkFiles();

  const write = async (file: WritableFile) => {
    const written = serialize(
      ontology,
      file.format,
      `${baseName}${file.suffix ?? ''}`,
      file.options,
    );
    const format = writableFormat(written.filename);
    if (!linking || !project || !format) {
      downloadFile(written.filename, written.mimeType, written.content);
      return;
    }
    const handle = await pickFileToSave(written.content, {
      name: written.filename,
      extension: file.extension,
      mimeType: written.mimeType,
    });
    if (handle) {
      await fileLinks.link(project.id, handle, { text: written.content, format, paused: false });
    }
  };

  return (
    <div className={styles.panel}>
      {isOntologyEmpty(ontology) ? (
        <p className={styles.warning}>
          This schema has no classes or properties yet. Writing it out now produces a valid but
          empty document containing only the ontology header.
        </p>
      ) : null}

      <p className={styles.purpose}>
        {purpose === 'export'
          ? 'These are renderings, not documents: this app writes them and does not read them back.'
          : linking
            ? 'Choose where to save it, inside a git repository for instance, and every later edit is saved into that file too. It opens again here, and in any other RDF tool.'
            : 'A schema saved this way opens again here, and in any other RDF tool. Where the classes sit is saved with it.'}
      </p>

      <div className={styles.formats}>
        {files.map((file) => (
          <div key={file.key} className={styles.format}>
            <div className={styles.formatText}>
              <span className={styles.formatLabel}>{file.label}</span>
              <span className={styles.formatHint}>{file.description}</span>
            </div>
            <Button
              size="small"
              variant="primary"
              data-testid={`download-${file.key}`}
              onClick={() => void write(file)}
            >
              .{file.extension}
            </Button>
          </div>
        ))}
      </div>

      <div className={styles.previewHeader}>
        <span className={styles.previewTitle}>Preview</span>
        <select
          className={styles.previewSelect}
          value={previewed?.key ?? ''}
          aria-label="Preview format"
          onChange={(event) => setPreviewKey(event.target.value)}
        >
          {files.map((file) => (
            <option key={file.key} value={file.key}>
              {file.label}
            </option>
          ))}
        </select>
      </div>
      <pre className={styles.preview} data-testid="export-preview">
        {previewText}
      </pre>
    </div>
  );
}
