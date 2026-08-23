/**
 * Browser download plumbing: hand the user a file without a server to fetch it from.
 *
 * Here rather than in the module that first needed it, because two modules need it and no UI
 * module may import a sibling. It was copied into the project switcher instead, and the copy
 * had already drifted — it lost `rel="noopener"` and the note about why the revoke waits a
 * tick. `designsystem` is the leaf both may import, and this depends on nothing but the DOM.
 */
export function downloadFile(filename: string, mimeType: string, content: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download in some browsers; one tick is enough.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
