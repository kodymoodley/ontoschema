import type { Page } from '@playwright/test';

/**
 * Instruments for measuring how the app behaves under load, rather than only whether it is
 * correct.
 *
 * Frame gaps are sampled with `requestAnimationFrame` rather than the `longtask` performance
 * entry, because only Chromium reports long tasks. A frame callback cannot run while the main
 * thread is busy, so the gap between two of them is the block the user actually feels — and
 * it is measured the same way in every engine.
 */

declare global {
  interface Window {
    frameGaps?: number[];
    frameHandle?: number;
    storageWrites?: { key: string; bytes: number }[];
  }
}

export interface FrameReport {
  frames: number;
  /** The longest gap between two frames: the worst stall the interaction caused, in ms. */
  worst: number;
  p95: number;
  median: number;
}

export async function startRecordingFrames(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.frameGaps = [];
    let previous = performance.now();
    const tick = (now: number) => {
      window.frameGaps?.push(now - previous);
      previous = now;
      window.frameHandle = requestAnimationFrame(tick);
    };
    window.frameHandle = requestAnimationFrame(tick);
  });
}

export async function stopRecordingFrames(page: Page): Promise<FrameReport> {
  return page.evaluate(() => {
    if (window.frameHandle !== undefined) cancelAnimationFrame(window.frameHandle);
    // The first gap is measured from before the first frame, so it says nothing about the run.
    const gaps = (window.frameGaps ?? []).slice(1).sort((a, b) => a - b);
    const at = (fraction: number) =>
      gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * fraction))] ?? 0;
    return {
      frames: gaps.length,
      worst: gaps[gaps.length - 1] ?? 0,
      p95: at(0.95),
      median: at(0.5),
    };
  });
}

/**
 * Records every `localStorage` write from before the app boots. Installed as an init script,
 * so it has to be called before navigating.
 */
export async function recordStorageWrites(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.storageWrites = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      window.storageWrites?.push({ key, bytes: value.length });
      return original.call(this, key, value);
    };
  });
}

export async function storageWrites(page: Page): Promise<{ key: string; bytes: number }[]> {
  return page.evaluate(() => window.storageWrites ?? []);
}
