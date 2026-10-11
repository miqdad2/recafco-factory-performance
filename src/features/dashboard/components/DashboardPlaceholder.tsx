import type { ReactNode } from 'react';
import { Panel } from '../../../components/ui/Panel';
import type { Period } from '../../../lib/dashboard/contracts';
import { DashboardFooter } from './DashboardFooter';
import { DashboardHeader } from './DashboardHeader';
import { DashboardLayout } from './DashboardLayout';
import { PeriodControls } from './PeriodControls';

const CARD_TITLES = ['Open Sales Orders', 'Active Production Orders', 'Concrete Produced', 'Delivered Output'];

/** Solid, static block standing in for a figure. Never shows a number. */
function Block({ className }: { className: string }) {
  return <span aria-hidden className={`block rounded-control bg-raised ${className}`} />;
}

function PlaceholderCard({ title }: { title: string }) {
  return (
    <article className="flex min-w-0 flex-col gap-2.5 rounded-panel border border-line bg-surface py-4 pr-6 pl-8">
      <h2 className="text-panel font-semibold text-ink">{title}</h2>
      <Block className="h-[4rem] w-[55%]" />
      <Block className="h-[1.6875rem] w-[70%]" />
    </article>
  );
}

function PlaceholderPanel({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Panel title={title}>
      <div className="relative flex min-h-[10rem] flex-1 items-center justify-center rounded-control bg-raised/60">
        {children}
      </div>
    </Panel>
  );
}

type DashboardPlaceholderProps =
  | { mode: 'loading'; selectedPeriod: Period }
  | { mode: 'error'; selectedPeriod: Period; message: string; onRetry: () => void };

/**
 * Initial loading and initial-failure screens. Keeps the real layout and panel
 * titles so the screen does not jump, and never shows zeros in place of data.
 */
export function DashboardPlaceholder(props: DashboardPlaceholderProps) {
  const loading = props.mode === 'loading';
  const status = loading ? 'Loading demo data…' : 'Demo data unavailable';

  return (
    <DashboardLayout
      busy={loading}
      header={
        <DashboardHeader
          source="demo"
          controls={<PeriodControls requested={props.selectedPeriod} displayed={null} requestState="settled" disabled />}
          // Not a live region here: the message in the trend panel is announced instead.
          status={
            <p className="flex min-h-[2.5rem] items-center text-support font-semibold text-ink">{status}</p>
          }
        />
      }
      cards={CARD_TITLES.map((title) => <PlaceholderCard key={title} title={title} />)}
      trend={
        <PlaceholderPanel title="Concrete Production Trend">
          <div role={loading ? 'status' : 'alert'} className="flex flex-col items-center gap-4 px-6 text-center">
            <p className="text-panel font-semibold text-ink">{status}</p>
            {props.mode === 'error' ? (
              <>
                <p className="max-w-[40rem] text-label text-ink-muted">{props.message}</p>
                <button
                  type="button"
                  onClick={props.onRetry}
                  className="rounded-control bg-accent px-8 py-3 text-label font-semibold text-white"
                >
                  Try again
                </button>
              </>
            ) : (
              <p className="text-label text-ink-muted">Figures appear when loading finishes.</p>
            )}
          </div>
        </PlaceholderPanel>
      }
      capacity={<PlaceholderPanel title="Monthly Plant Capacity" />}
      grades={<PlaceholderPanel title="Production by Concrete Grade" />}
      projects={<PlaceholderPanel title="Active Projects" />}
      footer={<DashboardFooter source="demo" sourceDataAsOf={null} fetchedAt={null} />}
    />
  );
}
