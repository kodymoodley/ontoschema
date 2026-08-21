import { createProject } from '../ontologymodel';
import type { Ontology, Project } from '../ontologymodel';

/**
 * The set of projects and which one is open, as pure data and pure transitions.
 *
 * Project management is ordinary list manipulation with one invariant — there is always
 * something to edit — so it lives here rather than inside the store, where it would need a
 * running Zustand instance to exercise.
 */

export interface Workspace {
  projects: Project[];
  activeProjectId: string | null;
}

/**
 * What a project is called before anyone names it.
 *
 * _Schema_ rather than _ontology_ on screen: the app's users are far likelier to have the first
 * word, and the exported RDF still says `owl:Ontology`, exactly as it still says
 * `owl:ObjectProperty` for what the interface calls a relation.
 */
export const UNTITLED = 'Untitled schema';

export function emptyWorkspace(): Workspace {
  const project = createProject(UNTITLED);
  return { projects: [project], activeProjectId: project.id };
}

export function activeProject(workspace: Workspace): Project | undefined {
  return workspace.projects.find((project) => project.id === workspace.activeProjectId);
}

export function activeOntologyOf(workspace: Workspace): Ontology | undefined {
  return activeProject(workspace)?.ontology;
}

/** Replaces the open project's ontology and stamps it as touched. */
export function withOntology(workspace: Workspace, ontology: Ontology): Workspace {
  const open = activeProject(workspace);
  if (!open) return workspace;
  return {
    ...workspace,
    projects: workspace.projects.map((project) =>
      project.id === open.id
        ? { ...project, ontology, updatedAt: new Date().toISOString() }
        : project,
    ),
  };
}

/** Restores an ontology without touching `updatedAt`, which is what undo and redo want. */
export function withRestoredOntology(workspace: Workspace, ontology: Ontology): Workspace {
  const open = activeProject(workspace);
  if (!open) return workspace;
  return {
    ...workspace,
    projects: workspace.projects.map((project) =>
      project.id === open.id ? { ...project, ontology } : project,
    ),
  };
}

/** Adds a project and opens it. */
export function addProject(workspace: Workspace, project: Project): Workspace {
  return { projects: [...workspace.projects, project], activeProjectId: project.id };
}

export function activateProject(workspace: Workspace, id: string): Workspace {
  if (!workspace.projects.some((project) => project.id === id)) return workspace;
  return { ...workspace, activeProjectId: id };
}

export function renameProject(workspace: Workspace, id: string, name: string): Workspace {
  const trimmed = name.trim();
  if (!trimmed) return workspace;
  return {
    ...workspace,
    projects: workspace.projects.map((project) =>
      project.id === id
        ? { ...project, name: trimmed, updatedAt: new Date().toISOString() }
        : project,
    ),
  };
}

/**
 * Removes a project, keeping the invariant that the workspace always holds at least one —
 * so there is never a state where the app has nothing to show.
 */
export function removeProject(workspace: Workspace, id: string): Workspace {
  const remaining = workspace.projects.filter((project) => project.id !== id);
  const projects = remaining.length > 0 ? remaining : [createProject(UNTITLED)];
  const activeProjectId =
    workspace.activeProjectId === id ? (projects[0]?.id ?? null) : workspace.activeProjectId;
  return { projects, activeProjectId };
}
