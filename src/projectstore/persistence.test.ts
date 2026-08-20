import { describe, expect, it } from 'vitest';
import { createProject } from '../ontologymodel';
import {
  PROJECT_FILE_VERSION,
  projectFromFile,
  projectToFile,
  reviveProject,
  workspaceFromFile,
  workspaceToFile,
} from './persistence';

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

  /*
   * Turned away by its stated version as well as by its keys. The version had never been read,
   * so a file could claim anything; a document that says it predates the rename is now refused
   * whatever it contains.
   */
  it('is refused on its version alone, whatever the keys say', () => {
    const current = projectToFile(projectWithBoth());
    const backdated = JSON.stringify({ ...JSON.parse(current), version: 1 });
    expect(projectFromFile(backdated)).toBeNull();
  });
});

/**
 * The backup file: the whole workspace, and the one thing an RDF document cannot carry.
 *
 * A Turtle document is one ontology; a workspace is several. What matters here is that the two
 * file kinds can never be mistaken for one another, since restoring is destructive and opening
 * a project is not.
 */
describe('a workspace backup', () => {
  function workspaceWithTwo() {
    const first = projectWithBoth();
    const second = { ...createProject('Boats'), id: 'p2' };
    return { projects: [first, second], activeProjectId: second.id };
  }

  it('brings every project back, and which one was open', () => {
    const restored = workspaceFromFile(workspaceToFile(workspaceWithTwo()));

    expect(restored?.projects.map((project) => project.name)).toEqual(['Cars', 'Boats']);
    expect(restored?.activeProjectId).toBe('p2');
    expect(restored?.projects[0]?.ontology.classes[0]?.localName).toBe('Car');
    expect(restored?.projects[0]?.ontology.classes[0]?.position).toEqual({ x: 10, y: 20 });
  });

  it('keeps the internal ids, which is what makes it lossless', () => {
    const restored = workspaceFromFile(workspaceToFile(workspaceWithTwo()));
    const ontology = restored?.projects[0]?.ontology;

    expect(ontology?.classes[0]?.id).toBe('c1');
    expect(ontology?.relations[0]?.id).toBe('r1');
    expect(ontology?.attributes[0]?.id).toBe('a1');
  });

  it('refuses a project file, which is a different thing entirely', () => {
    expect(workspaceFromFile(projectToFile(projectWithBoth()))).toBeNull();
  });

  it('refuses a backup written before relations and attributes were renamed', () => {
    const current = workspaceToFile(workspaceWithTwo());
    const backdated = current.replace(`"version": ${PROJECT_FILE_VERSION}`, '"version": 1');
    expect(workspaceFromFile(backdated)).toBeNull();
  });

  it.each([
    ['not JSON', 'certainly not json'],
    ['an array', '[]'],
    ['null', 'null'],
    ['an empty string', ''],
    ['a backup with no projects', JSON.stringify({ workspace: { projects: [] } })],
    ['a backup whose projects are not a list', JSON.stringify({ workspace: { projects: 7 } })],
  ])('refuses %s rather than throwing', (_name, content) => {
    expect(workspaceFromFile(content)).toBeNull();
  });

  it('drops a project it cannot read and keeps the ones it can', () => {
    const damaged = {
      version: PROJECT_FILE_VERSION,
      workspace: {
        projects: [projectWithBoth(), { name: 'no ontology at all' }],
        activeProjectId: 'gone',
      },
    };
    const restored = workspaceFromFile(JSON.stringify(damaged));

    expect(restored?.projects).toHaveLength(1);
    // The open project no longer exists, so the first surviving one is opened instead.
    expect(restored?.activeProjectId).toBe(restored?.projects[0]?.id);
  });
});
