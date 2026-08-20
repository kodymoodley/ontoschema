import { createEmptyOntology, createId, createProject } from '../ontologymodel';
import type { Annotation, Ontology, Project, PropertyUsage } from '../ontologymodel';
import { isXsdDatatype } from '../annotationvocabulary';
import type { XsdDatatype } from '../annotationvocabulary';
import { createSaveQueue } from './savequeue';
import { emptyWorkspace } from './workspace';
import type { Workspace } from './workspace';

/**
 * Browser-local persistence. Deliberately the only place that knows about localStorage, so
 * swapping in a real backend later means replacing this file and nothing else.
 */

/**
 * Exported so that tests seeding or inspecting a stored workspace name it through the module
 * that owns it, rather than repeating the literal and drifting from it.
 */
export const STORAGE_KEY = 'ontoschema.workspace.v1';

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Private-browsing modes throw on access rather than returning null.
    return null;
  }
}

export function loadWorkspace(): Workspace {
  const store = storage();
  if (!store) return emptyWorkspace();
  const raw = store.getItem(STORAGE_KEY);
  if (!raw) return emptyWorkspace();
  try {
    const parsed = reviveWorkspace(JSON.parse(raw));
    return parsed ?? emptyWorkspace();
  } catch {
    // A corrupt or hand-edited entry must not brick the app.
    return emptyWorkspace();
  }
}

function writeWorkspace(workspace: Workspace): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // Quota exceeded: the session continues, it just will not be restored.
  }
}

/*
 * Durability is this module's job, so when to write belongs here too, next to where. Writes
 * are batched — see `savequeue` for why — and flushed when the page is going away, which is
 * the one moment a pending write would otherwise be lost.
 */
const queue = createSaveQueue(writeWorkspace);

if (typeof window !== 'undefined') {
  // `pagehide` covers navigation and closing; `visibilitychange` covers a phone being locked
  // or the tab being switched away from, which on mobile may be the last event we ever get.
  window.addEventListener('pagehide', () => queue.flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') queue.flush();
  });
}

/**
 * Persists the workspace. The write is batched unless `immediate`, which is for the moments a
 * user would read as a commit point — creating, switching or deleting a project.
 */
export function saveWorkspace(workspace: Workspace, options: { immediate?: boolean } = {}): void {
  queue.save(workspace);
  if (options.immediate) queue.flush();
}

/** Writes any batched workspace out now. */
export function flushWorkspace(): void {
  queue.flush();
}

export function clearWorkspace(): void {
  storage()?.removeItem(STORAGE_KEY);
}

/**
 * Defensive revival. Stored documents may predate a field or have been edited by hand, so
 * every entity is rebuilt with defaults rather than trusted wholesale.
 */
export function reviveWorkspace(value: unknown): Workspace | null {
  if (!isRecord(value) || !Array.isArray(value.projects)) return null;
  const projects = value.projects
    .map((project) => reviveProject(project))
    .filter((project): project is Project => project !== null);
  if (projects.length === 0) return null;

  const activeProjectId =
    typeof value.activeProjectId === 'string' &&
    projects.some((project) => project.id === value.activeProjectId)
      ? value.activeProjectId
      : (projects[0]?.id ?? null);

  return { projects, activeProjectId };
}

export function reviveProject(value: unknown): Project | null {
  if (!isRecord(value)) return null;
  const ontology = reviveOntology(value.ontology);
  if (!ontology) return null;
  const now = new Date().toISOString();
  return {
    id: typeof value.id === 'string' ? value.id : createProject('').id,
    name: typeof value.name === 'string' && value.name.trim() ? value.name : 'Untitled ontology',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now,
    ontology,
  };
}

/**
 * Keys used before relations became relations and attributes became attributes.
 *
 * A document written then has to be refused rather than read. Nothing here throws on a missing
 * key -- an absent list simply revives as an empty one -- so an old document would otherwise open
 * looking almost right, with every relation and attribute silently gone, and the save queue would
 * write that back over the original within the second. Failing to open is recoverable. Opening
 * and quietly discarding half the schema is not.
 */
function writtenBeforeTheRename(value: Record<string, unknown>): boolean {
  const oldNames = 'objectProperties' in value || 'datatypeProperties' in value;
  const newNames = 'relations' in value || 'attributes' in value;
  return oldNames && !newNames;
}

function reviveOntology(value: unknown): Ontology | null {
  if (!isRecord(value)) return null;
  if (writtenBeforeTheRename(value)) return null;
  const base = createEmptyOntology(
    typeof value.iri === 'string' ? value.iri : undefined,
    typeof value.prefix === 'string' ? value.prefix : undefined,
  );
  return {
    ...base,
    annotations: reviveAnnotations(value.annotations),
    classes: records(value.classes)
      .filter((entity) => typeof entity.id === 'string' && typeof entity.localName === 'string')
      .map((entity) => ({
        id: entity.id as string,
        localName: entity.localName as string,
        superClassIds: toStringArray(entity.superClassIds),
        annotations: reviveAnnotations(entity.annotations),
        position: revivePosition(entity.position),
      })),
    relations: records(value.relations)
      .filter((entity) => typeof entity.id === 'string' && typeof entity.localName === 'string')
      .map((entity) => ({
        id: entity.id as string,
        localName: entity.localName as string,
        superPropertyIds: toStringArray(entity.superPropertyIds),
        annotations: reviveAnnotations(entity.annotations),
      })),
    attributes: records(value.attributes)
      .filter((entity) => typeof entity.id === 'string' && typeof entity.localName === 'string')
      .map((entity) => ({
        id: entity.id as string,
        localName: entity.localName as string,
        range: isXsdDatatype(String(entity.range)) ? (entity.range as XsdDatatype) : 'string',
        superPropertyIds: toStringArray(entity.superPropertyIds),
        annotations: reviveAnnotations(entity.annotations),
      })),
    usages: reviveUsages(value),
  };
}

/**
 * Usages, either read directly or reconstructed from a document written before properties
 * carried their domain and range on the property itself.
 */
function reviveUsages(value: Record<string, unknown>): PropertyUsage[] {
  const stored = records(value.usages)
    .filter(
      (usage) => typeof usage.propertyId === 'string' && typeof usage.subjectClassId === 'string',
    )
    .map((usage) => ({
      id: typeof usage.id === 'string' ? usage.id : createId('use'),
      propertyId: usage.propertyId as string,
      subjectClassId: usage.subjectClassId as string,
      objectClassId: typeof usage.objectClassId === 'string' ? usage.objectClassId : null,
    }));
  if (stored.length > 0 || Array.isArray(value.usages)) return stored;

  return [
    ...records(value.attributes)
      .filter((entity) => typeof entity.id === 'string' && typeof entity.domainClassId === 'string')
      .map((entity) => ({
        id: createId('use'),
        propertyId: entity.id as string,
        subjectClassId: entity.domainClassId as string,
        objectClassId: null,
      })),
    ...records(value.relations)
      .filter((entity) => typeof entity.id === 'string' && typeof entity.domainClassId === 'string')
      .map((entity) => ({
        id: createId('use'),
        propertyId: entity.id as string,
        subjectClassId: entity.domainClassId as string,
        objectClassId: typeof entity.rangeClassId === 'string' ? entity.rangeClassId : null,
      })),
  ];
}

function reviveAnnotations(value: unknown): Annotation[] {
  return records(value)
    .filter((entry) => typeof entry.term === 'string')
    .map((entry) => {
      const annotation: Annotation = {
        id: typeof entry.id === 'string' ? entry.id : createId('ann'),
        term: entry.term as string,
        value: typeof entry.value === 'string' ? entry.value : '',
      };
      if (typeof entry.language === 'string' && entry.language)
        annotation.language = entry.language;
      return annotation;
    });
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function revivePosition(value: unknown): { x: number; y: number } {
  if (!isRecord(value)) return { x: 0, y: 0 };
  return {
    x: typeof value.x === 'number' && Number.isFinite(value.x) ? value.x : 0,
    y: typeof value.y === 'number' && Number.isFinite(value.y) ? value.y : 0,
  };
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/* ------------------------------------------------------ file exchange */

/*
 * 2 since relations and attributes were renamed, which changed the keys a project file is
 * written with. Version 1 files are refused rather than read: see `writtenBeforeTheRename`.
 */
export const PROJECT_FILE_VERSION = 2;

export function projectToFile(project: Project): string {
  return `${JSON.stringify({ version: PROJECT_FILE_VERSION, project }, null, 2)}\n`;
}

/**
 * The whole workspace as one file: every project, exactly as it stands, with no lossy rules.
 *
 * The one thing RDF cannot do. A Turtle document is one ontology and a workspace is several,
 * so a backup is not a compromise in the save format — it is the answer to the gap the save
 * format leaves. It is a snapshot of this browser rather than a document to hand anyone, which
 * is why it stays a private format and why nothing else is expected to read it.
 *
 * Versioned with the same number as a project file, because what it contains *is* projects and
 * they are what the version describes.
 */
export function workspaceToFile(workspace: Workspace): string {
  return `${JSON.stringify({ version: PROJECT_FILE_VERSION, workspace }, null, 2)}
`;
}

export function workspaceFromFile(content: string): Workspace | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!isRecord(parsed)) return null;
    if (typeof parsed.version === 'number' && parsed.version < PROJECT_FILE_VERSION) return null;
    /*
     * A project file is not a backup, and must not be read as one: `reviveWorkspace` would find
     * no `projects` array and return null, but saying so explicitly is what keeps the two file
     * kinds from ever being confused as the format grows.
     */
    const workspace = parsed.workspace ?? parsed;
    if (!isRecord(workspace) || !Array.isArray(workspace.projects)) return null;
    return reviveWorkspace(workspace);
  } catch {
    return null;
  }
}

export function projectFromFile(content: string): Project | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!isRecord(parsed)) return null;
    /*
     * The version was written but never read, which made it decoration. It is checked now, so a
     * file from before the rename is turned away by its own stated version rather than only by
     * the shape of its keys. Both checks stay: a workspace in local storage carries no version.
     */
    if (typeof parsed.version === 'number' && parsed.version < PROJECT_FILE_VERSION) return null;
    // Accept both the wrapped file format and a bare project object.
    return reviveProject(parsed.project ?? parsed);
  } catch {
    return null;
  }
}
