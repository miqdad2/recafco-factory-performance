import type { ReactNode } from 'react';
import { Panel } from '../../../components/ui/Panel';
import type { Period } from '../../../lib/dashboard/contracts';
import { DashboardFooter } from './DashboardFooter';
import { DashboardHeader } from './DashboardHeader';
import { DashboardLayout } from './DashboardLayout';
import { ALL_PROJECTS } from '../../../lib/dashboard/projects';
import { PeriodControls } from './PeriodControls';
import { STATUS_HEIGHT } from './PeriodStatus';
import { ProjectSelector } from './ProjectSelector';

const COUNT_CARD_TITLES = ['Current Sales Orders', 'Active Production Orders'];
const QUANTITY_CARD_TITLES = ['Produced Elements', 'Delivered Elements'];

/** Solid, static block standing in for a figure. Never shows a number. */
function Block({ className }: { className: string }) {
  return <span aria-hidden className={`block rounded-control bg-raised ${className}`} />;
}

function PlaceholderCard({ title, rows }: { title: string; rows: boolean }) {
  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-panel border border-line bg-surface py-3.5 pr-6 pl-8">
      <h2 className="text-panel font-semibold text-ink">{title}</h2>
      {rows ? (
        Array.from({ length: 4 }, (_, i) => <Block key={i} className="h-[2rem] w-full" />)
      ) : (
        <Block className="my-auto h-[4rem] w-[55%]" />
      )}
      <Block className="h-[1.6875rem] w-[60%]" />
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
          controls={
            <div className="flex items-stretch gap-3">
              <PeriodControls requested={props.selectedPeriod} displayed={null} requestState="settled" disabled />
              <ProjectSelector options={[]} requested={ALL_PROJECTS} requestState="settled" disabled />
            </div>
          }
          // Not a live region here: the message in the trend panel is announced instead.
          status={
            <p className={`text-center text-label font-semibold text-ink ${STATUS_HEIGHT}`}>{status}</p>
          }
        />
      }
      cards={
        <>
          {COUNT_CARD_TITLES.map((title) => <PlaceholderCard key={title} title={title} rows={false} />)}
          {QUANTITY_CARD_TITLES.map((title) => <PlaceholderCard key={title} title={title} rows />)}
        </>
      }
      trend={
        <PlaceholderPanel title="Production Trend">
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
                  Retry
                </button>
              </>
            ) : (
              <p className="text-label text-ink-muted">Figures appear when loading finishes.</p>
            )}
          </div>
        </PlaceholderPanel>
      }
      concrete={<PlaceholderPanel title="Concrete Output" />}
      summary={<PlaceholderPanel title="Project Summary" />}
      footer={<DashboardFooter source="demo" sourceDataAsOf={null} fetchedAt={null} />}
    />
  );
}
