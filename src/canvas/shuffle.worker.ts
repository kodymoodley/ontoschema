import { shuffleLayout } from './shuffle';
import type { ShuffleRequest, ShuffleResult } from './shuffle';

/**
 * The shuffle, off the main thread.
 *
 * A shuffle lays the schema out a dozen times or more, which on a big schema takes about a
 * second. Run on the page, that second would freeze the canvas and the button that asked for it.
 * Here it runs beside them, and it brings its own copy of the layout engines, so d3-dag is
 * downloaded only by someone who presses Shuffle.
 */

export interface ShuffleJob {
  id: number;
  request: ShuffleRequest;
}

export interface ShuffleReply {
  id: number;
  result: ShuffleResult;
}

globalThis.addEventListener('message', (event: MessageEvent<ShuffleJob>) => {
  const { id, request } = event.data;
  const reply: ShuffleReply = { id, result: shuffleLayout(request) };
  globalThis.postMessage(reply);
});
