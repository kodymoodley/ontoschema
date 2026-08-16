import { describe, expect, it } from 'vitest';
import { createProject } from '../ontologymodel';
import { projectFromFile, projectToFile, reviveProject } from './persistence';

/**
 * Reading a saved document back.
 *
 * This had no tests, which is a gap worth naming: the reviver is the only thing standing between
 * a file on disk and the editor, and it is deliberately forgiving — a missing list revives as an
 * empty one rather than throwing. That tolerance is right for a field nobody has heard of and
 * wrong for a list that carries half the schema, and the difference is what these cover.
 */

function projectWithBoth() {
  const project = createProject('Cars');
  const ontology = project.ontology;
  return {
    ...project,
    ontology: {
      ...ontology,
      classes: [
        {
          id: 'c1',
          localName: 'Car',
          superClassIds: [],
          annotations: [],
          position: { x: 10, y: 20 },
        },
      ],
      relations: [{ id: 'r1', localName: 'offeredBy', superPropertyIds: [], annotations: [] }],
      attributes: [
        {
          id: 'a1',
          localName: 'make',
          range: 'string' as const,
          superPropertyIds: [],
          annotations: [],
        },
      ],
    },
  };
}

describe('a document this version wrote', () => {
  it('comes back with its classes, relations and attributes intact', () => {
    const restored = projectFromFile(projectToFile(projectWithBoth()));

    expect(restored?.ontology.classes.map((entity) => entity.localName)).toEqual(['Car']);
    expect(restored?.ontology.relations.map((entity) => entity.localName)).toEqual(['offeredBy']);
    expect(restored?.ontology.attributes.map((entity) => entity.localName)).toEqual(['make']);
  });
});

describe('a document written before relations and attributes were renamed', () => {
  const oldShape = {
    id: 'p1',
    name: 'Cars',
    ontology: {
      iri: 'https://example.org/auto/',
      prefix: 'auto',
      annotations: [],
      classes: [
        {
          id: 'c1',
          localName: 'Car',
          superClassIds: [],
          annotations: [],
          position: { x: 0, y: 0 },
        },
      ],
      objectProperties: [
        { id: 'r1', localName: 'offeredBy', superPropertyIds: [], annotations: [] },
      ],
      datatypeProperties: [
        { id: 'a1', localName: 'make', range: 'string', superPropertyIds: [], annotations: [] },
      ],
      usages: [],
    },
  };

  /*
   * Refused rather than read. Without the guard this opens: the classes arrive, the two renamed
   * lists are simply absent so they revive as empty, and the schema looks nearly right with every
   * relation and attribute gone. The save queue then writes that back over the original within
   * the second, which turns a document that could not be opened into one that no longer exists.
   */
  it('is refused rather than opened with half of it missing', () => {
    expect(reviveProject(oldShape)).toBeNull();
  });

  it('is refused through the file reader too, not only the store', () => {
    expect(projectFromFile(JSON.stringify({ version: 1, project: oldShape }))).toBeNull();
  });
});
