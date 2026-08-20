import type { ReactNode } from 'react';
import { ExportPanel } from '../exportpanel';
import { useDialogAction } from './useDialogAction';

/**
 * Writing the schema out, as an item in the file menu and the dialog it opens.
 *
 * Called twice, once for each purpose: saving produces a document that opens again, exporting
 * produces a rendering that does not. Same shape, different list.
 *
 * Export is a file action, not a property of whatever happens to be selected, which is why it is
 * no longer an inspector tab: it was the one tab that had nothing to do with the selection, and
 * it reset to Details whenever you clicked a class.
 */
export function useExportAction(purpose: 'save' | 'export' = 'export'): {
  action: ReactNode;
  dialog: ReactNode;
} {
  const saving = purpose === 'save';

  return useDialogAction({
    label: saving ? 'Save as…' : 'Export…',
    title: saving ? 'Save as' : 'Export',
    testId: saving ? 'open-save' : 'open-export',
    children: <ExportPanel purpose={purpose} />,
  });
}
