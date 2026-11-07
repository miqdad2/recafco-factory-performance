import { QueryClient, queryOptions } from '@tanstack/react-query';
import { isDashboardDataError } from '../../lib/dashboard/errors';
import type { DashboardDataProvider, SnapshotRequest } from '../../lib/dashboard/provider';

/** One cache entry per data scope (source and reference time), period and project. */
export const snapshotQueryKey = (scope: string, { period, project }: SnapshotRequest) =>
  ['dashboard', 'snapshot', { scope, period, project }] as const;

export function snapshotQueryOptions(provider: DashboardDataProvider, request: SnapshotRequest) {
  return queryOptions({
    queryKey: snapshotQueryKey(provider.scope, request),
    // Passing the signal lets TanStack Query cancel a request nobody is waiting for.
    queryFn: ({ signal }) => provider.getSnapshot(request, signal),
  });
}

/** Invalid data will not fix itself, so it is never retried. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const invalid = isDashboardDataError(error) && (error.code === 'invalid-response' || error.code === 'invalid-source-data');
  return !invalid && failureCount < 2;
}

/**
 * Freshness policy until Unit 4 adds refresh: demo snapshots for a scope never
 * change, so a loaded period is reused from cache. No polling and no refetch on
 * window focus or reconnect.
 */
export function createDashboardQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: shouldRetry,
      },
    },
  });
}
