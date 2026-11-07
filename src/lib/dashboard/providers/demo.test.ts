import { describe, expect, it } from 'vitest';
import { DashboardDataError } from '../errors';
import { generateDemoDataset } from '../fixtures/generate';
import { ALL_PROJECTS } from '../projects';
import { parseSnapshot } from '../validate';
import { createDemoProvider } from './demo';

const FIXED_NOW = Date.parse('2026-11-02T09:30:00Z');

async function validSnapshot() {
  return createDemoProvider({ delayMs: 0, now: () => FIXED_NOW }).getSnapshot({ period: 'daily', project: ALL_PROJECTS });
}

async function expectCode(promise: Promise<unknown>, code: DashboardDataError['code']) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(DashboardDataError);
  expect((error as DashboardDataError).code).toBe(code);
  return error as DashboardDataError;
}

describe('demo provider', () => {
  it('resolves a validated demo snapshot with separate data and load timestamps', async () => {
    const snapshot = await validSnapshot();
    expect(snapshot.source).toBe('demo');
    expect(snapshot.selectedPeriod).toBe('daily');
    expect(snapshot.sourceDataAsOf).toBe('2026-10-14T14:00:00+03:00');
    expect(snapshot.fetchedAt).toBe('2026-11-02T12:30:00+03:00');
  });

  it('serves every period', async () => {
    const provider = createDemoProvider({ delayMs: 0 });
    for (const period of ['weekly', 'monthly', 'yearly'] as const) {
      expect((await provider.getSnapshot({ period, project: ALL_PROJECTS })).selectedPeriod).toBe(period);
    }
  });

  it('serves a project scope and rejects an unknown project', async () => {
    const provider = createDemoProvider({ delayMs: 0 });
    const snapshot = await provider.getSnapshot({ period: 'daily', project: 'DEMO-P01' });
    expect(snapshot.selectedProject).toEqual({ key: 'DEMO-P01', code: 'DEMO-P01', name: 'Coastal Residential Towers' });
    await expectCode(provider.getSnapshot({ period: 'daily', project: 'NOPE' }), 'unavailable');
  });

  it('waits for the simulated delay and can be cancelled', async () => {
    const controller = new AbortController();
    const pending = createDemoProvider({ delayMs: 5_000 }).getSnapshot({ period: 'daily', project: ALL_PROJECTS }, controller.signal);
    controller.abort();
    await expectCode(pending, 'aborted');
  });

  it('rejects an already-cancelled request', async () => {
    const controller = new AbortController();
    controller.abort();
    await expectCode(createDemoProvider({ delayMs: 0 }).getSnapshot({ period: 'daily', project: ALL_PROJECTS }, controller.signal), 'aborted');
  });

  it('rejects invalid source records with a typed error', async () => {
    const broken = generateDemoDataset();
    broken.concreteBatches![0] = { ...broken.concreteBatches![0]!, volumeM3: -3 };
    const error = await expectCode(
      createDemoProvider({ delayMs: 0, loadDataset: () => broken }).getSnapshot({ period: 'daily', project: ALL_PROJECTS }),
      'invalid-source-data',
    );
    expect(error.issues[0]).toContain('concreteBatches.0.volumeM3');
  });

  it('rejects zero, negative or unitless-typed receipt quantities', async () => {
    for (const change of [{ quantity: 0 }, { quantity: -2 }, { uom: 5 }]) {
      const broken = generateDemoDataset();
      broken.productionReceipts[0] = { ...broken.productionReceipts[0]!, ...change } as (typeof broken.productionReceipts)[number];
      const error = await expectCode(
        createDemoProvider({ delayMs: 0, loadDataset: () => broken }).getSnapshot({ period: 'daily', project: ALL_PROJECTS }),
        'invalid-source-data',
      );
      expect(error.issues[0]).toContain('productionReceipts.0');
    }
  });

  it('rejects source records with an invalid timestamp', async () => {
    const broken = { ...generateDemoDataset(), referenceTime: 'yesterday' };
    await expectCode(createDemoProvider({ delayMs: 0, loadDataset: () => broken }).getSnapshot({ period: 'daily', project: ALL_PROJECTS }), 'invalid-source-data');
  });
});

describe('snapshot validation at the provider boundary', () => {
  it('rejects non-objects and missing fields', async () => {
    expect(() => parseSnapshot(null)).toThrow(DashboardDataError);
    const withoutOrders: Record<string, unknown> = { ...(await validSnapshot()) };
    delete withoutOrders.orders;
    expect(() => parseSnapshot(withoutOrders)).toThrow(/failed validation/);
  });

  it('rejects NaN, negative and fractional counts', async () => {
    const s = await validSnapshot();
    for (const bad of [Number.NaN, -1, 2.5]) {
      expect(() => parseSnapshot({ ...s, orders: { ...s.orders, openSalesOrders: bad } })).toThrow(DashboardDataError);
    }
  });

  it('rejects fractional pieces', async () => {
    const s = await validSnapshot();
    const rows = s.output.rows.map((r) => (r.unit === 'pieces' ? { ...r, produced: 2.5 } : r));
    const productionSeries = s.output.productionSeries.map((p) => (p.unit === 'pieces' ? { ...p, total: 2.5 } : p));
    expect(() => parseSnapshot({ ...s, output: { ...s.output, rows, productionSeries } })).toThrow(DashboardDataError);
  });

  it('rejects a chart that does not reconcile with its row', async () => {
    const s = await validSnapshot();
    const [first, ...rest] = s.output.rows;
    const bad = { ...s, output: { ...s.output, rows: [{ ...first!, produced: first!.produced! + 1 }, ...rest] } };
    try {
      parseSnapshot(bad);
      expect.unreachable();
    } catch (error) {
      expect((error as DashboardDataError).code).toBe('invalid-response');
      expect((error as DashboardDataError).issues.join(' ')).toMatch(/Series total does not match the row/);
    }
    const series = s.output.productionSeries.map((p, i) =>
      i === 0 ? { ...p, trend: p.trend.map((b) => (b.quantity ? { ...b, quantity: b.quantity + 1 } : b)) } : p,
    );
    expect(() => parseSnapshot({ ...s, output: { ...s.output, productionSeries: series } })).toThrow(DashboardDataError);
  });

  it('rejects a product and unit listed twice, which would double-count', async () => {
    const s = await validSnapshot();
    const rows = [...s.output.rows, s.output.rows[0]!];
    expect(() => parseSnapshot({ ...s, output: { ...s.output, rows } })).toThrow(/failed validation/);
  });

  it('rejects a row whose key disagrees with its unit', async () => {
    const s = await validSnapshot();
    const rows = s.output.rows.map((r, i) => (i === 0 ? { ...r, unit: 'm3' as const } : r));
    expect(() => parseSnapshot({ ...s, output: { ...s.output, rows } })).toThrow(DashboardDataError);
  });

  it('accepts unknown values as null rather than forcing zero', async () => {
    const s = await validSnapshot();
    const [first, ...rest] = s.output.rows;
    const unknown = parseSnapshot({
      ...s,
      orders: { ...s.orders, openSalesOrders: null },
      concrete: { ...s.concrete, periodOutput: null },
      output: {
        ...s.output,
        rows: [{ ...first!, produced: null, delivered: null }, ...rest],
        productionSeries: s.output.productionSeries.filter((p) => p.key !== first!.key),
        deliveryDocumentCount: null,
      },
    });
    expect(unknown.output.rows[0]!.produced).toBeNull();
  });

  it('rejects an unknown source label', async () => {
    const s = await validSnapshot();
    expect(() => parseSnapshot({ ...s, source: 'live' })).toThrow(DashboardDataError);
  });
});
