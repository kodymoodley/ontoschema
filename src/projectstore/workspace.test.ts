import { describe, expect, it } from 'vitest';
import { addClass, createEmptyOntology, createProject } from '../ontologymodel';
import {
  activeOntologyOf,
  activateProject,
  activeProject,
  addProject,
  emptyWorkspace,
  removeProject,
  renameProject,
  withOntology,
  withRestoredOntology,
} from './workspace';
import type { Workspace } from './workspace';

/**
 * `updatedAt` is pinned to the past rather than left at "now": creating a project and
 * touching it can land in the same millisecond, which would make a comparison against the
 * wall clock pass or fail depending on timing.
 */
const LONG_AGO = '2020-01-01T00:00:00.000Z';

function twoProjects(): { workspace: Workspace; first: string; second: string } {
  const first = { ...createProject('Automotive'), updatedAt: LONG_AGO };
  const second = { ...createProject('Library'), updatedAt: LONG_AGO };
  return {
    workspace: { projects: [first, second], activeProjectId: first.id },
    first: first.id,
    second: second.id,
  };
}

describe('emptyWorkspace', () => {
  it('always opens with something to edit', () => {
    const workspace = emptyWorkspace();
    expect(workspace.projects).toHaveLength(1);
    expect(activeProject(workspace)).toBeDefined();
  });
});

describe('lookup', () => {
  it('finds the open project and its ontology', () => {
    const { workspace, first } = twoProjects();
    expect(activeProject(workspace)?.id).toBe(first);
    expect(activeOntologyOf(workspace)).toBeDefined();
  });

  it('returns nothing when the active id points at a project that is gone', () => {
    const { workspace } = twoProjects();
    const orphaned: Workspace = { ...workspace, activeProjectId: 'missing' };
    expect(activeProject(orphaned)).toBeUndefined();
    expect(activeOntologyOf(orphaned)).toBeUndefined();
  });
});

describe('withOntology', () => {
  it('replaces only the open project and marks it touched', () => {
    const { workspace, first, second } = twoProjects();
    const edited = addClass(createEmptyOntology(), { localName: 'Car' }).ontology;

    const next = withOntology(workspace, edited);

    expect(next.projects.find((p) => p.id === first)?.ontology).toBe(edited);
    expect(next.projects.find((p) => p.id === second)?.ontology).toBe(
      workspace.projects[1]?.ontology,
    );
    expect(next.projects.find((p) => p.id === first)?.updatedAt).not.toBe(LONG_AGO);
    expect(next.projects.find((p) => p.id === second)?.updatedAt).toBe(LONG_AGO);
  });

  it('leaves the workspace alone when nothing is open', () => {
    const { workspace } = twoProjects();
    const closed: Workspace = { ...workspace, activeProjectId: null };
    expect(withOntology(closed, createEmptyOntology())).toBe(closed);
  });

  it('does not restamp updatedAt when restoring, which is what undo needs', () => {
    const { workspace, first } = twoProjects();
    const restored = withRestoredOntology(workspace, createEmptyOntology());
    expect(restored.projects.find((p) => p.id === first)?.updatedAt).toBe(LONG_AGO);
  });
});

describe('project management', () => {
  it('adds a project and opens it', () => {
    const { workspace } = twoProjects();
    const project = createProject('Third');
    const next = addProject(workspace, project);

    expect(next.projects).toHaveLength(3);
    expect(next.activeProjectId).toBe(project.id);
  });

  it('switches only to a project that exists', () => {
    const { workspace, second } = twoProjects();
    expect(activateProject(workspace, second).activeProjectId).toBe(second);
    expect(activateProject(workspace, 'missing')).toBe(workspace);
  });

  it('renames, trimming the name', () => {
    const { workspace, first } = twoProjects();
    const next = renameProject(workspace, first, '  Vehicles  ');
    expect(next.projects.find((p) => p.id === first)?.name).toBe('Vehicles');
  });

  it('refuses a blank rename rather than leaving a nameless project', () => {
    const { workspace, first } = twoProjects();
    expect(renameProject(workspace, first, '   ')).toBe(workspace);
  });

  it('removes a project and opens another when the open one goes', () => {
    const { workspace, first, second } = twoProjects();
    const next = removeProject(workspace, first);

    expect(next.projects).toHaveLength(1);
    expect(next.activeProjectId).toBe(second);
  });

  it('keeps the open project when a different one is removed', () => {
    const { workspace, first, second } = twoProjects();
    expect(removeProject(workspace, second).activeProjectId).toBe(first);
  });

  it('never leaves the workspace with nothing to edit', () => {
    const only = createProject('Only');
    const workspace: Workspace = { projects: [only], activeProjectId: only.id };
    const next = removeProject(workspace, only.id);

    expect(next.projects).toHaveLength(1);
    expect(next.projects[0]?.id).not.toBe(only.id);
    expect(next.activeProjectId).toBe(next.projects[0]?.id);
  });
});
