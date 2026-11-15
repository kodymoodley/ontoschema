import type { Point } from '../designsystem';
import type { RoutingScene } from './avoidrouter';

/**
 * Asks the routing worker for routes, keeping up with a canvas that changes faster than it can
 * answer.
 *
 * Only the newest scene matters. While one is being routed, any that arrive replace each other,
 * and only the last is sent when the answer comes back: a drag that moves a class sixty times a
 * second costs as many routings as the worker has time for, never a backlog of stale ones.
 *
 * If the worker cannot start -- WebAssembly blocked, say -- routing is given up for the session
 * and the lines are drawn as plain steps, as they were before there was a router.
 */

type Routes = ReadonlyMap<string, Point[]>;

let worker: Worker | null = null;
let unavailable = false;
let routing = false;
let waiting: RoutingScene | null = null;
let listener: ((routes: Routes) => void) | null = null;

function start(): Worker {
  const started = new Worker(new URL('./avoid.worker.ts', import.meta.url), { type: 'module' });
  started.addEventListener('message', (event: MessageEvent<Routes>) => {
    routing = false;
    listener?.(event.data);
    sendWaiting();
  });
  started.addEventListener('error', () => {
    unavailable = true;
    started.terminate();
    worker = null;
  });
  return started;
}

function sendWaiting() {
  if (routing || waiting === null || unavailable) return;
  worker ??= start();
  routing = true;
  worker.postMessage(waiting);
  waiting = null;
}

/** Routes this scene as soon as the worker is free, replacing any scene still waiting. */
export function requestRoutes(scene: RoutingScene): void {
  waiting = scene;
  sendWaiting();
}

/** Hears every set of routes the worker sends back. One listener: the schema canvas. */
export function listenForRoutes(heard: (routes: Routes) => void): () => void {
  listener = heard;
  return () => {
    if (listener === heard) listener = null;
  };
}
