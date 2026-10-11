import { buildDashboardSnapshot, prepareDataset, type PreparedDataset } from '../aggregate';
import { DashboardDataError } from '../errors';
import { toKuwaitIso } from '../periods';
import type { DashboardDataProvider } from '../provider';
import { parseDemoDataset, parseSnapshot } from '../validate';
import { DEMO_REFERENCE_TIME } from '../fixtures/catalog';
import { getDemoDataset } from '../fixtures/generate';

export interface DemoProviderOptions {
  /** Simulated network delay. */
  delayMs?: number;
  /** Clock used only for `fetchedAt` (when the display obtained the data). */
  now?: () => number;
  /** Source of raw records; replaceable in tests. Validated before use. */
  loadDataset?: () => unknown;
  /** Cache scope; defaults to the demo reference timestamp. */
  scope?: string;
}

function abortError(): DashboardDataError {
  return new DashboardDataError('aborted', 'Request cancelled');
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * In-browser demo provider: synthetic records only, no network, no SAP.
 * Validates its source records once and every snapshot it returns.
 */
export function createDemoProvider(options: DemoProviderOptions = {}): DashboardDataProvider {
  const { delayMs = 450, now = Date.now, loadDataset = getDemoDataset, scope = `demo@${DEMO_REFERENCE_TIME}` } = options;
  let prepared: PreparedDataset | null = null;

  return {
    scope,
    async getSnapshot({ period }, signal) {
      await wait(delayMs, signal);
      prepared ??= prepareDataset(parseDemoDataset(loadDataset()));
      if (signal?.aborted) throw abortError();
      const core = buildDashboardSnapshot(prepared, period);
      return parseSnapshot({ ...core, source: 'demo', fetchedAt: toKuwaitIso(now()) });
    },
  };
}
