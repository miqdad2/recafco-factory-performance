import type { ReactNode } from 'react';
import type { DataSource } from '../../../lib/dashboard/contracts';
import { KuwaitClock } from './KuwaitClock';

interface DashboardHeaderProps {
  controls: ReactNode;
  /** Status line under the controls (shown range, loading, failure). */
  status: ReactNode;
  source: DataSource;
}

/**
 * On large screens the title and clock keep their width and the controls centre in
 * what remains. The status line takes the controls' width and wraps, so it never
 * pushes them apart.
 */
export function DashboardHeader({ controls, status, source }: DashboardHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 lg:grid lg:grid-cols-[auto_1fr_auto]">
      <div className="flex items-center gap-6 lg:justify-self-start">
        {/* White tile keeps the logo's dark-grey Arabic wordmark legible on the dark theme. */}
        <div className="shrink-0 rounded-control bg-white px-2 py-1 shadow-panel">
          <img
            src={`${import.meta.env.BASE_URL}brand/recafco-logo.png`}
            alt="RECAFCO"
            width={480}
            height={373}
            className="h-[4.5rem] w-auto"
          />
        </div>
        <span aria-hidden className="h-14 w-px bg-line" />
        <h1 className="text-[2.5rem] leading-none font-extrabold tracking-tight whitespace-nowrap text-ink compact:whitespace-normal">Factory Performance</h1>
      </div>

      <div className="flex flex-col items-center gap-1.5 lg:justify-self-center">
        {controls}
        <div className="w-0 min-w-full">{status}</div>
      </div>

      <div className="ml-auto flex items-center gap-6 lg:justify-self-end">
        {source === 'demo' && (
          <p className="rounded-control border-2 border-warning bg-warning/10 px-4 py-2 text-label font-bold tracking-wide whitespace-nowrap text-warning uppercase">
            Demo data
          </p>
        )}
        <KuwaitClock />
      </div>
    </header>
  );
}
