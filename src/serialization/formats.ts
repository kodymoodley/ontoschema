/**
 * Which files open as which syntax, told by their extension.
 *
 * Apart from the reader in `read.ts` because the two are needed at different times. Choosing a
 * file has to know at once whether it is a schema at all; reading one happens only once it has
 * been chosen, and the reader is fetched then rather than with the app.
 */

export type ImportFormat = 'turtle' | 'rdfxml';

/** The formats `open` accepts, by the extension a file arrives with. */
const BY_EXTENSION: Record<string, ImportFormat> = {
  ttl: 'turtle',
  turtle: 'turtle',
  n3: 'turtle',
  nt: 'turtle',
  rdf: 'rdfxml',
  owl: 'rdfxml',
  xml: 'rdfxml',
};

export function formatForFilename(filename: string): ImportFormat | undefined {
  const extension = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  return BY_EXTENSION[extension];
}
