import type { ShuffleRequest, ShuffleResult } from './shuffle';
import type { ShuffleJob, ShuffleReply } from './shuffle.worker';

/**
 * Asks the shuffle worker for a layout.
 *
 * One worker, started on the first shuffle and kept: starting one means fetching and compiling
 * the layout engines, which is worth doing once rather than on every press. Each job carries an
 * id, so a reply is only ever taken by the job that asked for it.
 */

let worker: Worker | null = null;
let lastId = 0;

export function shuffleInBackground(request: ShuffleRequest): Promise<ShuffleResult> {
  const running = (worker ??= new Worker(new URL('./shuffle.worker.ts', import.meta.url), {
    type: 'module',
  }));
  lastId += 1;
  const id = lastId;

  return new Promise((resolve, reject) => {
    const finish = () => {
      running.removeEventListener('message', onMessage);
      running.removeEventListener('error', onError);
    };
    const onMessage = (event: MessageEvent<ShuffleReply>) => {
      if (event.data.id !== id) return;
      finish();
      resolve(event.data.result);
    };
    const onError = (event: ErrorEvent) => {
      finish();
      // A worker that has failed once is not trusted with the next job; the next press starts a
      // fresh one.
      running.terminate();
      if (worker === running) worker = null;
      reject(new Error(event.message || 'The shuffle could not run.'));
    };
    running.addEventListener('message', onMessage);
    running.addEventListener('error', onError);
    const job: ShuffleJob = { id, request };
    running.postMessage(job);
  });
}
