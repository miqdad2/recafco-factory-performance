// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DashboardSnapshot, Period } from '../../../lib/dashboard/contracts';
import { DashboardDataError } from '../../../lib/dashboard/errors';
import { formatCount, formatQuantity, formatVolume } from '../../../lib/format';
import type { DashboardDataProvider } from '../../../lib/dashboard/provider';
import { ALL_PROJECTS } from '../../../lib/dashboard/projects';
import { createDemoProvider } from '../../../lib/dashboard/providers/demo';
import { DashboardDataContext } from '../dataProvider';
import { formatCellQuantity, formatPeriodRange, formatProductName, formatQuantityWithUnit, formatSeriesName, formatUnit, PERIOD_LABELS } from '../labels';
import { UNASSIGNED_PROJECT } from '../../../lib/dashboard/projects';
import { DashboardPage } from './DashboardPage';

// Canvas charts cannot render in jsdom; keep the text alternative.
vi.mock('../../../components/charts/EChart', () => ({
  EChart: ({ ariaLabel }: { ariaLabel: string }) => <div role="img" aria-label={ariaLabel} />,
}));

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

afterEach(cleanup);

const real = createDemoProvider({ delayMs: 0, now: () => Date.parse('2026-10-14T11:05:00Z') });
const PERIODS = ['daily', 'weekly', 'monthly', 'yearly'] as const;
const expected = Object.fromEntries(
  await Promise.all(PERIODS.map(async (p) => [p, await real.getSnapshot({ period: p, project: ALL_PROJECTS })])),
) as Record<Period, DashboardSnapshot>;
const PROJECTS = expected.daily.projectOptions.map((o) => o.key);
const scoped = new Map(
  await Promise.all(
    PERIODS.flatMap((period) =>
      PROJECTS.map(async (project) => [`${period}|${project}`, await real.getSnapshot({ period, project })] as const),
    ),
  ),
);
const snapshotOf = (period: Period, project: string) => scoped.get(`${period}|${project}`)!;

interface Call {
  period: Period;
  project: string;
  signal: AbortSignal | undefined;
  resolve: () => Promise<void>;
  reject: (error: unknown) => void;
}

type SnapshotFor = (period: Period, project: string) => DashboardSnapshot;

/** Provider whose requests stay pending until the test resolves or rejects them. */
function controllableProvider(snapshotFor: SnapshotFor = snapshotOf) {
  const calls: Call[] = [];
  const provider: DashboardDataProvider = {
    scope: 'test@2026-10-14T14:00:00+03:00',
    getSnapshot({ period, project }, signal) {
      return new Promise<DashboardSnapshot>((resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DashboardDataError('aborted', 'Request cancelled')));
        calls.push({ period, project, signal, resolve: async () => resolve(snapshotFor(period, project)), reject });
      });
    },
  };
  const latest = (period: Period, project: string = ALL_PROJECTS) => {
    const call = [...calls].reverse().find((c) => c.period === period && c.project === project);
    if (!call) throw new Error(`No request for ${period} ${project}`);
    return call;
  };
  return { provider, calls, latest };
}

async function renderDashboard({ loadDaily = true, snapshotFor }: { loadDaily?: boolean; snapshotFor?: SnapshotFor } = {}) {
  const fake = controllableProvider(snapshotFor);
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <DashboardDataContext.Provider value={fake.provider}>
        <DashboardPage />
      </DashboardDataContext.Provider>
    </QueryClientProvider>,
  );
  if (loadDaily) await settle(fake.latest('daily'));
  return fake;
}

/** TanStack Query notifies React on a setTimeout(0); let it run inside act. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 5));
const settle = (call: Call) =>
  act(async () => {
    await call.resolve();
    await flush();
  });
const fail = (call: Call, error: unknown = new DashboardDataError('unavailable', 'Source unavailable')) =>
  act(async () => {
    call.reject(error);
    await flush();
  });

const button = (period: Period) => screen.getByRole('button', { name: PERIOD_LABELS[period] });
const card = (title: string) => screen.getByRole('heading', { name: title }).closest('article')!;
const status = () => screen.getByRole('status').textContent ?? '';
const trendMeta = () => screen.getByRole('heading', { name: 'Production Trend' }).parentElement!.textContent ?? '';
/** Project Summary rows for one product and unit, in the panel's order: alphabetical, Unassigned last. */
function summaryLines(s: DashboardSnapshot, rowKey: string = s.output.productionSeries[0]!.key) {
  return s.projectSummary
    .filter((r) => r.rowKey === rowKey)
    .map((row) => ({ row, option: s.projectOptions.find((o) => o.key === row.projectKey)! }))
    .sort(
      (a, b) =>
        Number(a.option.key === UNASSIGNED_PROJECT) - Number(b.option.key === UNASSIGNED_PROJECT) ||
        a.option.name.localeCompare(b.option.name, 'en', { sensitivity: 'base' }),
    );
}
/** The visible summary table; role queries skip the hidden measuring copy. */
const summaryTable = () => within(within(summaryPanel()).getByRole('table'));
/** Cutoff comes from the snapshot's reference time, never the live clock (which reads 2026-11 here). */
const MONTH_TO_DATE_LABEL = 'Month to date · through 14 Oct 2026';
const summaryPanel = () => screen.getByRole('heading', { name: 'Project Summary' }).closest('section')!;
const concretePanel = () => screen.getByRole('heading', { name: 'Concrete Output' }).closest('section')!;
const SCOPES: Record<Period, string> = { daily: 'Selected day', weekly: 'Selected week', monthly: 'Selected month', yearly: 'Selected year' };

/** Asserts that every selection-dependent figure and label on screen belongs to this view. */
function expectShowing(period: Period, project: string = ALL_PROJECTS) {
  const s = snapshotOf(period, project);
  expect(status()).toContain(`Showing ${s.selectedProject.name} · ${formatPeriodRange(s)}`);
  expect(within(card('Produced Elements')).getByText(SCOPES[period])).toBeTruthy();
  expect(within(card('Delivered Elements')).getByText(SCOPES[period])).toBeTruthy();
  const notes = s.output.deliveryDocumentCount!;
  expect(within(card('Delivered Elements')).getByText(new RegExp(`^${formatCount(notes)} delivery notes?$`))).toBeTruthy();
  expect(trendMeta()).toContain(s.selectedProject.name);
  expect(trendMeta()).toContain(SCOPES[period].toLowerCase());

  for (const title of ['Current Sales Orders', 'Active Production Orders']) {
    const count = title === 'Current Sales Orders' ? s.orders.openSalesOrders! : s.orders.activeProductionOrders!;
    expect(within(card(title)).getByText(formatCount(count))).toBeTruthy();
    expect(within(card(title)).getByText('Current')).toBeTruthy();
  }

  const producedRows = within(card('Produced Elements')).getAllByRole('listitem');
  const deliveredRows = within(card('Delivered Elements')).getAllByRole('listitem');
  s.output.rows.forEach((row, i) => {
    const unit = formatUnit(row.unit);
    expect(producedRows[i]!.textContent).toBe(`${formatProductName(row)}${formatQuantity(row.produced!, row.unit)} ${unit}`);
    expect(deliveredRows[i]!.textContent).toBe(`${formatProductName(row)}${formatQuantity(row.delivered!, row.unit)} ${unit}`);
  });

  const [first] = summaryLines(s);
  if (first) {
    const cells = within(summaryPanel()).getAllByRole('row')[1]!.textContent ?? '';
    expect(cells).toContain(first.option.name);
    expect(cells).toContain(formatCellQuantity(first.row.produced, first.row.unit));
    expect(cells).toContain(formatCellQuantity(first.row.delivered, first.row.unit));
  }

  expect(concretePanel().textContent).toContain('All Projects');
  expect(within(concretePanel()).getByText(SCOPES[period])).toBeTruthy();
  expect(within(concretePanel()).getByText(MONTH_TO_DATE_LABEL)).toBeTruthy();
  // Monthly: selected period and month-to-date are the same figure, so two matches.
  expect(within(concretePanel()).getAllByText(formatVolume(s.concrete.periodOutput!)).length).toBeGreaterThan(0);
}

/** Figures that must never change with the period. */
function snapshotFigures() {
  return {
    open: within(card('Current Sales Orders')).getAllByText(/\d/).map((n) => n.textContent),
    active: within(card('Active Production Orders')).getAllByText(/\d/).map((n) => n.textContent),
    monthToDate: within(concretePanel()).getByText(/^Month to date ·/).parentElement!.textContent,
    asOf: screen.getByText(/^Demo reference time:/).textContent,
  };
}

describe('initial load', () => {
  it('shows a loading screen without figures, then the Daily view', async () => {
    const fake = await renderDashboard({ loadDaily: false });
    expect(screen.getAllByText('Loading demo data…').length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('listitem').filter((li) => /\d/.test(li.textContent ?? ''))).toEqual([]);
    expect(screen.getByRole('heading', { name: 'Produced Elements' }).closest('article')!.textContent).not.toMatch(/\d/);
    await settle(fake.latest('daily'));
    expectShowing('daily');
  });

  it('recovers from an initial failure with Try again', async () => {
    const fake = await renderDashboard({ loadDaily: false });
    await fail(fake.latest('daily'));
    expect(screen.getByRole('alert').textContent).toContain('Demo data unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await settle(fake.latest('daily'));
    expectShowing('daily');
  });
});

describe('period switching', () => {
  it('switches across all four periods, keeping old figures labelled until the new data commits', async () => {
    const fake = await renderDashboard();
    let shown: Period = 'daily';
    for (const next of ['weekly', 'monthly', 'yearly', 'daily'] as const) {
      await userEvent.click(button(next));
      if (next !== 'daily') {
        // Pending: the old view and all its labels stay; the request is announced.
        expect(button(next).getAttribute('aria-pressed')).toBe('true');
        expect(status()).toContain(`Loading ${PERIOD_LABELS[next]}…`);
        expectShowing(shown);
        await settle(fake.latest(next));
      }
      // Daily is cached from the first load and commits immediately.
      expectShowing(next);
      expect(status()).not.toContain('Loading');
      shown = next;
    }
  });

  it('keeps Current order counts, month-to-date concrete and the reference time unchanged', async () => {
    const fake = await renderDashboard();
    const before = snapshotFigures();
    for (const next of ['weekly', 'monthly', 'yearly'] as const) {
      await userEvent.click(button(next));
      await settle(fake.latest(next));
      expect(snapshotFigures()).toEqual(before);
    }
  });

  it('commits only the latest of several rapid selections and cancels the obsolete requests', async () => {
    const fake = await renderDashboard();
    await userEvent.click(button('weekly'));
    await userEvent.click(button('monthly'));
    await userEvent.click(button('yearly'));
    expect(fake.latest('weekly').signal?.aborted).toBe(true);
    expect(fake.latest('monthly').signal?.aborted).toBe(true);

    // Late responses for abandoned periods change nothing.
    await settle(fake.latest('monthly'));
    await settle(fake.latest('weekly'));
    expectShowing('daily');
    expect(status()).toContain('Loading Yearly…');

    await settle(fake.latest('yearly'));
    expectShowing('yearly');
  });

  it('ignores an out-of-order response after the user returns to the shown period', async () => {
    const fake = await renderDashboard();
    await userEvent.click(button('monthly'));
    await userEvent.click(button('daily')); // cached: settles at once
    expect(fake.latest('monthly').signal?.aborted).toBe(true);
    await settle(fake.latest('monthly'));
    expectShowing('daily');
    expect(status()).not.toContain('Loading');
  });
});

describe('failed selection', () => {
  it('keeps the last successful view and its labels, names the failed period and recovers on retry', async () => {
    const fake = await renderDashboard();
    await userEvent.click(button('yearly'));
    await fail(fake.latest('yearly'));

    expect(status()).toContain('Yearly did not load');
    expectShowing('daily');
    expect(button('yearly').getAttribute('aria-pressed')).toBe('true');

    const retry = screen.getByRole('button', { name: 'Retry' });
    await userEvent.click(retry);
    await act(flush);
    // Retrying is a fresh load: the error clears, Daily stays on screen, and focus
    // moves from the vanished retry button to the requested period.
    expect(status()).toContain('Loading Yearly…');
    expect(status()).not.toContain('did not load');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(document.activeElement).toBe(button('yearly'));
    expectShowing('daily');

    await settle(fake.latest('yearly'));
    expectShowing('yearly');
    expect(document.activeElement).toBe(button('yearly'));
  });

  it('clears the error after a different successful selection', async () => {
    const fake = await renderDashboard();
    await userEvent.click(button('monthly'));
    await fail(fake.latest('monthly'));
    expect(status()).toContain('Monthly did not load');

    await userEvent.click(button('weekly'));
    await settle(fake.latest('weekly'));
    expectShowing('weekly');
    expect(status()).not.toContain('did not load');
  });

  it('reports invalid data as failing checks', async () => {
    const fake = await renderDashboard();
    await userEvent.click(button('weekly'));
    await fail(fake.latest('weekly'), new DashboardDataError('invalid-response', 'bad'));
    expect(status()).toContain('Weekly figures failed checks');
    expectShowing('daily');
  });
});

describe('keyboard and announcements', () => {
  it('reaches every period button with Tab and activates them with Enter and Space; focus stays put', async () => {
    const user = userEvent.setup();
    const fake = await renderDashboard();

    await user.tab();
    expect(document.activeElement).toBe(button('daily'));
    await user.tab();
    expect(document.activeElement).toBe(button('weekly'));
    await user.keyboard('{Enter}');
    await settle(fake.latest('weekly'));
    expectShowing('weekly');
    expect(document.activeElement).toBe(button('weekly'));

    await user.tab();
    await user.keyboard(' ');
    await settle(fake.latest('monthly'));
    expectShowing('monthly');
    expect(document.activeElement).toBe(button('monthly'));

    await user.tab();
    expect(document.activeElement).toBe(button('yearly'));
  });

  it('communicates selection with aria-pressed, not colour alone', async () => {
    await renderDashboard();
    expect(button('daily').getAttribute('aria-pressed')).toBe('true');
    for (const p of ['weekly', 'monthly', 'yearly'] as const) expect(button(p).getAttribute('aria-pressed')).toBe('false');
  });

  it('announces status politely and keeps the live clock out of the live region', async () => {
    await renderDashboard();
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(document.querySelector('time')!.closest('[aria-live]')).toBeNull();
  });
});

describe('demo date wording', () => {
  it('labels order cards Current with a dated snapshot and never calls demo figures "today" or "now"', async () => {
    const fake = await renderDashboard();
    for (const title of ['Current Sales Orders', 'Active Production Orders']) {
      expect(within(card(title)).getByText('Current')).toBeTruthy();
      expect(within(card(title)).getByText(/as of Wed 14 Oct, 2:00 PM/)).toBeTruthy();
    }
    expect(screen.getByText(/^Demo reference time:/).textContent).toContain('Wed 14 Oct 2026, 2:00 PM');
    expect(screen.getByText(/^Last successful demo load:/)).toBeTruthy();

    for (const next of ['weekly', 'monthly', 'yearly', 'daily'] as const) {
      await userEvent.click(button(next));
      if (next !== 'daily') await settle(fake.latest(next));
      const main = screen.getByRole('main').textContent ?? '';
      expect(main).not.toMatch(/\btoday\b|\bnow\b|this (week|month|year)/i);
    }
  });

  it('keeps Demo data and SAP not connected visible, with the clock apart from data times', async () => {
    await renderDashboard();
    expect(screen.getAllByText('Demo data').length).toBe(2);
    expect(screen.getByText(/SAP not connected/)).toBeTruthy();
    expect(screen.getByRole('main').textContent).not.toMatch(/Kuwait/);
  });
});

describe('overview content', () => {
  it('removes capacity, projects and the old product panel', async () => {
    await renderDashboard();
    const text = screen.getByRole('main').textContent ?? '';
    expect(text).not.toMatch(/capacity|Active Projects|Production by Product|Production & Delivery|Delivered Element\b/i);
    expect(text).not.toMatch(/%/);
  });

  it('never prints a single total across units on the quantity cards', async () => {
    await renderDashboard();
    expect(within(card('Produced Elements')).queryByText(/^pieces$/)).not.toBeNull(); // the verified row only
    expect(within(card('Produced Elements')).getAllByRole('listitem')).toHaveLength(expected.daily.output.rows.length);
  });
});

describe('product-and-unit trend selector', () => {
  const selector = (name: string) => screen.getByRole('button', { name });
  const names = expected.daily.output.rows.map(formatSeriesName);
  const chartLabel = () => screen.getByRole('img', { name: /produced/ }).getAttribute('aria-label') ?? '';

  it('offers each product and unit, with exactly one selected, and no combined option', async () => {
    await renderDashboard();
    expect(names).toEqual(['Hollowcore · m²', 'Precast volume · m³', 'Precast pieces', 'GRC · m²']);
    for (const name of names) expect(selector(name)).toBeTruthy();
    const group = screen.getByRole('group', { name: 'Product and unit' });
    expect(within(group).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
    expect(within(group).queryByRole('button', { name: /all|total/i })).toBeNull();
  });

  it('reconciles the chart total with the matching row for every period and series', async () => {
    const fake = await renderDashboard();
    for (const period of ['daily', 'weekly', 'monthly', 'yearly'] as const) {
      await userEvent.click(button(period));
      if (period !== 'daily') await settle(fake.latest(period));
      for (const row of expected[period].output.rows) {
        await userEvent.click(selector(formatSeriesName(row)));
        const total = formatQuantityWithUnit(row.produced!, row.unit);
        expect(trendMeta()).toContain(`total ${total}`);
        expect(chartLabel()).toContain(formatSeriesName(row));
        expect(chartLabel()).toContain(`total ${total}`);
        expect(selector(formatSeriesName(row)).getAttribute('aria-pressed')).toBe('true');
      }
    }
  });

  it('keeps the chosen series when the period changes, and only after the new data commits', async () => {
    const fake = await renderDashboard();
    await userEvent.click(selector('Precast volume · m³'));
    await userEvent.click(button('monthly'));
    const dailyPrecast = expected.daily.output.rows.find((r) => r.key === 'precast:m3')!;
    expect(trendMeta()).toContain(`total ${formatQuantityWithUnit(dailyPrecast.produced!, 'm3')}`);
    await settle(fake.latest('monthly'));
    const monthlyPrecast = expected.monthly.output.rows.find((r) => r.key === 'precast:m3')!;
    expect(trendMeta()).toContain(`total ${formatQuantityWithUnit(monthlyPrecast.produced!, 'm3')}`);
  });

  it('says Hourly detail unavailable for date-only Daily data, and not for longer periods', async () => {
    const fake = await renderDashboard();
    expect(screen.queryByText('Hourly detail unavailable')).toBeNull();
    await userEvent.click(selector('GRC · m²'));
    expect(screen.getByText('Hourly detail unavailable')).toBeTruthy();
    expect(trendMeta()).toContain('Day total');
    await userEvent.click(button('weekly'));
    await settle(fake.latest('weekly'));
    expect(screen.queryByText('Hourly detail unavailable')).toBeNull();
  });

  it('can be operated from the keyboard, keeping focus', async () => {
    const user = userEvent.setup();
    await renderDashboard();
    selector('Precast volume · m³').focus();
    await user.keyboard('{Enter}');
    expect(selector('Precast volume · m³').getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(selector('Precast volume · m³'));
  });
});

describe('unknown and unmapped values', () => {
  const withUnknowns = (period: Period): DashboardSnapshot => {
    const s = expected[period];
    const [first, ...rest] = s.output.rows;
    return {
      ...s,
      orders: { ...s.orders, openSalesOrders: null },
      concrete: { ...s.concrete, periodOutput: null, monthToDate: null },
      output: {
        ...s.output,
        deliveryDocumentCount: null,
        rows: [{ ...first!, delivered: null }, ...rest],
      },
    };
  };

  it('shows Not available instead of zero', async () => {
    await renderDashboard({ snapshotFor: withUnknowns });
    expect(within(card('Current Sales Orders')).getByText('Not available')).toBeTruthy();
    expect(within(card('Delivered Elements')).getByText('Not available')).toBeTruthy();
    expect(within(concretePanel()).getAllByText('Not available')).toHaveLength(2);
    expect(within(card('Delivered Elements')).queryByText(/delivery note/)).toBeNull();
  });

  it('keeps unmapped items and unverified units visible and flagged', async () => {
    const withUnmapped = (period: Period): DashboardSnapshot => {
      const s = expected[period];
      const trend = s.output.productionSeries[0]!.trend.map((b) => ({ ...b, quantity: b.quantity === null ? null : 0 }));
      trend[0] = { ...trend[0]!, quantity: 5 };
      const extra = (unit: 'raw:LM') => ({ key: `unmapped:${unit}`, product: 'unmapped' as const, unit, subtype: null });
      return {
        ...s,
        output: {
          ...s.output,
          rows: [...s.output.rows, { ...extra('raw:LM'), produced: 5, delivered: 0, producedElementCount: null, deliveredElementCount: null }],
          productionSeries: [
            ...s.output.productionSeries,
            { ...extra('raw:LM'), granularity: 'hour', hourlyDetail: 'available', total: 5, trend },
          ],
        },
      };
    };
    await renderDashboard({ snapshotFor: withUnmapped });
    const row = within(card('Produced Elements')).getByText('Unmapped items · LM (unverified)').closest('li')!;
    expect(row.textContent).toContain('5 LM (unverified)');
    expect(screen.getByRole('button', { name: 'Unmapped items · LM (unverified)' })).toBeTruthy();
  });
});

describe('project selector', () => {
  const trigger = () => screen.getByRole('button', { name: /^Project:/ });
  const pick = async (search: string) => {
    await userEvent.click(trigger());
    await userEvent.keyboard(search);
    await userEvent.keyboard('{Enter}');
  };

  it('defaults to All Projects and lists names with their codes', async () => {
    await renderDashboard();
    expect(trigger().getAttribute('aria-label')).toBe('Project: All Projects');
    await userEvent.click(trigger());
    const options = screen.getAllByRole('option');
    expect(options[0]!.textContent).toContain('All Projects');
    expect(options.at(-1)!.textContent).toContain('Unassigned');
    expect(screen.getByRole('option', { name: /Hospital Extension Block/ }).textContent).toContain('DEMO-P03');
  });

  it('searches by name and by code', async () => {
    await renderDashboard();
    await userEvent.click(trigger());
    await userEvent.keyboard('marina');
    const results = () => within(screen.getByRole('group', { name: 'Matching projects' })).queryAllByRole('option').map((o) => o.textContent);
    expect(results()).toEqual(['Marina Car Park DeckDEMO-P06']);
    await userEvent.clear(screen.getByRole('combobox'));
    await userEvent.keyboard('p03');
    expect(results()).toEqual(['Hospital Extension BlockDEMO-P03']);
    await userEvent.clear(screen.getByRole('combobox'));
    await userEvent.keyboard('zzz');
    expect(results()).toEqual([]);
    expect(screen.getByText('No matching projects')).toBeTruthy();
    expect(screen.getByRole('option', { name: /All Projects/ })).toBeTruthy(); // still pinned
  });

  it('closes on Escape and returns focus to the button', async () => {
    await renderDashboard();
    await userEvent.click(trigger());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('keeps the old view until the project commits, then updates everything together', async () => {
    const fake = await renderDashboard();
    await pick('hospital');
    expect(trigger().getAttribute('aria-label')).toBe('Project: Hospital Extension Block');
    expect(status()).toContain('Loading Hospital Extension Block…');
    expectShowing('daily');

    await settle(fake.latest('daily', 'DEMO-P03'));
    expectShowing('daily', 'DEMO-P03');
    expect(status()).not.toContain('Loading');
  });

  it('keeps the project through period changes and the period through project changes', async () => {
    const fake = await renderDashboard();
    await pick('coastal');
    await settle(fake.latest('daily', 'DEMO-P01'));
    await userEvent.click(button('monthly'));
    await settle(fake.latest('monthly', 'DEMO-P01'));
    expectShowing('monthly', 'DEMO-P01');
    await pick('unassigned');
    await settle(fake.latest('monthly', '__unassigned__'));
    expectShowing('monthly', '__unassigned__');
  });

  it('shows every period and project with reconciled cards, chart and summary', async () => {
    const fake = await renderDashboard();
    await pick('school');
    await settle(fake.latest('daily', 'DEMO-P04'));
    for (const period of ['weekly', 'monthly', 'yearly'] as const) {
      await userEvent.click(button(period));
      await settle(fake.latest(period, 'DEMO-P04'));
      expectShowing(period, 'DEMO-P04');
      const s = snapshotOf(period, 'DEMO-P04');
      const row = s.output.rows.find((r) => r.produced! > 0)!;
      await userEvent.click(screen.getByRole('button', { name: formatSeriesName(row) }));
      expect(trendMeta()).toContain(`total ${formatQuantityWithUnit(row.produced!, row.unit)}`);
    }
  });

  it('commits only the latest of rapid project selections', async () => {
    const fake = await renderDashboard();
    await pick('coastal');
    await pick('hospital');
    await pick('marina');
    expect(fake.latest('daily', 'DEMO-P01').signal?.aborted).toBe(true);
    expect(fake.latest('daily', 'DEMO-P03').signal?.aborted).toBe(true);

    await settle(fake.latest('daily', 'DEMO-P03'));
    await settle(fake.latest('daily', 'DEMO-P01'));
    expectShowing('daily');
    await settle(fake.latest('daily', 'DEMO-P06'));
    expectShowing('daily', 'DEMO-P06');
  });

  it('commits only the latest when project and period change quickly together', async () => {
    const fake = await renderDashboard();
    await pick('coastal');
    await userEvent.click(button('weekly'));
    expect(status()).toContain('Loading Coastal Residential Towers, Weekly…');
    await settle(fake.latest('daily', 'DEMO-P01'));
    expectShowing('daily');
    await settle(fake.latest('weekly', 'DEMO-P01'));
    expectShowing('weekly', 'DEMO-P01');
  });

  it('keeps the last good view, names the failed project and recovers with Retry', async () => {
    const fake = await renderDashboard();
    await pick('ring road');
    await fail(fake.latest('daily', 'DEMO-P02'));
    expect(status()).toContain('Ring Road Bridge Segments did not load');
    expectShowing('daily');

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await act(flush);
    expect(document.activeElement).toBe(trigger());
    await settle(fake.latest('daily', 'DEMO-P02'));
    expectShowing('daily', 'DEMO-P02');
  });

  it('keeps the chosen product and says so when a project has none', async () => {
    const fake = await renderDashboard();
    const hollowcore = screen.getByRole('button', { name: 'Hollowcore · m²' });
    expect(hollowcore.getAttribute('aria-pressed')).toBe('true');
    await pick('ring road');
    await settle(fake.latest('daily', 'DEMO-P02'));

    expect(screen.getByRole('button', { name: 'Hollowcore · m²' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('note').textContent).toBe('No Hollowcore · m² production recorded for Ring Road Bridge Segments in the selected day.');
    expect(screen.queryByRole('img', { name: /produced/ })).toBeNull();
  });
});

describe('project summary', () => {
  it('applies a project when its row is chosen, and keeps keyboard focus on the page', async () => {
    const user = userEvent.setup();
    const fake = await renderDashboard();
    const { option } = summaryLines(expected.daily)[0]!;
    screen.getByRole('button', { name: `Show ${option.name}` }).focus();
    await user.keyboard('{Enter}');
    await settle(fake.latest('daily', option.key));
    expectShowing('daily', option.key);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Project:/ }));
  });

  it('returns to all projects from a filtered summary', async () => {
    const fake = await renderDashboard();
    const { option } = summaryLines(expected.daily)[0]!;
    await userEvent.click(within(summaryPanel()).getAllByRole('row')[1]!);
    await settle(fake.latest('daily', option.key));
    // The filter stays on its project until the user returns to all projects.
    expect(within(summaryPanel()).getAllByRole('row').slice(1).map((r) => r.textContent)).toHaveLength(1);
    expect(summaryTable().getByText(option.name)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Show All Projects' }));
    expectShowing('daily');
  });

  it('pages long lists with a visible indicator and resets on a new view', async () => {
    const fake = await renderDashboard();
    await userEvent.click(button('yearly'));
    await settle(fake.latest('yearly'));
    // jsdom cannot lay out pages, so the panel falls back to four rows per page.
    const pages = Math.ceil(summaryLines(expected.yearly).length / 4);
    expect(within(summaryPanel()).getByText(new RegExp(`· Page 1 of ${pages}$`))).toBeTruthy();

    const next = screen.getByRole('button', { name: 'Next' });
    const previous = screen.getByRole('button', { name: 'Previous' });
    expect(previous.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(next);
    expect(within(summaryPanel()).getByText(new RegExp(`· Page 2 of ${pages}$`))).toBeTruthy();
    expect(document.activeElement).toBe(next);
    await userEvent.click(button('monthly'));
    await settle(fake.latest('monthly'));
    expect(within(summaryPanel()).getByText(/· Page 1 of/)).toBeTruthy();
  });

  it('labels activity, not completion', async () => {
    await renderDashboard();
    const text = summaryPanel().textContent ?? '';
    expect(text).toContain('Hollowcore · m² · Selected day activity');
    expect(text).not.toMatch(/complete|%/i);
  });

  it('shows units beside every quantity', async () => {
    await renderDashboard();
    for (const row of within(summaryPanel()).getAllByRole('row').slice(1)) {
      const cells = within(row).getAllByRole('cell');
      for (const cell of cells.slice(-2)) expect(cell.textContent).toMatch(/\d (m²|m³|pieces?)$/);
    }
  });

  it('keeps an unverified unit short in quantity cells and flagged in the product column', () => {
    expect(formatCellQuantity(40, 'raw:LM')).toBe('40 LM');
    expect(formatCellQuantity(40, 'raw:')).toBe('40 no unit');
    expect(formatCellQuantity(12.5, 'm3')).toBe('12.5 m³');
    expect(formatSeriesName({ product: 'hollowcore', unit: 'raw:LM' })).toBe('Hollowcore · LM (unverified)');
    expect(formatCellQuantity(6, 'nos')).toBe('6 Nos');
  });

  it('has a useful empty state', async () => {
    const empty: SnapshotFor = (period, project) => ({ ...snapshotOf(period, project), projectSummary: [] });
    await renderDashboard({ snapshotFor: empty });
    expect(within(summaryPanel()).getByText('No Hollowcore · m² activity recorded for All Projects in the selected day.')).toBeTruthy();
  });
});

describe('precast labels', () => {
  it('names the two Precast groups plainly and the same way everywhere', async () => {
    await renderDashboard();
    for (const title of ['Produced Elements', 'Delivered Elements']) {
      const names = within(card(title)).getAllByRole('listitem').map((li) => li.firstElementChild!.textContent);
      expect(names).toEqual(['Hollowcore', 'Precast volume', 'Precast pieces', 'GRC']);
    }
    expect(screen.getByRole('button', { name: 'Precast volume · m³' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Precast pieces' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Precast pieces' }));
    expect(summaryPanel().textContent).toContain('Precast pieces · Selected day activity');
    expect(screen.getByRole('main').textContent).not.toMatch(/Precast · |beam|wall|manhole/i);
  });

  it('keeps units beside the quantities and on the chart axis', async () => {
    await renderDashboard();
    const volume = within(card('Produced Elements')).getByText('Precast volume').closest('li')!;
    expect(volume.textContent).toMatch(/\d m³$/);
    await userEvent.click(screen.getByRole('button', { name: 'Precast volume · m³' }));
    expect(trendMeta()).toMatch(/total [\d,.]+ m³/);
  });
});

describe('project summary follows the chart', () => {
  it('shows the selected product and unit, one row per project, with units beside quantities', async () => {
    await renderDashboard();
    await userEvent.click(screen.getByRole('button', { name: 'Precast volume · m³' }));
    expect(summaryPanel().textContent).toContain('Precast volume · m³ · Selected day activity');
    const header = within(summaryPanel()).getAllByRole('columnheader').map((h) => h.textContent);
    expect(header).toEqual(['Project', 'Produced', 'Delivered']);
    const rows = within(summaryPanel()).getAllByRole('row').slice(1);
    const expectedLines = summaryLines(expected.daily, 'precast:m3').slice(0, 4);
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual(
      expectedLines.map(({ option }) => `${option.name}${option.code ?? ''}`),
    );
    for (const r of rows) for (const cell of within(r).getAllByRole('cell')) expect(cell.textContent).toMatch(/ m³$/);
  });

  it('orders projects alphabetically with Unassigned last, not by size', async () => {
    const fake = await renderDashboard();
    await userEvent.click(button('yearly'));
    await settle(fake.latest('yearly'));
    const names = summaryLines(expected.yearly).map(({ option }) => option.name);
    expect(names.at(-1)).toBe('Unassigned');
    expect(names.slice(0, -1)).toEqual([...names.slice(0, -1)].sort((a, b) => a.localeCompare(b)));
  });

  it('includes a project with deliveries but no production', async () => {
    const deliveredOnly: SnapshotFor = (period, project) => {
      const s = snapshotOf(period, project);
      const extra = { ...s.projectSummary.find((r) => r.rowKey === 'hollowcore:m2')!, projectKey: 'DEMO-P07', produced: 0, delivered: 5 };
      return { ...s, projectSummary: [...s.projectSummary.filter((r) => !(r.projectKey === 'DEMO-P07' && r.rowKey === 'hollowcore:m2')), extra] };
    };
    await renderDashboard({ snapshotFor: deliveredOnly });
    while (!summaryTable().queryByText('Community Mosque Annex')) await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    const row = summaryTable().getByText('Community Mosque Annex').closest('tr')!;
    expect(row.textContent).toContain('0.0 m²');
    expect(row.textContent).toContain('5.0 m²');
  });

  it('returns to the first page when the product changes', async () => {
    const fake = await renderDashboard();
    await userEvent.click(button('yearly'));
    await settle(fake.latest('yearly'));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(within(summaryPanel()).getByText(/· Page 2 of/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Precast volume · m³' }));
    expect(within(summaryPanel()).getByText(/· Page 1 of/)).toBeTruthy();
  });

  it('keeps a filtered project on screen, even with no activity for the product', async () => {
    const fake = await renderDashboard();
    await userEvent.click(screen.getByRole('button', { name: /^Project:/ }));
    await userEvent.keyboard('ring road{Enter}');
    await settle(fake.latest('daily', 'DEMO-P02'));
    expect(summaryPanel().textContent).toContain('No Hollowcore · m² activity recorded for Ring Road Bridge Segments in the selected day.');
    expect(screen.getByRole('button', { name: 'Show All Projects' })).toBeTruthy();
    expect(status()).toContain('Showing Ring Road Bridge Segments');
  });
});

describe('concrete output scope', () => {
  it('labels both quantities and says it is not filtered while a project is selected', async () => {
    const fake = await renderDashboard();
    expect(concretePanel().textContent).toContain('All Projects · batch plant');
    await userEvent.click(screen.getByRole('button', { name: /^Project:/ }));
    await userEvent.keyboard('coastal{Enter}');
    await settle(fake.latest('daily', 'DEMO-P01'));
    expect(concretePanel().textContent).toContain('All Projects · not filtered by project');
    expect(within(concretePanel()).getByText('Selected day')).toBeTruthy();
    expect(within(concretePanel()).getByText(MONTH_TO_DATE_LABEL)).toBeTruthy();
    expect(within(concretePanel()).getAllByText(formatVolume(expected.daily.concrete.periodOutput!)).length).toBeGreaterThan(0);
  });
});

describe('selected product highlight', () => {
  const current = (title: string) =>
    within(card(title))
      .getAllByRole('listitem')
      .filter((li) => li.getAttribute('aria-current') === 'true')
      .map((li) => li.firstElementChild!.textContent);

  it("marks the chart's product and unit in both quantity cards, and keeps every row", async () => {
    await renderDashboard();
    expect(current('Produced Elements')).toEqual(['Hollowcore']);
    expect(current('Delivered Elements')).toEqual(['Hollowcore']);
    const orders = snapshotFigures();

    await userEvent.click(screen.getByRole('button', { name: 'Precast pieces' }));
    expect(current('Produced Elements')).toEqual(['Precast pieces']); // not Precast volume
    expect(current('Delivered Elements')).toEqual(['Precast pieces']);
    expect(within(card('Produced Elements')).getAllByRole('listitem')).toHaveLength(4);
    expect(snapshotFigures()).toEqual(orders);

    await userEvent.click(screen.getByRole('button', { name: 'Precast volume · m³' }));
    expect(current('Produced Elements')).toEqual(['Precast volume']);
  });
});

describe('project summary totals reconcile', () => {
  it('matches the headline rows and the chart total for every product and period', async () => {
    const fake = await renderDashboard();
    for (const period of PERIODS) {
      if (period !== 'daily') {
        await userEvent.click(button(period));
        await settle(fake.latest(period));
      }
      for (const row of expected[period].output.rows) {
        await userEvent.click(screen.getByRole('button', { name: formatSeriesName(row) }));
        const totals = within(summaryPanel()).getByText('All projects').parentElement!.textContent ?? '';
        expect(totals).toContain(`Produced ${formatCellQuantity(row.produced!, row.unit)}`);
        expect(totals).toContain(`Delivered ${formatCellQuantity(row.delivered!, row.unit)}`);
        expect(trendMeta()).toContain(`total ${formatQuantityWithUnit(row.produced!, row.unit)}`);
      }
    }
  });

  it('allows delivery above production without any warning', async () => {
    const fake = await renderDashboard();
    await userEvent.click(button('yearly'));
    await settle(fake.latest('yearly'));
    const pieces = expected.yearly.output.rows.find((r) => r.key === 'precast:pieces')!;
    expect(pieces.delivered!).toBeGreaterThan(pieces.produced!);
    await userEvent.click(screen.getByRole('button', { name: 'Precast pieces' }));
    expect(screen.getByRole('main').textContent).not.toMatch(/%|exceed|shortfall|over-deliver/i);
  });
});

describe('automatic paging on the dashboard', () => {
  const autoGroup = () => screen.getByRole('group', { name: 'Auto pages' });

  it('is off by default and holds still while the selector is open or a view is loading', async () => {
    const fake = await renderDashboard();
    await userEvent.click(button('yearly'));
    await settle(fake.latest('yearly'));
    expect(within(autoGroup()).getByRole('button').textContent).toBe('Start');

    await userEvent.click(within(autoGroup()).getByRole('button'));
    expect(autoGroup().textContent).toContain('Auto pages');

    await userEvent.click(screen.getByRole('button', { name: /^Project:/ }));
    expect(autoGroup().textContent).toContain('Auto pages paused');
    await userEvent.keyboard('{Escape}');

    await userEvent.click(button('monthly')); // stays pending
    expect(status()).toContain('Loading Monthly…');
    expect(autoGroup().textContent).toContain('Auto pages paused');
  });

  it('stays on across a new view and starts again from the first page', async () => {
    const fake = await renderDashboard();
    await userEvent.click(button('yearly'));
    await settle(fake.latest('yearly'));
    await userEvent.click(within(autoGroup()).getByRole('button'));
    await userEvent.click(button('monthly'));
    await settle(fake.latest('monthly'));
    expect(within(autoGroup()).getByRole('button').textContent).toBe('Pause');
    expect(within(summaryPanel()).getByText(/· Page 1 of/)).toBeTruthy();
  });
});

describe('choosing All Projects', () => {
  it('returns every figure to the All Projects scope', async () => {
    const fake = await renderDashboard();
    await userEvent.click(screen.getByRole('button', { name: /^Project:/ }));
    await userEvent.keyboard('coastal{Enter}');
    await settle(fake.latest('daily', 'DEMO-P01'));
    expectShowing('daily', 'DEMO-P01');

    await userEvent.click(screen.getByRole('button', { name: /^Project:/ }));
    await userEvent.click(screen.getByRole('option', { name: /All Projects/ }));
    // Cached from the first load, so it commits at once.
    expectShowing('daily');
    expect(screen.getByRole('button', { name: /^Project:/ }).getAttribute('aria-label')).toBe('Project: All Projects');
    expect(concretePanel().textContent).toContain('All Projects · batch plant');
  });
});

describe('wording that depends on the reference time', () => {
  it('labels month to date with the snapshot cutoff in every period, beside the selected-period figure', async () => {
    const fake = await renderDashboard();
    for (const period of PERIODS) {
      if (period !== 'daily') {
        await userEvent.click(button(period));
        await settle(fake.latest(period));
      }
      expect(within(concretePanel()).getByText(MONTH_TO_DATE_LABEL)).toBeTruthy();
      expect(within(concretePanel()).getByText(SCOPES[period])).toBeTruthy(); // the full-period label stays separate
      expect(concretePanel().textContent).toContain('All Projects · batch plant');
    }
  });

  it('follows the cutoff in the data, not the live clock', async () => {
    const shifted: SnapshotFor = (period, project) => {
      const s = snapshotOf(period, project);
      return { ...s, concrete: { ...s.concrete, monthToDateThrough: '2026-10-09T09:30:00+03:00' } };
    };
    await renderDashboard({ snapshotFor: shifted });
    expect(within(concretePanel()).getByText('Month to date · through 9 Oct 2026')).toBeTruthy();
    expect(concretePanel().textContent).not.toContain('14 Oct');
  });

  it('keeps Not available when the month-to-date figure is unknown', async () => {
    const unknown: SnapshotFor = (period, project) => {
      const s = snapshotOf(period, project);
      return { ...s, concrete: { ...s.concrete, monthToDate: null } };
    };
    await renderDashboard({ snapshotFor: unknown });
    expect(within(concretePanel()).getByText(MONTH_TO_DATE_LABEL)).toBeTruthy();
    expect(within(concretePanel()).getAllByText('Not available')).toHaveLength(1);
  });

  it('says Later hours only for the future part of the Daily chart', async () => {
    const fake = await renderDashboard();
    const chart = () => screen.getByRole('img', { name: /produced/ }).getAttribute('aria-label') ?? '';
    expect(chart()).toContain('Later hours: not yet occurred at the reference time');
    expect(chart()).not.toContain('Not yet reached');
    await userEvent.click(button('weekly'));
    await settle(fake.latest('weekly'));
    expect(chart()).toContain('Not yet reached: not yet occurred');
    expect(chart()).not.toContain('Later hours');
  });
});
