/**
 * Browser download plumbing. Isolated in its own file because it is the one piece of this
 * module that touches the DOM directly, which keeps the panel itself easy to reason about
 * and lets tests exercise the serializers without a document.
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
