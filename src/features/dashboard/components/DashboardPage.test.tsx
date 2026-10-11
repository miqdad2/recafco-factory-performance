// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DashboardSnapshot, Period } from '../../../lib/dashboard/contracts';
import { DashboardDataError } from '../../../lib/dashboard/errors';
import { formatCount, formatVolume } from '../../../lib/format';
import type { DashboardDataProvider } from '../../../lib/dashboard/provider';
import { createDemoProvider } from '../../../lib/dashboard/providers/demo';
import { DashboardDataContext } from '../dataProvider';
import { formatPeriodRange, PERIOD_LABELS } from '../labels';
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
const expected = Object.fromEntries(
  await Promise.all((['daily', 'weekly', 'monthly', 'yearly'] as const).map(async (p) => [p, await real.getSnapshot({ period: p })])),
) as Record<Period, DashboardSnapshot>;

interface Call {
  period: Period;
  signal: AbortSignal | undefined;
  resolve: () => Promise<void>;
  reject: (error: unknown) => void;
}

/** Provider whose requests stay pending until the test resolves or rejects them. */
function controllableProvider() {
  const calls: Call[] = [];
  const provider: DashboardDataProvider = {
    scope: 'test@2026-10-14T14:00:00+03:00',
    getSnapshot({ period }, signal) {
      return new Promise<DashboardSnapshot>((resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DashboardDataError('aborted', 'Request cancelled')));
        calls.push({ period, signal, resolve: async () => resolve(expected[period]), reject });
      });
    },
  };
  const latest = (period: Period) => {
    const call = [...calls].reverse().find((c) => c.period === period);
    if (!call) throw new Error(`No request for ${period}`);
    return call;
  };
  return { provider, calls, latest };
}

async function renderDashboard({ loadDaily = true } = {}) {
  const fake = controllableProvider();
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
const trendMeta = () => screen.getByRole('heading', { name: 'Concrete Production Trend' }).parentElement!.textContent ?? '';
const gradeMeta = () => screen.getByRole('heading', { name: 'Production by Concrete Grade' }).parentElement!.textContent ?? '';
const SCOPES: Record<Period, string> = { daily: 'Selected day', weekly: 'Selected week', monthly: 'Selected month', yearly: 'Selected year' };

/** Asserts that every period-dependent figure and label on screen belongs to `period`. */
function expectShowing(period: Period) {
  const s = expected[period];
  expect(status()).toContain(`Showing ${formatPeriodRange(s)}`);
  expect(within(card('Concrete Produced')).getByText(formatVolume(s.output.concrete.total))).toBeTruthy();
  expect(within(card('Concrete Produced')).getByText(SCOPES[period])).toBeTruthy();
  expect(within(card('Delivered Output')).getByText(formatCount(s.output.delivered.total))).toBeTruthy();
  expect(within(card('Delivered Output')).getByText(`${formatCount(s.output.delivered.documentCount)} delivery notes`)).toBeTruthy();
  expect(trendMeta()).toContain(SCOPES[period].toLowerCase());
  expect(trendMeta()).toContain(`total ${formatVolume(s.output.concrete.total)} m³`);
  expect(gradeMeta()).toContain(`${SCOPES[period]} · m³`);
}

/** Figures that must never change with the period. */
function snapshotFigures() {
  return {
    open: within(card('Current Sales Orders')).getAllByText(/\d/).map((n) => n.textContent),
    active: within(card('Active Production Orders')).getAllByText(/\d/).map((n) => n.textContent),
    capacity: screen.getByRole('heading', { name: 'Monthly Plant Capacity' }).closest('section')!.textContent,
    projects: screen.getByRole('heading', { name: 'Active Projects' }).closest('section')!.textContent,
    asOf: screen.getByText(/^Demo reference time:/).textContent,
  };
}

describe('initial load', () => {
  it('shows a loading screen without figures, then the Daily view', async () => {
    const fake = await renderDashboard({ loadDaily: false });
    expect(screen.getAllByText('Loading demo data…').length).toBeGreaterThan(0);
    expect(screen.queryByText(formatVolume(expected.daily.output.concrete.total))).toBeNull();
    await settle(fake.latest('daily'));
    expectShowing('daily');
  });

  it('recovers from an initial failure with Try again', async () => {
    const fake = await renderDashboard({ loadDaily: false });
    await fail(fake.latest('daily'));
    expect(screen.getByRole('alert').textContent).toContain('Demo data unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
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

  it('keeps order snapshots, monthly capacity, projects and the reference time unchanged', async () => {
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

    const retry = screen.getByRole('button', { name: 'Try again' });
    await userEvent.click(retry);
    await act(flush);
    // Retrying is a fresh load: the error clears, Daily stays on screen, and focus
    // moves from the vanished retry button to the requested period.
    expect(status()).toContain('Loading Yearly…');
    expect(status()).not.toContain('did not load');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
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
  it('labels order cards as a dated demo snapshot and never calls demo figures "today" or "now"', async () => {
    const fake = await renderDashboard();
    for (const title of ['Current Sales Orders', 'Active Production Orders']) {
      expect(within(card(title)).getByText('Demo snapshot')).toBeTruthy();
      expect(within(card(title)).getByText('Wed 14 Oct, 2:00 PM')).toBeTruthy();
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
});
