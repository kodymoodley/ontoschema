import { fileOpen, fileSave } from 'browser-fs-access';
import type { LinkedFileHandle } from './platform';

/*
 * The two file pickers, apart from the rest of the platform layer because the library behind
 * them does work as soon as it loads. Nothing reaches this file until a file is first opened or
 * saved, so a session that never links a file never downloads it.
 */

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
