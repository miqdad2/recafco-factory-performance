import { useCallback, useId, useState, type FocusEvent } from 'react';
import type { Period, ProjectOption, ProjectSummaryRow } from '../../../lib/dashboard/contracts';
import { ALL_PROJECTS, UNASSIGNED_PROJECT } from '../../../lib/dashboard/projects';
import { fromMilli, toMilli } from '../../../lib/dashboard/units';
import type { ChosenSeries } from '../chartSeries';
import { formatCellQuantity, PERIOD_SCOPES } from '../labels';
import { chunkPages, describePage, fitPages } from '../projectSummaryPages';
import { useAutoPages } from '../useAutoPages';

interface ProjectSummaryPanelProps {
  rows: ProjectSummaryRow[];
  options: ProjectOption[];
  selectedProject: ProjectOption;
  period: Period;
  /** The chart's product and unit; the summary always shows the same one. */
  series: ChosenSeries;
  onSelectProject: (project: string) => void;
  /** Automatic paging is switched on; owned by the screen so it survives new views. */
  autoPages: boolean;
  onAutoPagesChange: (on: boolean) => void;
  /** Paging must hold still: selector open, a request loading, or a failure shown. */
  holdPages: boolean;
}

/** Rows per page where the page cannot be measured (tests, very old browsers). */
const FALLBACK_ROWS_PER_PAGE = 4;

interface SummaryLine {
  row: ProjectSummaryRow;
  option: ProjectOption;
}

/** Alphabetical by project name, with Unassigned last: an index, not a ranking. */
function compareLines(a: SummaryLine, b: SummaryLine): number {
  const unassigned = Number(a.option.key === UNASSIGNED_PROJECT) - Number(b.option.key === UNASSIGNED_PROJECT);
  return unassigned || a.option.name.localeCompare(b.option.name, 'en', { sensitivity: 'base' }) || a.option.key.localeCompare(b.option.key);
}

function ProjectName({ option }: { option: ProjectOption }) {
  return (
    <>
      <span className="block text-label leading-tight font-semibold text-ink">{option.name}</span>
      {option.code && <span className="block text-support leading-tight font-normal text-ink-muted">{option.code}</span>}
    </>
  );
}

/** Column widths shared by the visible table and its measuring copy, so rows wrap identically. */
function Columns() {
  return (
    <colgroup>
      <col className="w-[52%]" />
      <col className="w-[24%]" />
      <col className="w-[24%]" />
    </colgroup>
  );
}

function Head() {
  return (
    <thead>
      <tr className="border-b-2 border-line text-left text-support">
        <th scope="col" className="pb-0.5 font-semibold text-ink-muted">Project</th>
        <th scope="col" className="pb-0.5 pl-2 text-right font-semibold text-chart-blue">Produced</th>
        <th scope="col" className="pb-0.5 pl-2 text-right font-semibold text-chart-teal">Delivered</th>
      </tr>
    </thead>
  );
}

const ROW_CLASS = 'border-b border-line last:border-b-0';
const NAME_CELL = 'py-1 pr-2 text-left align-top';
const QUANTITY_CELL = 'py-1 pl-2 text-right align-top font-bold whitespace-nowrap text-ink compact:text-support';
const CONTROL = 'rounded-control border-2 border-line px-3 py-0.5 text-support font-semibold text-ink hover:bg-raised aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

/** Sum in whole thousandths, so the total matches the headline row exactly. */
const total = (lines: readonly SummaryLine[], field: 'produced' | 'delivered') =>
  fromMilli(lines.reduce((sum, { row }) => sum + toMilli(row[field]), 0));

/**
 * Period activity per project for the chart's product and unit. It is not project
 * completion, so it shows no percentage, and delivery above production is normal:
 * deliveries can come from earlier stock. Pages are cut to fit the measured space, so
 * a long name that wraps never pushes rows out of the panel and text never shrinks.
 */
export function ProjectSummaryPanel({
  rows,
  options,
  selectedProject,
  period,
  series,
  onSelectProject,
  autoPages,
  onAutoPagesChange,
  holdPages,
}: ProjectSummaryPanelProps) {
  const titleId = useId();
  const filtered = selectedProject.key !== ALL_PROJECTS;
  const scope = PERIOD_SCOPES[period];
  const lines: SummaryLine[] = rows
    .filter((row) => row.rowKey === series.key)
    .flatMap((row) => {
      const option = options.find((o) => o.key === row.projectKey);
      return option ? [{ row, option }] : [];
    })
    .sort(compareLines);
  const unit = lines[0]?.row.unit;
  const signature = `${series.key}|${lines.map((l) => l.option.key).join(',')}`;

  // Page breaks measured from an invisible copy of every row at the real width.
  const [measured, setMeasured] = useState<{ signature: string; pages: number[][] } | null>(null);
  const measure = useCallback(
    (node: HTMLDivElement | null) => {
      const body = node?.parentElement;
      if (!node || !body || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => {
        const table = node.querySelector('table');
        const head = table?.tHead?.offsetHeight ?? 0;
        const heights = [...(table?.tBodies[0]?.rows ?? [])].map((r) => r.offsetHeight);
        const pages = fitPages(heights, body.clientHeight - head);
        if (pages) setMeasured({ signature, pages });
      });
      observer.observe(body);
      observer.observe(node.firstElementChild!);
      return () => observer.disconnect();
    },
    [signature],
  );

  const pages = measured?.signature === signature ? measured.pages : chunkPages(lines.length, FALLBACK_ROWS_PER_PAGE);
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, pages.length);
  const current = Math.min(page, pageCount - 1);
  const pageLines = (pages[current] ?? []).map((i) => lines[i]!);
  const pageText = describePage(pages, current, lines.length);

  // Automatic paging holds still while someone is reading or using the panel.
  const [pointerInside, setPointerInside] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const autoRunning = useAutoPages({
    enabled: autoPages,
    paused: holdPages || pointerInside || focusInside,
    pageCount: pages.length,
    setPage,
  });
  const [everStarted, setEverStarted] = useState(autoPages);
  const manualPage = (next: number) => {
    onAutoPagesChange(false); // manual paging stops rotation until resumed
    setPage(next);
  };
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusInside(false);
  };

  return (
    <section
      aria-labelledby={titleId}
      onPointerEnter={() => setPointerInside(true)}
      onPointerLeave={() => setPointerInside(false)}
      onFocus={() => setFocusInside(true)}
      onBlur={onBlur}
      className="flex min-h-0 min-w-0 flex-1 flex-col rounded-panel border border-line bg-surface px-6 pt-5 pb-4 shadow-panel"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-6">
        <h2 id={titleId} className="text-panel font-semibold text-ink">
          Project Summary
        </h2>
        <p className="text-support text-ink-muted">
          <span className="text-label font-bold text-ink">{series.name}</span> · {scope} activity
        </p>
      </header>

      {/* Totals cover every matching project on every page, never just the visible rows. */}
      {unit && (
        // A long project name wraps in full; each quantity stays whole on its line.
        <p className="mt-1 mb-1.5 text-support text-ink-muted">
          <span className="font-semibold text-ink">{filtered ? selectedProject.name : 'All projects'}</span>
          <span className="whitespace-nowrap">
            {' · Produced '}
            <span className="font-bold text-ink">{formatCellQuantity(total(lines, 'produced'), unit)}</span>
          </span>
          <span className="whitespace-nowrap">
            {' · Delivered '}
            <span className="font-bold text-ink">{formatCellQuantity(total(lines, 'delivered'), unit)}</span>
          </span>
        </p>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col">
        {lines.length === 0 ? (
          <p className="flex flex-1 items-center justify-center px-4 text-center text-label text-ink-muted">
            No {series.name} activity recorded for {selectedProject.name} in the {scope.toLowerCase()}.
          </p>
        ) : (
          <table className="w-full table-fixed text-label">
            <Columns />
            <Head />
            <tbody>
              {pageLines.map(({ row, option }) => (
                <tr
                  key={option.key}
                  onClick={filtered ? undefined : () => onSelectProject(option.key)}
                  className={`${ROW_CLASS} ${filtered ? '' : 'cursor-pointer hover:bg-raised'}`}
                >
                  <th scope="row" className={NAME_CELL}>
                    {filtered ? (
                      <ProjectName option={option} />
                    ) : (
                      // The row handles the click, so keyboard and mouse share one action.
                      <button type="button" aria-label={`Show ${option.name}`} className="w-full rounded-md text-left">
                        <ProjectName option={option} />
                      </button>
                    )}
                  </th>
                  <td className={QUANTITY_CELL}>{formatCellQuantity(row.produced, row.unit)}</td>
                  <td className={QUANTITY_CELL}>{formatCellQuantity(row.delivered, row.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Measuring copy: zero height and invisible, so it never takes space or focus. */}
        <div key={signature} ref={measure} aria-hidden inert className="invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
          <table className="w-full table-fixed text-label">
            <Columns />
            <Head />
            <tbody>
              {lines.map(({ row, option }) => (
                <tr key={option.key} className={ROW_CLASS}>
                  <th className={NAME_CELL}>
                    <ProjectName option={option} />
                  </th>
                  <td className={QUANTITY_CELL}>{formatCellQuantity(row.produced, row.unit)}</td>
                  <td className={QUANTITY_CELL}>{formatCellQuantity(row.delivered, row.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two lines are always reserved, so paging controls never change the space for rows:
          the range and page count on the first, the controls on the second. */}
      <div className="flex min-h-[4.75rem] flex-col justify-end gap-1 pt-1.5">
        {/* Announced on manual paging only; automatic changes stay quiet. */}
        <p aria-live={autoRunning ? 'off' : 'polite'} className="flex min-h-[2.25rem] items-center text-support font-semibold text-ink">
          {pageText}
        </p>
        <div className="flex min-h-[2.25rem] flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {pages.length > 1 ? (
            <div role="group" aria-label="Auto pages" className="flex items-center gap-x-2 text-support">
              <span className={autoPages ? 'font-semibold text-chart-blue' : 'text-ink-muted'}>
                {autoPages ? (autoRunning ? '● Auto pages on · every 15 s' : '● Auto pages paused') : 'Auto pages'}
              </span>
              <button
                type="button"
                aria-pressed={autoPages}
                onClick={() => {
                  setEverStarted(true);
                  onAutoPagesChange(!autoPages);
                }}
                className={CONTROL}
              >
                {autoPages ? 'Pause' : everStarted ? 'Resume' : 'Start'}
              </button>
            </div>
          ) : (
            <span />
          )}
          {pages.length > 1 && (
            <nav aria-label="Project summary pages" className="flex shrink-0 items-center gap-2">
              <button type="button" aria-disabled={current === 0} onClick={() => current > 0 && manualPage(current - 1)} className={CONTROL}>
                Previous
              </button>
              <button type="button" aria-disabled={current === pageCount - 1} onClick={() => current < pageCount - 1 && manualPage(current + 1)} className={CONTROL}>
                Next
              </button>
            </nav>
          )}
          {filtered && (
            <button type="button" onClick={() => onSelectProject(ALL_PROJECTS)} className={CONTROL}>
              Show All Projects
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
