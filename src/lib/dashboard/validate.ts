import type { z } from 'zod';
import { dashboardSnapshotSchema, demoDatasetSchema, type DashboardSnapshot, type DemoDataset } from './contracts';
import { DashboardDataError, type DashboardDataErrorCode } from './errors';

function summarise(error: z.ZodError): string[] {
  return error.issues.slice(0, 10).map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
}

function parseWith<T>(schema: z.ZodType<T>, input: unknown, code: DashboardDataErrorCode, message: string): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new DashboardDataError(code, message, { issues: summarise(result.error) });
  return result.data;
}

/** Validates a snapshot at the provider boundary (demo now, HTTP later). */
export const parseSnapshot = (input: unknown): DashboardSnapshot =>
  parseWith(dashboardSnapshotSchema, input, 'invalid-response', 'Dashboard data failed validation');

/** Validates the synthetic source records before any calculation. */
export const parseDemoDataset = (input: unknown): DemoDataset =>
  parseWith(demoDatasetSchema, input, 'invalid-source-data', 'Demo records failed validation');
