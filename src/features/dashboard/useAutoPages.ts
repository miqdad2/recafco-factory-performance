import { useEffect, useSyncExternalStore } from 'react';

/** How long each Project Summary page stays on screen while automatic paging runs. */
export const AUTO_PAGE_MS = 15_000;

function subscribeToVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

const isDocumentVisible = () => document.visibilityState !== 'hidden';

/** Whether the browser tab is visible; updates when the user switches tabs. */
export function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribeToVisibility, isDocumentVisible, () => true);
}

interface AutoPagesOptions {
  /** The user turned automatic paging on. */
  enabled: boolean;
  /** Something needs the page to stay put: focus, pointer, open selector, loading or failure. */
  paused: boolean;
  pageCount: number;
  /** Moves to the given page; called from the timer only. */
  setPage: (update: (page: number) => number) => void;
}

/**
 * Advances pages every AUTO_PAGE_MS and loops to the first. Runs only while enabled,
 * not paused, the tab is visible and there are at least two pages. Any change to those
 * conditions clears the interval, and running again starts a fresh one: time spent
 * hidden or paused never skips pages. Returns whether paging is actually running.
 */
export function useAutoPages({ enabled, paused, pageCount, setPage }: AutoPagesOptions): boolean {
  const visible = useDocumentVisible();
  const running = enabled && !paused && visible && pageCount >= 2;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setPage((page) => (page + 1) % pageCount), AUTO_PAGE_MS);
    return () => window.clearInterval(timer);
  }, [running, pageCount, setPage]);

  return running;
}
