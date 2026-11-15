import { AvoidLib } from 'libavoid-js';
import wasmUrl from 'libavoid-js/libavoid.wasm?url';
import { createAvoidRouter } from './avoidrouter';
import type { AvoidApi, RoutingScene } from './avoidrouter';

/**
 * The line router, off the main thread.
 *
 * Routing is a few milliseconds on a schema of ordinary size and about fifty on one of 200
 * classes, and it runs on every frame of a drag. Here that never holds up the drag itself; the
 * lines catch up as soon as each answer is back. It also keeps libavoid's 180 kB of WebAssembly
 * out of the page until the schema canvas first asks for a route.
 *
 * One scene in, every route out, in order: the client sends the next scene only once this one is
 * answered, so there is never a queue to work through.
 */

// Named outright: the library looks for its WebAssembly under its original file name, which the
// build has fingerprinted. The alias is in `vite.config.ts`.
const routing = AvoidLib.load(wasmUrl).then(() =>
  createAvoidRouter(AvoidLib.getInstance() as unknown as AvoidApi),
);

globalThis.addEventListener('message', (event: MessageEvent<RoutingScene>) => {
  void routing.then((router) => globalThis.postMessage(router.route(event.data)));
});
