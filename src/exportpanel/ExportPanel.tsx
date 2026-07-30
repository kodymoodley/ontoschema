import { useMemo, useState } from 'react';
import { SERIALIZATION_FORMATS, serialize } from '../serialization';
import type { SerializationFormat } from '../serialization';
import { isOntologyEmpty } from '../ontologymodel';
import { useActiveProject, useOntology } from '../projectstore';
import { Button } from '../designsystem';
import { downloadFile } from './download';
import styles from './exportpanel.module.css';

/**
 * One-click export. All four files are rendered from the same triple list, so they are
 * semantically identical by construction; the preview shows exactly what will be written.
 */
export function ExportPanel() {
  const ontology = useOntology();
  const project = useActiveProject();
  const [preview, setPreview] = useState<SerializationFormat>('turtle');

  const baseName = project?.name ?? 'ontology';
  const previewText = useMemo(
    () => serialize(ontology, preview, baseName).content,
    [ontology, preview, baseName],
  );

  const empty = isOntologyEmpty(ontology);

  return (
    <div className={styles.panel}>
      {empty ? (
        <p className={styles.warning}>
          This ontology has no classes or properties yet. Exporting now produces a valid but empty
          document containing only the ontology header.
        </p>
      ) : null}

      <div className={styles.formats}>
        {SERIALIZATION_FORMATS.map((descriptor) => (
          <div key={descriptor.format} className={styles.format}>
            <div className={styles.formatText}>
              <span className={styles.formatLabel}>{descriptor.label}</span>
              <span className={styles.formatHint}>{descriptor.description}</span>
            </div>
            <Button
              size="small"
              variant="primary"
              data-testid={`download-${descriptor.extension}`}
              onClick={() => {
                const file = serialize(ontology, descriptor.format, baseName);
                downloadFile(file.filename, file.mimeType, file.content);
              }}
            >
              .{descriptor.extension}
            </Button>
          </div>
        ))}
      </div>

      <div className={styles.previewHeader}>
        <span className={styles.previewTitle}>Preview</span>
        <select
          className={styles.previewSelect}
          value={preview}
          aria-label="Preview format"
          onChange={(event) => setPreview(event.target.value as SerializationFormat)}
        >
          {SERIALIZATION_FORMATS.map((descriptor) => (
            <option key={descriptor.format} value={descriptor.format}>
              {descriptor.label}
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
