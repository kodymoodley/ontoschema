import type { ImportReport, Ontology } from '../ontologymodel';

/**
 * What to tell someone who has just opened a file written somewhere else.
 *
 * This app models a narrow slice of OWL, so opening a foreign document keeps some of it and
 * leaves the rest. Saying so is not a courtesy: once a file can be opened and saved in the
 * same format, silence means a colleague's ontology can be rewritten without anyone noticing
 * — parts of it dropped, and one part changed rather than dropped.
 *
 * Plain words and counts, no vocabulary. Someone who knows what an `owl:Restriction` is does
 * not need to be told; someone who does not is helped by "a rule about which classes may be
 * used together", and neither is helped by the term.
 *
 * A pure function, so the wording can be read and tested without rendering anything.
 */

export interface ImportSummary {
  /** What arrived, as one sentence. Always present, even when nothing was left behind. */
  kept: string;
  /** What was left behind, one plain sentence each. Empty when the file fitted entirely. */
  dropped: string[];
  /**
   * What arrived but not as written. Kept apart from `dropped` deliberately: a thing that is
   * gone and a thing that is quietly different are different kinds of bad news, and the
   * second is the one that surprises people later.
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

  const dropped: string[] = [];
  if (report.individuals > 0) {
    dropped.push(
      `${count(report.individuals, 'individual', 'individuals')} — OntoSchema describes kinds of thing, not particular ones.`,
    );
  }
  if (report.classExpressions > 0) {
    dropped.push(
      `${count(report.classExpressions, 'rule about how a class is defined', 'rules about how classes are defined')} — such as a restriction on a property.`,
    );
  }
  if (report.relationsWithoutBothEnds > 0) {
    dropped.push(
      `${count(report.relationsWithoutBothEnds, 'relation', 'relations')} that did not say which classes they connect.`,
    );
  }

  const changed: string[] = [];
  if (report.datatypesRewritten > 0) {
    changed.push(
      `${count(report.datatypesRewritten, 'attribute', 'attributes')} had a type OntoSchema does not offer, and now say text.`,
    );
  }

  return { kept: `${sentence(kept)}.`, dropped, changed };
}

/** Whether anything is worth showing a person, as opposed to opening the file quietly. */
export const worthReporting = (summary: ImportSummary) =>
  summary.dropped.length > 0 || summary.changed.length > 0;

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
  return stem.trim() || 'Untitled ontology';
}
