import type { ImportReport, Ontology } from '../ontologymodel';
import { UNTITLED } from '../projectstore';

/**
 * What to tell someone who has just opened a file written somewhere else.
 *
 * This app models a narrow slice of OWL, so a foreign document says more than the canvas shows.
 * The rest is kept and saved back as written, but it is out of sight, and someone editing a
 * colleague's file should know it is there. One thing is changed rather than kept, and saying
 * so is not a courtesy: saved into the same file, silence would mean a colleague's ontology
 * rewritten without anyone noticing.
 *
 * Plain words and counts, no vocabulary. Someone who knows what an `owl:Restriction` is does
 * not need to be told; someone who does not is helped by "a rule about which classes may be
 * used together", and neither is helped by the term.
 *
 * A pure function, so the wording can be read and tested without rendering anything.
 */

export interface ImportSummary {
  /** What the canvas shows, as one sentence. Always present. */
  kept: string;
  /** What the file says beyond that, kept out of sight and saved as written; null when nothing. */
  unshown: string | null;
  /**
   * What arrived but not as written, one plain sentence each. Kept apart from `unshown`
   * deliberately: something out of sight is still there, while something quietly different is
   * the thing that surprises people later.
   */
  changed: string[];
}

const count = (n: number, singular: string, plural: string) =>
  `${n} ${n === 1 ? singular : plural}`;

export function summariseImport(ontology: Ontology, report: ImportReport): ImportSummary {
  const kept = [
    count(ontology.classes.length, 'class', 'classes'),
    count(ontology.relations.length, 'relation', 'relations'),
    count(ontology.attributes.length, 'attribute', 'attributes'),
  ];

  const statements = ontology.unmodelled.length;
  const unshown =
    statements > 0
      ? `${count(statements, 'statement', 'statements')} the canvas does not show, such as particular things or rules about classes. They are kept, and saving writes them back as they were.`
      : null;

  const changed: string[] = [];
  if (report.datatypesRewritten > 0) {
    changed.push(
      `${count(report.datatypesRewritten, 'attribute', 'attributes')} had a type OntoSchema does not offer, and now say text.`,
    );
  }

  return { kept: `${sentence(kept)}.`, unshown, changed };
}

/** Whether anything is worth showing a person, as opposed to opening the file quietly. */
export const worthReporting = (summary: ImportSummary) =>
  summary.unshown !== null || summary.changed.length > 0;

/** Whether saving into the file would change more of it than the edits made here. */
export const savingWouldChange = (summary: ImportSummary) => summary.changed.length > 0;

/** `a, b and c` — an Oxford-comma-free list, which is how the rest of the app reads. */
function sentence(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

/**
 * A project name from a file name: the name without its extension.
 *
 * A document opened here is a project, and projects have names people chose. The file name is
 * the only thing the document carries that a person picked themselves — an ontology IRI is
 * chosen for machines, and `dcterms:title` is often absent.
 */
export function projectNameFromFilename(filename: string): string {
  const withoutPath = filename.slice(
    Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\')) + 1,
  );
  const dot = withoutPath.lastIndexOf('.');
  const stem = dot > 0 ? withoutPath.slice(0, dot) : withoutPath;
  return stem.trim() || UNTITLED;
}
