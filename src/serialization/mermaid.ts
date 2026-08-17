import type { Ontology } from '../ontologymodel';

/**
 * The schema as a Mermaid class diagram, for pasting into a document.
 *
 * Unlike the other writers this is not RDF and makes no claim to be. They all render the same
 * triples and can be checked against each other; this renders the model as a picture, and things
 * with no visual meaning — annotations, the ontology header, SHACL shapes — are left out. A
 * reader wanting the graph should take Turtle.
 *
 * A class diagram rather than a flowchart, because a class carrying typed attributes is exactly
 * what the notation is for, and because the subclass arrow is the hollow triangle the canvas
 * already draws.
 */

/**
 * Mermaid identifiers are far stricter than IRI local names, which may carry dots, dashes and
 * other characters an IRI happily accepts. Anything outside the safe set becomes an underscore,
 * and a name starting with a digit gains a leading one, since Mermaid will not parse it.
 */
function identifier(localName: string): string {
  const safe = localName.replace(/[^A-Za-z0-9_]/g, '_');
  return /^[0-9]/.test(safe) ? `_${safe}` : safe;
}

/** `xsd:string` reads as a namespace to a diagram reader and as a syntax error to Mermaid. */
const plainType = (range: string): string => identifier(range.replace(/^.*[:#/]/, ''));

export function serializeMermaid(ontology: Ontology): string {
  const classById = new Map(ontology.classes.map((entity) => [entity.id, entity]));
  const attributeById = new Map(ontology.attributes.map((entity) => [entity.id, entity]));
  const relationById = new Map(ontology.relations.map((entity) => [entity.id, entity]));

  const lines: string[] = ['classDiagram'];

  /*
   * Sorted throughout, so the same schema always produces the same text. Diagrams get committed
   * beside the documents that embed them, and output that shuffles turns a one-line change into
   * a whole-file diff.
   */
  const attributesOf = (classId: string) =>
    ontology.usages
      .filter((usage) => usage.subjectClassId === classId && usage.objectClassId === null)
      .map((usage) => attributeById.get(usage.propertyId))
      .filter((attribute) => attribute !== undefined)
      // By name, not by the rendered line: the type comes first in Mermaid's syntax, so sorting
      // the finished string groups a class's attributes by datatype, which is not how anyone
      // looks for one.
      .sort((a, b) => a.localName.localeCompare(b.localName))
      .map((attribute) => `+${plainType(attribute.range)} ${identifier(attribute.localName)}`);

  for (const entity of [...ontology.classes].sort((a, b) =>
    a.localName.localeCompare(b.localName),
  )) {
    const members = attributesOf(entity.id);
    const name = identifier(entity.localName);
    if (members.length === 0) {
      lines.push(`  class ${name}`);
      continue;
    }
    lines.push(`  class ${name} {`);
    for (const member of members) lines.push(`    ${member}`);
    lines.push('  }');
  }

  // Parent first, then the hollow triangle, which is how Mermaid reads "is a subclass of".
  const inheritance = ontology.classes
    .flatMap((entity) =>
      entity.superClassIds
        .map((parentId) => classById.get(parentId))
        .filter((parent) => parent !== undefined)
        .map((parent) => `  ${identifier(parent.localName)} <|-- ${identifier(entity.localName)}`),
    )
    .sort();

  const associations = ontology.usages
    .filter((usage) => usage.objectClassId !== null)
    .map((usage) => {
      const relation = relationById.get(usage.propertyId);
      const subject = classById.get(usage.subjectClassId);
      const object = usage.objectClassId === null ? undefined : classById.get(usage.objectClassId);
      if (!relation || !subject || !object) return null;
      return `  ${identifier(subject.localName)} --> ${identifier(object.localName)} : ${identifier(relation.localName)}`;
    })
    .filter((line) => line !== null)
    .sort();

  // Duplicates are possible: one relation used twice between the same pair of classes draws one
  // arrow, not two stacked on each other.
  return [...lines, ...new Set(inheritance), ...new Set(associations)].join('\n') + '\n';
}
