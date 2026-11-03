import type { ReactNode } from 'react';
import { ExportPanel } from '../exportpanel';
import { useDialogAction } from './useDialogAction';

/**
 * Writing the schema out, as an item in the file menu and the dialog it opens.
 *
 * Called twice, once for each purpose: saving produces a document that opens again, exporting
 * produces a rendering that does not. Same shape, different list. The export item says what its
 * files are for, "for other tools", because the two used to read as the same action twice.
 *
 * Export is a file action, not a property of whatever happens to be selected, which is why it is
 * no longer an inspector tab: it was the one tab that had nothing to do with the selection, and
 * it reset to Details whenever you clicked a class.
 */
export function useExportAction(purpose: 'save' | 'export' = 'export'): {
  action: ReactNode;
  dialog: ReactNode;
  /** Opens the dialog from code, for `Ctrl`+`S` on a schema not yet linked to a file. */
  setOpen: (open: boolean) => void;
} {
  const saving = purpose === 'save';

  return useDialogAction({
    label: saving ? 'Save as…' : 'Export for other tools…',
    title: saving ? 'Save as' : 'Export for other tools',
    testId: saving ? 'open-save' : 'open-export',
    children: <ExportPanel purpose={purpose} />,
  });
}
