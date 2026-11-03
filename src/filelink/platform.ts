import { fileOpen, fileSave } from 'browser-fs-access';
import type { SerializationFormat } from '../serialization';

/**
 * The parts of the browser this module leans on, and nothing else in the app touches.
 *
 * The File System Access API is in desktop Chrome and Edge. Firefox and Safari have declined it,
 * and there the app keeps working as it always has: the browser copy saves itself, and saving a
 * file downloads it. Everything here is typed down to what is actually used, so a test can stand
 * in an in-memory file for a real one.
 */

/** Somewhere to write a file's new contents; the browser swaps it in whole on `close`. */
export interface FileWriter {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

/** A file on disk this app may read and, with permission, write. */
export interface LinkedFileHandle {
  readonly name: string;
  getFile(): Promise<Blob>;
  createWritable(): Promise<FileWriter>;
  /** Absent where the browser grants access without asking, as for a test's in-memory file. */
  queryPermission?(descriptor: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: 'readwrite' }): Promise<PermissionState>;
}

/** Whether this browser can link a schema to a file at all. */
export function canLinkFiles(): boolean {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
}

/** The formats a linked file can be written back in: the ones that open here again. */
export type DocumentFormat = Extract<SerializationFormat, 'turtle' | 'rdfxml' | 'owl'>;

const WRITABLE: Record<string, DocumentFormat> = { ttl: 'turtle', rdf: 'rdfxml', owl: 'owl' };

/**
 * The format a file is written back in, from its name, or `undefined` when it cannot be.
 *
 * Narrower than what opens. An `.nt` or `.n3` file opens as Turtle, but writing Turtle into it
 * would change what kind of file it is, so such a file opens without being linked.
 */
export function writableFormat(filename: string): DocumentFormat | undefined {
  return WRITABLE[filename.slice(filename.lastIndexOf('.') + 1).toLowerCase()];
}

/** Stops whatever a `watch` started. */
export type Unwatch = () => void;

/** Calls `onChange` when the file may have changed on disk. */
export type Watch = (handle: LinkedFileHandle, onChange: () => void) => Unwatch;

interface FileSystemObserverLike {
  observe(handle: LinkedFileHandle): Promise<void>;
  disconnect(): void;
}

declare global {
  interface Window {
    showOpenFilePicker?: unknown;
    FileSystemObserver?: new (callback: () => void) => FileSystemObserverLike;
  }
}

/**
 * Watches a file with `FileSystemObserver`, in Chrome 133 and later on the desktop, which reports
 * a `git pull` or another editor's save as it happens. Where it is missing this does nothing, and
 * the file is checked whenever the tab regains focus instead.
 */
export const watchWithObserver: Watch = (handle, onChange) => {
  const Observer = typeof window === 'undefined' ? undefined : window.FileSystemObserver;
  if (!Observer) return () => {};
  const observer = new Observer(onChange);
  // An observer that cannot be started leaves the focus check to do the job on its own.
  observer.observe(handle).catch(() => {});
  return () => observer.disconnect();
};

/** What the person chose to open: the file, and a handle on it where the browser gives one. */
export interface PickedFile {
  file: File;
  handle: LinkedFileHandle | null;
}

const OPENABLE = ['.ttl', '.rdf', '.owl', '.json'];

/**
 * Asks for a schema to open, through the picker that hands back a handle on the file. `null`
 * when the person cancelled.
 */
export async function pickFileToOpen(): Promise<PickedFile | null> {
  try {
    const file = await fileOpen({
      description: 'Schemas',
      extensions: OPENABLE,
      mimeTypes: ['text/turtle', 'application/rdf+xml', 'application/json'],
      // Remembers the folder per purpose, so the picker reopens in the repository last used.
      id: 'ontoschema-open',
    });
    return { file, handle: file.handle ?? null };
  } catch (error) {
    if (isCancel(error)) return null;
    throw error;
  }
}

/**
 * Asks where to save a schema and writes it there. Returns the handle when the browser gave one,
 * and `null` when it downloaded the file instead or the person cancelled.
 */
export async function pickFileToSave(
  content: string,
  file: { name: string; extension: string; mimeType: string },
): Promise<LinkedFileHandle | null> {
  try {
    return await fileSave(new Blob([content], { type: file.mimeType }), {
      fileName: file.name,
      extensions: [`.${file.extension}`],
      id: 'ontoschema-save',
    });
  } catch (error) {
    if (isCancel(error)) return null;
    throw error;
  }
}

const isCancel = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';
