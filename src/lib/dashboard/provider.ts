import type { DashboardSnapshot, Period } from './contracts';

export interface SnapshotRequest {
  period: Period;
}

/**
 * Replaceable data boundary. Implementations:
 * - asynchronous in-browser demo provider (providers/demo.ts)
 * - HTTP provider calling the internal NestJS reporting API (after approval)
 * Implementations resolve with a validated snapshot or reject with a
 * DashboardDataError, and honour the AbortSignal.
 * SAP credentials and connector logic never live in the frontend.
 */
export interface DashboardDataProvider {
  /**
   * Identifies the data this provider serves, e.g. the demo reference
   * timestamp. Part of every query key so cached snapshots never mix sources.
   */
  readonly scope: string;
  getSnapshot(request: SnapshotRequest, signal?: AbortSignal): Promise<DashboardSnapshot>;
}
