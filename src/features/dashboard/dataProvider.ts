import { createContext, useContext } from 'react';
import type { DashboardDataProvider } from '../../lib/dashboard/provider';
import { dashboardProvider } from '../../lib/dashboard/providers';

/** The active data provider. Tests supply a controllable provider here. */
export const DashboardDataContext = createContext<DashboardDataProvider>(dashboardProvider);

export const useDashboardDataProvider = () => useContext(DashboardDataContext);
