import { useEffect, useRef } from 'react';
import type { Period } from '../../../lib/dashboard/contracts';
import { failureText, formatPeriodRange, PERIOD_LABELS } from '../labels';
import type { PeriodSelection } from '../usePeriodSelection';
import { CapacityPanel } from './CapacityPanel';
import { DashboardFooter } from './DashboardFooter';
import { DashboardHeader } from './DashboardHeader';
import { DashboardLayout } from './DashboardLayout';
import { KpiCards } from './KpiCards';
import { PeriodControls } from './PeriodControls';
import { PeriodStatus } from './PeriodStatus';
import { ProductionTrendPanel } from './ProductionTrendPanel';
import { ProductMixPanel } from './ProductMixPanel';
import { ProjectProgressPanel } from './ProjectProgressPanel';

/**
 * Loaded dashboard. Every figure and period label comes from the one displayed
 * snapshot, so a pending or failed request can never relabel the figures.
 */
export function DashboardScreen({ selection }: { selection: Extract<PeriodSelection, { status: 'ready' }> }) {
  const { snapshot, requested, pending, failure, select } = selection;
  const { elements } = snapshot.output;

  // The retry button disappears as soon as a retry starts. If it had focus,
  // move focus to the requested period button instead of losing it.
  const buttonRefs = useRef<Partial<Record<Period, HTMLButtonElement | null>>>({});
  const retryUsed = useRef(false);
  const failed = failure !== null;
  useEffect(() => {
    if (failed || !retryUsed.current) return;
    retryUsed.current = false;
    if (!document.activeElement || document.activeElement === document.body) buttonRefs.current[requested]?.focus();
  }, [failed, requested]);

  return (
    <DashboardLayout
      header={
        <DashboardHeader
          source={snapshot.source}
          controls={
            <PeriodControls
              requested={requested}
              displayed={snapshot.selectedPeriod}
              requestState={pending ? 'loading' : failure ? 'failed' : 'settled'}
              onSelect={select}
              buttonRefs={buttonRefs}
            />
          }
          status={
            <PeriodStatus
              shownRange={formatPeriodRange(snapshot)}
              pendingLabel={pending ? PERIOD_LABELS[pending] : null}
              failure={
                failure && {
                  text: failureText(failure.period, failure.error),
                  onRetry: () => {
                    retryUsed.current = true;
                    failure.retry();
                  },
                }
              }
            />
          }
        />
      }
      cards={<KpiCards snapshot={snapshot} />}
      trend={
        <ProductionTrendPanel
          trend={elements.trend}
          total={elements.total}
          granularity={snapshot.range.granularity}
          period={snapshot.selectedPeriod}
          asOf={snapshot.sourceDataAsOf}
        />
      }
      capacity={<CapacityPanel capacity={snapshot.capacity} />}
      products={<ProductMixPanel products={elements.products} total={elements.total} period={snapshot.selectedPeriod} />}
      projects={<ProjectProgressPanel projects={snapshot.projects} />}
      footer={<DashboardFooter source={snapshot.source} sourceDataAsOf={snapshot.sourceDataAsOf} fetchedAt={snapshot.fetchedAt} />}
    />
  );
}
