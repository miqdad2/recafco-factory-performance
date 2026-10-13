import { describe, expect, it } from 'vitest';
import { DashboardDataError } from '../errors';
import { generateDemoDataset } from '../fixtures/generate';
import { parseSnapshot } from '../validate';
import { createDemoProvider } from './demo';

const FIXED_NOW = Date.parse('2026-11-02T09:30:00Z');

async function validSnapshot() {
  return createDemoProvider({ delayMs: 0, now: () => FIXED_NOW }).getSnapshot({ period: 'daily' });
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
      expect((await provider.getSnapshot({ period })).selectedPeriod).toBe(period);
    }
  });

  it('waits for the simulated delay and can be cancelled', async () => {
    const controller = new AbortController();
    const pending = createDemoProvider({ delayMs: 5_000 }).getSnapshot({ period: 'daily' }, controller.signal);
    controller.abort();
    await expectCode(pending, 'aborted');
  });

  it('rejects an already-cancelled request', async () => {
    const controller = new AbortController();
    controller.abort();
    await expectCode(createDemoProvider({ delayMs: 0 }).getSnapshot({ period: 'daily' }, controller.signal), 'aborted');
  });

  it('rejects invalid source records with a typed error', async () => {
    const broken = generateDemoDataset();
    broken.concreteBatches[0] = { ...broken.concreteBatches[0]!, volumeM3: -3 };
    const error = await expectCode(
      createDemoProvider({ delayMs: 0, loadDataset: () => broken }).getSnapshot({ period: 'daily' }),
      'invalid-source-data',
    );
    expect(error.issues[0]).toContain('concreteBatches.0.volumeM3');
  });

  it('rejects fractional, zero or uncategorised element records', async () => {
    for (const change of [{ pieces: 2.5 }, { pieces: 0 }, { productCategory: 'concrete' }]) {
      const broken = generateDemoDataset();
      broken.elementRecords[0] = { ...broken.elementRecords[0]!, ...change } as (typeof broken.elementRecords)[number];
      const error = await expectCode(
        createDemoProvider({ delayMs: 0, loadDataset: () => broken }).getSnapshot({ period: 'daily' }),
        'invalid-source-data',
      );
      expect(error.issues[0]).toContain('elementRecords.0');
    }
  });

  it('rejects source records with an invalid timestamp', async () => {
    const broken = { ...generateDemoDataset(), referenceTime: 'yesterday' };
    await expectCode(createDemoProvider({ delayMs: 0, loadDataset: () => broken }).getSnapshot({ period: 'daily' }), 'invalid-source-data');
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

  it('rejects fractional produced-element counts', async () => {
    const s = await validSnapshot();
    const elements = s.output.elements;
    const fractionalTotal = { ...s, output: { ...s.output, elements: { ...elements, total: elements.total + 0.5 } } };
    expect(() => parseSnapshot(fractionalTotal)).toThrow(DashboardDataError);
    const fractionalBucket = {
      ...s,
      output: { ...s.output, elements: { ...elements, trend: elements.trend.map((b, i) => (i === 0 ? { ...b, pieces: 1.5 } : b)) } },
    };
    expect(() => parseSnapshot(fractionalBucket)).toThrow(DashboardDataError);
  });

  it('rejects a trend or product breakdown that does not add up to the total', async () => {
    const s = await validSnapshot();
    const elements = s.output.elements;
    const badTotal = { ...s, output: { ...s.output, elements: { ...elements, total: elements.total + 1 } } };
    try {
      parseSnapshot(badTotal);
      expect.unreachable();
    } catch (error) {
      expect((error as DashboardDataError).code).toBe('invalid-response');
      const issues = (error as DashboardDataError).issues.join(' ');
      expect(issues).toMatch(/Trend does not add up/);
      expect(issues).toMatch(/Products do not add up/);
    }
  });

  it('rejects a product listed twice, which would double-count elements', async () => {
    const s = await validSnapshot();
    const elements = s.output.elements;
    const [first, second] = elements.products;
    // Same total, but Hollowcore appears twice and Precast is missing.
    const doubled = [first!, { category: first!.category, pieces: second!.pieces }, ...elements.products.slice(2)];
    const bad = { ...s, output: { ...s.output, elements: { ...elements, products: doubled } } };
    expect(() => parseSnapshot(bad)).toThrow(/failed validation/);
  });

  it('rejects a capacity percentage without a known capacity', async () => {
    const s = await validSnapshot();
    expect(() => parseSnapshot({ ...s, capacity: { ...s.capacity, plannedCapacity: null } })).toThrow(DashboardDataError);
  });

  it('rejects an unknown source label', async () => {
    const s = await validSnapshot();
    expect(() => parseSnapshot({ ...s, source: 'live' })).toThrow(DashboardDataError);
  });
});
