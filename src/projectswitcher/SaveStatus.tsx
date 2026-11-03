import { useState } from 'react';
import { Button, Modal } from '../designsystem';
import { canLinkFiles, fileLinks, useFileLink } from '../filelink';
import type { LinkStatus } from '../filelink';
import { useActiveProject } from '../projectstore';
import styles from './projectswitcher.module.css';

/**
 * Where the open schema's work is kept, beside its name: in a file on disk, or in this browser.
 *
 * Quiet while all is well and a button when something needs a decision, because a schema in a
 * git repository is only as current as the file is, and the moment it stops being current is the
 * one moment the person has to know about.
 */
export function SaveStatus() {
  const project = useActiveProject();
  const status = useFileLink(project?.id);
  const [asking, setAsking] = useState<'conflict' | 'paused' | 'missing' | null>(null);

  if (!project) return null;
  const id = project.id;
  const answer = (action: () => Promise<void>) => {
    setAsking(null);
    void action();
  };

  return (
    <div className={styles.saveStatus} role="status" aria-live="polite" data-testid="save-status">
      <StatusLine status={status} onAsk={setAsking} onReconnect={() => fileLinks.reconnect(id)} />

      <Modal
        title="The file changed while you were editing"
        open={asking === 'conflict' && status?.kind === 'conflict'}
        onClose={() => setAsking(null)}
        footer={
          <>
            <Button
              variant="subtle"
              onClick={() => answer(() => fileLinks.takeFile(id))}
              data-testid="take-file"
            >
              Take the file
            </Button>
            <Button
              variant="primary"
              onClick={() => answer(() => fileLinks.keepMine(id))}
              data-testid="keep-mine"
            >
              Keep my edits
            </Button>
          </>
        }
      >
        <p className={styles.confirmText}>
          Something else changed <strong>{status?.file}</strong>, perhaps a <code>git pull</code>,
          while there were edits here that were not yet saved into it. Keep your edits to write them
          over the file, or take the file to read it back and drop them.
        </p>
      </Modal>

      <Modal
        title="Saving would lose part of the file"
        open={asking === 'paused' && status?.kind === 'paused'}
        onClose={() => setAsking(null)}
        footer={
          <>
            <Button variant="subtle" onClick={() => answer(() => fileLinks.unlink(id))}>
              Keep it in this browser
            </Button>
            <Button
              variant="danger"
              onClick={() => answer(() => fileLinks.resume(id))}
              data-testid="save-into-file"
            >
              Save into {status?.file}
            </Button>
          </>
        }
      >
        <p className={styles.confirmText}>
          <strong>{status?.file}</strong> holds things OntoSchema does not model, which were left
          out when it opened. Saving into it would remove them from the file. To keep the original
          whole, use <strong>File › Save as…</strong> to save to a new file instead.
        </p>
      </Modal>

      <Modal
        title="The file has gone"
        open={asking === 'missing' && status?.kind === 'missing'}
        onClose={() => setAsking(null)}
        footer={
          <>
            <Button variant="subtle" onClick={() => answer(() => fileLinks.unlink(id))}>
              Keep it in this browser
            </Button>
            <Button variant="primary" onClick={() => answer(() => fileLinks.check(id))}>
              Look again
            </Button>
          </>
        }
      >
        <p className={styles.confirmText}>
          <strong>{status?.file}</strong> was moved, renamed or deleted, so nothing is being saved
          into it. Your work is still kept in this browser. Use <strong>File › Save as…</strong> to
          save it somewhere new.
        </p>
      </Modal>
    </div>
  );
}

function StatusLine({
  status,
  onAsk,
  onReconnect,
}: {
  status: LinkStatus | undefined;
  onAsk: (question: 'conflict' | 'paused' | 'missing') => void;
  onReconnect: () => void;
}) {
  if (!status) {
    return (
      <span
        className={styles.saveStatusText}
        title={
          canLinkFiles()
            ? 'Saved in this browser. Open a file, or use Save as…, to keep it in a file instead.'
            : 'Saved in this browser. This browser cannot save straight into a file, so Save as… downloads one.'
        }
      >
        In this browser
      </span>
    );
  }

  const file = status.file;
  switch (status.kind) {
    case 'saved':
      return (
        <span className={styles.saveStatusText} title={`Every edit is saved into ${file}.`}>
          Saved to {file}
        </span>
      );
    case 'saving':
      return <span className={styles.saveStatusText}>Saving to {file}…</span>;
    case 'permission':
      return (
        <Button size="small" variant="subtle" onClick={onReconnect} data-testid="reconnect-file">
          Reconnect {file}
        </Button>
      );
    case 'paused':
      return (
        <Button size="small" variant="subtle" onClick={() => onAsk('paused')}>
          Not saving to {file}
        </Button>
      );
    case 'conflict':
      return (
        <Button
          size="small"
          variant="subtle"
          className={styles.saveStatusAlert}
          onClick={() => onAsk('conflict')}
          data-testid="file-conflict"
        >
          {file} changed on disk
        </Button>
      );
    case 'missing':
      return (
        <Button
          size="small"
          variant="subtle"
          className={styles.saveStatusAlert}
          onClick={() => onAsk('missing')}
        >
          {file} has gone
        </Button>
      );
    case 'failed':
      return (
        <span
          className={`${styles.saveStatusText} ${styles.saveStatusAlert}`}
          title={status.reason}
        >
          Could not save to {file}
        </span>
      );
  }
}
