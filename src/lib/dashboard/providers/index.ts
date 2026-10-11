import type { DashboardDataProvider } from '../provider';
import { createDemoProvider } from './demo';

/**
 * The provider the display uses. Only the demo provider exists; an HTTP
 * provider for the internal NestJS reporting API replaces it after approval.
 */
export const dashboardProvider: DashboardDataProvider = createDemoProvider();
