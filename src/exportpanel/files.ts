import { SERIALIZATION_FORMATS, describeFormat } from '../serialization';
import type { SerializationFormat, SerializationOptions } from '../serialization';

/**
 * The files this app can write, split by whether it can read them back.
 *
 * A file is a *document* if opening it here returns the schema: Turtle and RDF/XML, carrying
 * the axioms and the layout. Everything else is one-way, and the split is the whole point of
 * the two panels — "save" promises a round trip, "export" promises a rendering.
 *
 * Shapes are their own file rather than a layer inside the ontology. They were written into
 * the same document, which made the ontology carry constraints that nothing reads back;
 * separated, the ontology file is what a reasoner sees and the shapes file is what a
 * validator sees, and neither has to be told to ignore the other. This is also why a reused
 * property states its domain as a union — without the shapes beside it, the ontology has to
 * carry enough to stand on its own.
 */

export interface WritableFile {
  /** Stable id, and the `download-*` test id the button carries. */
  key: string;
  label: string;
  description: string;
  format: SerializationFormat;
  extension: string;
  options: SerializationOptions;
  /** Appended to the project name, so two files from one schema do not collide. */
  suffix?: string;
}

/**
 * What the ontology file holds: the axioms, and where the classes sit. No shapes — see above.
 */
const ONTOLOGY: SerializationOptions = { includeShapes: false, includeLayout: true };

/** Saved files: the ones `open` reads back. */
export const DOCUMENT_FILES: readonly WritableFile[] = SERIALIZATION_FORMATS.filter((descriptor) =>
  ['turtle', 'rdfxml', 'owl'].includes(descriptor.format),
).map((descriptor) => ({
  key: descriptor.extension,
  label: descriptor.label,
  description: descriptor.description,
  format: descriptor.format,
  extension: descriptor.extension,
  options: ONTOLOGY,
}));

/** Exports: a rendering of the schema, or a layer of it, that this app will not read back. */
export const EXPORT_FILES: readonly WritableFile[] = [
  {
    key: 'shapes',
    label: 'SHACL shapes',
    description:
      'One shape per class, keeping every pairing the ontology file cannot state. For a validator.',
    format: 'turtle',
    extension: 'ttl',
    options: { includeAxioms: false, includeShapes: true, includeLayout: false },
    suffix: '-shapes',
  },
  {
    key: 'jsonld',
    label: describeFormat('jsonld').label,
    description: `${describeFormat('jsonld').description} — this app does not read it back`,
    format: 'jsonld',
    extension: 'jsonld',
    options: ONTOLOGY,
  },
  {
    key: 'mmd',
    label: describeFormat('mermaid').label,
    description: describeFormat('mermaid').description,
    format: 'mermaid',
    extension: 'mmd',
    options: {},
  },
];

export const filesFor = (purpose: 'save' | 'export') =>
  purpose === 'save' ? DOCUMENT_FILES : EXPORT_FILES;
