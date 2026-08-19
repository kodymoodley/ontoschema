import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Modal } from '../designsystem';
import { ExportPanel } from '../exportpanel';

/**
 * Export, as an item in the file menu and the dialog it opens.
 *
 * Two pieces because they cannot be rendered in the same place. The item goes inside the menu
 * panel, which unmounts the moment anything in it is clicked; a dialog rendered there would be
 * torn down by the very click meant to open it. So the state lives out here and the caller puts
 * each piece where it belongs.
 *
 * Export is a file action, not a property of whatever happens to be selected, which is why it is
 * no longer an inspector tab: it was the one tab that had nothing to do with the selection, and
 * it reset to Details whenever you clicked a class.
 */
export function useExportAction(): { action: ReactNode; dialog: ReactNode } {
  const [open, setOpen] = useState(false);

  return {
    action: (
      <Button size="small" variant="subtle" onClick={() => setOpen(true)} data-testid="open-export">
        Export
      </Button>
    ),
    dialog: (
      <Modal
        title="Export"
        size="wide"
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <Button variant="subtle" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        <ExportPanel />
      </Modal>
    ),
  };
}
