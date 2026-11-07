import { useEffect, useRef, useState } from 'react';
import type { Period } from '../../../lib/dashboard/contracts';
import { ALL_PROJECTS } from '../../../lib/dashboard/projects';
import { describeSelection, failureText, formatPeriodRange, NOT_AVAILABLE } from '../labels';
import type { DashboardSelection } from '../useDashboardSelection';
import { ConcreteOutputPanel } from './ConcreteOutputPanel';
import { DashboardFooter } from './DashboardFooter';
import { DashboardHeader } from './DashboardHeader';
import { DashboardLayout } from './DashboardLayout';
import { KpiCards } from './KpiCards';
import { PeriodControls } from './PeriodControls';
import { PeriodStatus } from './PeriodStatus';
import { Panel } from '../../../components/ui/Panel';
import { resolveSeries, type ChosenSeries } from '../chartSeries';
import { ProductionTrendPanel } from './ProductionTrendPanel';
import { ProjectSelector } from './ProjectSelector';
import { ProjectSummaryPanel } from './ProjectSummaryPanel';

/**
 * Loaded dashboard. Every figure and period label comes from the one displayed
 * snapshot, so a pending or failed request can never relabel the figures.
 */
export function DashboardScreen({ selection }: { selection: Extract<DashboardSelection, { status: 'ready' }> }) {
  const { snapshot, requested, pending, failure, selectPeriod, selectProject } = selection;
  const { productionSeries } = snapshot.output;
  const shownProject = snapshot.selectedProject;
  // One product-and-unit choice drives both the chart and Project Summary. It survives
  // project and period changes and never switches to another product by itself.
  const [chosenSeries, setChosenSeries] = useState<ChosenSeries | null>(null);
  const series = resolveSeries(productionSeries, chosenSeries);
  // Automatic Project Summary paging: off by default, kept across views, held still
  // while the selector is open or another view is loading or has failed.
  const [autoPages, setAutoPages] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

  // The retry button disappears as soon as a retry starts. If it had focus,
  // move focus to the requested period button instead of losing it.
  const buttonRefs = useRef<Partial<Record<Period, HTMLButtonElement | null>>>({});
  const projectTriggerRef = useRef<HTMLButtonElement>(null);
  const retryUsed = useRef(false);
  const failed = failure !== null;
  useEffect(() => {
    if (failed || !retryUsed.current) return;
    retryUsed.current = false;
    if (document.activeElement && document.activeElement !== document.body) return;
    if (requested.period !== snapshot.selectedPeriod) buttonRefs.current[requested.period]?.focus();
    else projectTriggerRef.current?.focus();
  }, [failed, requested, snapshot.selectedPeriod]);

  // A Project Summary row button disappears once its project is applied; keep focus on the page.
  const summaryUsed = useRef(false);
  useEffect(() => {
    if (!summaryUsed.current) return;
    summaryUsed.current = false;
    if (!document.activeElement || document.activeElement === document.body) projectTriggerRef.current?.focus();
  }, [shownProject.key]);

  const requestState = (differs: boolean) => (!differs ? 'settled' : pending ? 'loading' : failure ? 'failed' : 'settled');

  return (
    <DashboardLayout
      header={
        <DashboardHeader
          source={snapshot.source}
          controls={
            <div className="flex items-stretch gap-3">
              <PeriodControls
                requested={requested.period}
                displayed={snapshot.selectedPeriod}
                requestState={requestState(requested.period !== snapshot.selectedPeriod)}
                onSelect={selectPeriod}
                buttonRefs={buttonRefs}
              />
              <ProjectSelector
                options={snapshot.projectOptions}
                requested={requested.project}
                requestState={requestState(requested.project !== shownProject.key)}
                onSelect={selectProject}
                triggerRef={projectTriggerRef}
                onOpenChange={setSelectorOpen}
              />
            </div>
          }
          status={
            <PeriodStatus
              shownProject={shownProject.name}
              shownRange={formatPeriodRange(snapshot)}
              pendingLabel={pending && describeSelection(pending, snapshot)}
              failure={
                failure && {
                  text: failureText(describeSelection(failure.selection, snapshot), failure.error),
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
      cards={<KpiCards snapshot={snapshot} selectedKey={series?.key} />}
      trend={
        series ? (
          <ProductionTrendPanel
            series={productionSeries}
            period={snapshot.selectedPeriod}
            asOf={snapshot.sourceDataAsOf}
            projectName={shownProject.name}
            selected={series}
            onSelect={setChosenSeries}
          />
        ) : (
          <Panel title="Production Trend">
            <p className="flex flex-1 items-center justify-center text-panel font-semibold text-ink-muted">{NOT_AVAILABLE}</p>
          </Panel>
        )
      }
      concrete={<ConcreteOutputPanel concrete={snapshot.concrete} period={snapshot.selectedPeriod} projectFiltered={shownProject.key !== ALL_PROJECTS} />}
      summary={
        series && (
          <ProjectSummaryPanel
            // New data, view or product starts again at the first page with a fresh interval.
            key={`${snapshot.fetchedAt}|${snapshot.selectedPeriod}|${shownProject.key}|${series.key}`}
            rows={snapshot.projectSummary}
            options={snapshot.projectOptions}
            selectedProject={shownProject}
            period={snapshot.selectedPeriod}
            series={series}
            onSelectProject={(project) => {
              summaryUsed.current = true;
              selectProject(project);
            }}
            autoPages={autoPages}
            onAutoPagesChange={setAutoPages}
            holdPages={selectorOpen || pending !== null || failure !== null}
          />
        )
      }
      footer={<DashboardFooter source={snapshot.source} sourceDataAsOf={snapshot.sourceDataAsOf} fetchedAt={snapshot.fetchedAt} />}
    />
  );
}
