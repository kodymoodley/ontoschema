import { DOCUMENT_OPTIONS, SERIALIZATION_FORMATS, describeFormat } from '../serialization';
import type { SerializationFormat, SerializationOptions } from '../serialization';

/**
 * The files this app can write, split by whether it can read them back.
 *
 * A file is a *document* if opening it here returns the schema: Turtle and RDF/XML, carrying
 * the axioms and the layout. Everything else is one-way, and the split is the whole point of
 * the two panels — "save" promises a round trip, "export" promises a rendering.
 *
 * **A saved file carries its shapes**, and that is what makes the round trip a round trip. The
 * axioms alone cannot: `rdfs:domain` and `rdfs:range` name both ends of a relation but not which
 * end went with which, so a relation drawn between two pairs was saved as a union and opened as
 * all four — the insurance example came back with `MotorPolicy insures Dwelling`, which nobody
 * drew. A shape is per class, so it says exactly what was drawn.
 *
 * With them in the file the union has nothing left to do, and is not written: no blank nodes, no
 * `rdf:first` chains, and one statement of each fact rather than a loose one and an exact one.
 *
 * The separate shapes export stays, for a validator that wants the constraints on their own.
 * Nothing has to be told to ignore anything: a reasoner passes over `sh:` triples and a
 * validator passes over `owl:` ones.
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

/** What a saved file holds: the axioms, the shapes that keep every pairing, and the layout. */
const ONTOLOGY: SerializationOptions = DOCUMENT_OPTIONS;

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
