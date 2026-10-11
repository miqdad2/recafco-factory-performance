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
 * On large screens a 1fr | auto | 1fr grid keeps the period buttons centred,
 * so they never move when the status line under them changes length.
 */
export function DashboardHeader({ controls, status, source }: DashboardHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 lg:grid lg:grid-cols-[1fr_auto_1fr]">
      <div className="flex items-center gap-5 lg:justify-self-start">
        {/* White tile keeps the logo's dark-grey Arabic wordmark legible on the dark theme. */}
        <div className="rounded-control bg-white px-2 py-1">
          <img
            src={`${import.meta.env.BASE_URL}brand/recafco-logo.png`}
            alt="RECAFCO"
            width={480}
            height={373}
            className="h-[4.5rem] w-auto"
          />
        </div>
        <h1 className="text-title font-bold text-ink">Factory Performance</h1>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        {controls}
        {status}
      </div>

      <div className="ml-auto flex items-center gap-6 lg:justify-self-end">
        {source === 'demo' && (
          <p className="rounded-control border-2 border-warning px-4 py-2 text-label font-bold tracking-wide text-warning uppercase">
            Demo data
          </p>
        )}
        <KuwaitClock />
      </div>
    </header>
  );
}
