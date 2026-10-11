export type DashboardDataErrorCode =
  /** A provider returned a snapshot that failed validation. */
  | 'invalid-response'
  /** The provider's own source records failed validation. */
  | 'invalid-source-data'
  /** The request was cancelled. */
  | 'aborted'
  /** The source could not be reached or did not answer. */
  | 'unavailable';

/** Structured provider error. Messages are safe to show; no sensitive diagnostics. */
export class DashboardDataError extends Error {
  readonly code: DashboardDataErrorCode;
  /** Short validation findings ("path: message"), at most ten. */
  readonly issues: readonly string[];

  constructor(code: DashboardDataErrorCode, message: string, options: { issues?: string[]; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'DashboardDataError';
    this.code = code;
    this.issues = options.issues ?? [];
  }
}

export const isDashboardDataError = (error: unknown): error is DashboardDataError =>
  error instanceof DashboardDataError;
