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
  const [includeAxioms, setIncludeAxioms] = useState(true);
  const [includeShapes, setIncludeShapes] = useState(true);

  const baseName = project?.name ?? 'ontology';
  const options = useMemo(() => ({ includeAxioms, includeShapes }), [includeAxioms, includeShapes]);
  const previewText = useMemo(
    () => serialize(ontology, preview, baseName, options).content,
    [ontology, preview, baseName, options],
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

      {/*
        SHACL is a vocabulary, not a serialization, so shapes ride inside the same files
        rather than being a fifth format. They carry what the canvas actually means: a
        per-class constraint, which rdfs:domain and rdfs:range cannot express once a
        property is reused.
      */}
      <fieldset className={styles.layers}>
        <legend className={styles.layersLegend}>Include</legend>
        <label className={styles.layer}>
          <input
            type="checkbox"
            checked={includeAxioms}
            aria-label="Include OWL and RDFS axioms"
            onChange={(event) => setIncludeAxioms(event.target.checked)}
          />
          <span>
            <strong>OWL / RDFS axioms</strong>
            <span className={styles.layerHint}>
              Class and property declarations, hierarchies, and domain/range where a property is
              used only once.
            </span>
          </span>
        </label>
        <label className={styles.layer}>
          <input
            type="checkbox"
            checked={includeShapes}
            aria-label="Include SHACL shapes"
            onChange={(event) => setIncludeShapes(event.target.checked)}
          />
          <span>
            <strong>SHACL shapes</strong>
            <span className={styles.layerHint}>
              One property shape per use, so every class keeps its own constraints even when a
              property is shared.
            </span>
          </span>
        </label>
      </fieldset>

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
                const file = serialize(ontology, descriptor.format, baseName, options);
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
