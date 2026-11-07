import { describe, expect, it } from 'vitest';
import {
  aggregateByBuckets,
  aggregateOutput,
  buildDashboardSnapshot,
  concreteOutput,
  countActiveProductionOrders,
  countOpenSalesOrders,
  prepareConcrete,
  prepareDataset,
  prepareDeliveries,
  prepareReceipts,
} from './aggregate';
import type { DeliveryNote, DemoDataset, ItemRecord, ProductionOrder, ProductionReceiptLine, QuantityRow, SalesOrder } from './contracts';
import { getPeriodWindow, parseInstant } from './periods';
import { parseSnapshot } from './validate';

const REF = '2026-10-14T14:00:00+03:00';
const refMs = parseInstant(REF);
const day = getPeriodWindow('daily', refMs);
const farFuture = parseInstant('2030-01-01T00:00:00+03:00');

const item = (itemCode: string, itemGroup: string, overrides: Partial<ItemRecord> = {}): ItemRecord => ({
  itemCode,
  description: itemCode,
  itemGroup,
  inventoryItem: true,
  finishedGoodsFlag: true,
  nosIsPhysicalCount: false,
  verifiedSubtype: null,
  ...overrides,
});

const ITEMS = [
  item('HCS', 'HOLLOWCORE'),
  item('WALL', 'PRECAST'),
  item('STAIR', 'PRECAST', { nosIsPhysicalCount: true }),
  item('GRC', 'GRC'),
  item('CEMENT', 'RAW-MATERIAL'),
  item('CAGE', 'STEEL-SEMI'),
  item('ADJ', 'BILLING-ADJ', { inventoryItem: false }),
];

let nextDoc = 1;
function receipt(itemCode: string, quantity: number, uom: string, overrides: Partial<ProductionReceiptLine> = {}): ProductionReceiptLine {
  const docEntry = nextDoc++;
  return {
    docEntry,
    docNum: docEntry,
    lineNum: 0,
    postingDate: '2026-10-14',
    recordedAt: '2026-10-14T08:00:00+03:00',
    cancelled: false,
    itemCode,
    quantity,
    uom,
    productionOrderEntry: 1,
    orderCumulativeCompleted: quantity,
    projectCode: null,
    verifiedElementCount: null,
    ...overrides,
  };
}

function note(lines: [string, number, string][], overrides: Partial<DeliveryNote> = {}): DeliveryNote {
  const docEntry = nextDoc++;
  return {
    docEntry,
    docNum: docEntry,
    postingDate: '2026-10-14',
    documentStatus: 'closed',
    cancelled: false,
    lines: lines.map(([itemCode, quantity, uom], lineNum) => ({ lineNum, itemCode, quantity, uom, projectCode: null, verifiedElementCount: null })),
    ...overrides,
  };
}

function dataset(overrides: Partial<DemoDataset> = {}): DemoDataset {
  return {
    referenceTime: REF,
    items: ITEMS,
    projects: [],
    productionReceipts: [],
    componentIssues: [],
    concreteBatches: [],
    deliveryNotes: [],
    salesOrders: [],
    productionOrders: [],
    ...overrides,
  };
}

const batch = (id: string, producedAt: string, volumeM3: number) => ({ id, producedAt, grade: 'C40', volumeM3, productionOrderId: 'PO-1' });

const snapshotOf = (overrides: Partial<DemoDataset>, period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily') =>
  buildDashboardSnapshot(prepareDataset(dataset(overrides)), period);

const row = (rows: QuantityRow[], key: string) => rows.find((r) => r.key === key);

describe('range boundaries', () => {
  it('includes a receipt exactly at the range start and excludes one exactly at the range end', () => {
    const records = prepareReceipts(
      [
        receipt('HCS', 2, 'm2', { recordedAt: '2026-10-14T00:00:00+03:00' }),
        receipt('HCS', 5, 'm2', { recordedAt: '2026-10-15T00:00:00+03:00', postingDate: '2026-10-15' }),
        receipt('HCS', 7, 'm2', { recordedAt: '2026-10-13T23:59:59+03:00', postingDate: '2026-10-13' }),
      ],
      ITEMS,
    );
    const result = aggregateByBuckets(records, day, farFuture);
    expect(result.total).toBe(2000);
    expect(result.buckets[0]!.amount).toBe(2000);
  });

  it('excludes timed receipts at or after the as-of time', () => {
    const records = prepareReceipts(
      [
        receipt('HCS', 3, 'm2', { recordedAt: '2026-10-14T13:59:59+03:00' }),
        receipt('HCS', 4, 'm2', { recordedAt: '2026-10-14T14:00:00+03:00' }),
      ],
      ITEMS,
    );
    expect(aggregateByBuckets(records, day, refMs).total).toBe(3000);
  });

  it('places deliveries by business date in the same half-open window', () => {
    const notes = prepareDeliveries(
      [note([['HCS', 4, 'm2']]), note([['HCS', 9, 'm2']], { postingDate: '2026-10-15' }), note([['HCS', 8, 'm2']], { postingDate: '2026-10-13' })],
      ITEMS,
    );
    const { rows, deliveryDocumentCount } = aggregateOutput({ receipts: [], deliveries: notes, projectOptions: [] }, day, farFuture).output;
    expect(row(rows, 'hollowcore:m2')!.delivered).toBe(4);
    expect(deliveryDocumentCount).toBe(1);
  });
});

describe('unit separation', () => {
  const s = snapshotOf({
    productionReceipts: [
      receipt('WALL', 12.5, 'm3'),
      receipt('STAIR', 3, 'Nos'),
      receipt('WALL', 7, 'm2'),
      receipt('HCS', 100, 'm2'),
    ],
  });

  it('groups by product AND unit and never adds unlike units', () => {
    const { rows } = s.output;
    expect(row(rows, 'precast:m3')!.produced).toBe(12.5);
    expect(row(rows, 'precast:pieces')!.produced).toBe(3);
    expect(row(rows, 'precast:m2')!.produced).toBe(7); // extra row, not assumed from the category
    expect(row(rows, 'hollowcore:m2')!.produced).toBe(100);
  });

  it('keeps one shared row order, products first and then units', () => {
    expect(s.output.rows.map((r) => r.key)).toEqual(['hollowcore:m2', 'precast:m2', 'precast:m3', 'precast:pieces', 'grc:m2']);
  });

  it('keeps zero rows listed so the screen stays stable', () => {
    expect(row(snapshotOf({}).output.rows, 'grc:m2')).toMatchObject({ produced: 0, delivered: 0 });
  });

  it('keeps unmapped products and unknown units as separate visible rows', () => {
    const { rows } = snapshotOf({
      productionReceipts: [receipt('MYSTERY', 5, 'm2'), receipt('HCS', 3, 'LM'), receipt('HCS', 4, 'KG'), receipt('HCS', 9, 'm2')],
    }).output;
    expect(row(rows, 'unmapped:m2')!.produced).toBe(5);
    expect(row(rows, 'hollowcore:raw:LM')!.produced).toBe(3);
    expect(row(rows, 'hollowcore:raw:KG')!.produced).toBe(4);
    expect(row(rows, 'hollowcore:m2')!.produced).toBe(9);
    expect(rows.at(-1)!.product).toBe('unmapped');
  });

  it('does not call unverified Nos pieces', () => {
    const { rows } = snapshotOf({ productionReceipts: [receipt('WALL', 6, 'Nos')] }).output;
    expect(row(rows, 'precast:nos')!.produced).toBe(6);
    expect(row(rows, 'precast:pieces')!.produced).toBe(0);
  });

  it('sums decimals exactly', () => {
    const { rows } = snapshotOf({ productionReceipts: [receipt('HCS', 0.1, 'm2'), receipt('HCS', 0.2, 'm2')] }).output;
    expect(row(rows, 'hollowcore:m2')!.produced).toBe(0.3);
  });
});

describe('production quantities', () => {
  it('sums transaction quantities, not repeated cumulative completed quantities', () => {
    const lines = [
      receipt('HCS', 10, 'm2', { productionOrderEntry: 7, orderCumulativeCompleted: 10, recordedAt: '2026-10-14T08:00:00+03:00' }),
      receipt('HCS', 15, 'm2', { productionOrderEntry: 7, orderCumulativeCompleted: 25, recordedAt: '2026-10-14T09:00:00+03:00' }),
      receipt('HCS', 5, 'm2', { productionOrderEntry: 7, orderCumulativeCompleted: 30, recordedAt: '2026-10-14T10:00:00+03:00' }),
    ];
    const { rows } = snapshotOf({ productionReceipts: lines }).output;
    expect(row(rows, 'hollowcore:m2')!.produced).toBe(30); // not 65
  });

  it('counts a repeated receipt line once and ignores cancelled receipts', () => {
    const line = receipt('HCS', 10, 'm2');
    const { rows } = snapshotOf({ productionReceipts: [line, { ...line }, receipt('HCS', 99, 'm2', { cancelled: true })] }).output;
    expect(row(rows, 'hollowcore:m2')!.produced).toBe(10);
  });

  it('excludes raw material and semi-finished receipts even when flagged Finished Goods', () => {
    const { rows } = snapshotOf({ productionReceipts: [receipt('CEMENT', 40, 'm3'), receipt('CAGE', 9, 'Nos')] }).output;
    expect(rows.every((r) => r.produced === 0)).toBe(true);
  });

  it('never feeds element quantities from batching-plant concrete', () => {
    const { rows } = snapshotOf({ concreteBatches: [batch('b', '2026-10-14T08:00:00+03:00', 300)] }).output;
    expect(row(rows, 'precast:m3')!.produced).toBe(0);
  });
});

describe('deliveries', () => {
  it('counts Open delivery documents and excludes only cancelled ones', () => {
    const { rows, deliveryDocumentCount } = snapshotOf({
      deliveryNotes: [
        note([['HCS', 10, 'm2']], { documentStatus: 'open' }),
        note([['HCS', 20, 'm2']], { documentStatus: 'closed' }),
        note([['HCS', 40, 'm2']], { documentStatus: 'open', cancelled: true }),
      ],
    }).output;
    expect(row(rows, 'hollowcore:m2')!.delivered).toBe(30);
    expect(deliveryDocumentCount).toBe(2);
  });

  it('keeps quantities separate from the document count and drops billing lines', () => {
    const multi = note([['HCS', 6, 'm2'], ['WALL', 4, 'm3'], ['ADJ', 1, 'Nos']]);
    const billingOnly = note([['ADJ', 500, 'Nos']]);
    const { rows, deliveryDocumentCount } = snapshotOf({ deliveryNotes: [multi, { ...multi }, billingOnly] }).output;
    expect(row(rows, 'hollowcore:m2')!.delivered).toBe(6);
    expect(row(rows, 'precast:m3')!.delivered).toBe(4);
    expect(deliveryDocumentCount).toBe(1);
  });

  it('never derives deliveries from production', () => {
    const { rows, deliveryDocumentCount } = snapshotOf({ productionReceipts: [receipt('HCS', 9, 'm2')] }).output;
    expect(row(rows, 'hollowcore:m2')).toMatchObject({ produced: 9, delivered: 0 });
    expect(deliveryDocumentCount).toBe(0);
  });

  it('lists a product delivered but not produced in the period', () => {
    const { rows } = snapshotOf({ deliveryNotes: [note([['WALL', 2, 'm2']])] }).output;
    expect(row(rows, 'precast:m2')).toMatchObject({ produced: 0, delivered: 2 });
  });
});

describe('date-only versus timestamped production', () => {
  const dateOnly = (quantity: number) => receipt('GRC', quantity, 'm2', { recordedAt: null });

  it('shows hours only when every record of the row has a reliable time', () => {
    const series = snapshotOf({ productionReceipts: [receipt('HCS', 5, 'm2', { recordedAt: '2026-10-14T09:10:00+03:00' })] }).output
      .productionSeries[0]!;
    expect(series).toMatchObject({ granularity: 'hour', hourlyDetail: 'available' });
    expect(series.trend).toHaveLength(24);
    expect(series.trend[9]!.quantity).toBe(5);
  });

  it('gives a date-only Daily row one day total and invents no midnight output', () => {
    const series = snapshotOf({ productionReceipts: [dateOnly(4), dateOnly(6)] }).output.productionSeries.find((s) => s.key === 'grc:m2')!;
    expect(series).toMatchObject({ granularity: 'day', hourlyDetail: 'unavailable', total: 10 });
    expect(series.trend).toEqual([{ start: '2026-10-14T00:00:00+03:00', end: '2026-10-15T00:00:00+03:00', quantity: 10 }]);
  });

  it('falls back to the day total when timed and date-only records mix', () => {
    const series = snapshotOf({ productionReceipts: [dateOnly(4), receipt('GRC', 6, 'm2')] }).output.productionSeries.find((s) => s.key === 'grc:m2')!;
    expect(series.hourlyDetail).toBe('unavailable');
    expect(series.total).toBe(10);
  });

  it('does not trust a time that falls outside the posting date', () => {
    const series = snapshotOf({
      productionReceipts: [receipt('GRC', 6, 'm2', { postingDate: '2026-10-14', recordedAt: '2026-10-12T22:00:00+03:00' })],
    }).output.productionSeries.find((s) => s.key === 'grc:m2')!;
    expect(series).toMatchObject({ hourlyDetail: 'unavailable', total: 6 });
  });

  it('uses daily bars for date-only records in longer periods', () => {
    const series = snapshotOf({ productionReceipts: [dateOnly(4)] }, 'weekly').output.productionSeries.find((s) => s.key === 'grc:m2')!;
    expect(series).toMatchObject({ granularity: 'day', hourlyDetail: 'not-applicable' });
    expect(series.trend[3]!.quantity).toBe(4); // Wednesday
  });
});

describe('future intervals versus elapsed zero production', () => {
  it('marks buckets from the as-of hour onward as null and elapsed empty hours as 0', () => {
    const records = prepareReceipts([receipt('HCS', 5, 'm2', { recordedAt: '2026-10-14T09:10:00+03:00' })], ITEMS);
    const { buckets } = aggregateByBuckets(records, day, refMs);
    expect(buckets[3]!.amount).toBe(0);
    expect(buckets[9]!.amount).toBe(5000);
    expect(buckets[13]!.amount).toBe(0);
    expect(buckets.slice(14).every((b) => b.amount === null)).toBe(true);
  });

  it('keeps the partly elapsed bucket as a number in longer periods', () => {
    const { buckets } = aggregateByBuckets([], getPeriodWindow('yearly', refMs), refMs);
    expect(buckets[9]!.amount).toBe(0);
    expect(buckets[10]!.amount).toBeNull();
  });
});

describe('chart, card and table reconciliation', () => {
  it.each(['daily', 'weekly', 'monthly', 'yearly'] as const)('every series equals its row exactly (%s)', (period) => {
    const s = snapshotOf(
      {
        productionReceipts: [receipt('HCS', 0.1, 'm2'), receipt('HCS', 0.2, 'm2'), receipt('STAIR', 2, 'Nos'), receipt('GRC', 1.005, 'm2', { recordedAt: null })],
      },
      period,
    );
    expect(s.output.productionSeries.map((p) => p.key)).toEqual(s.output.rows.map((r) => r.key));
    s.output.rows.forEach((r, i) => expect(s.output.productionSeries[i]!.total).toBe(r.produced));
    expect(() => parseSnapshot({ ...s, source: 'demo', fetchedAt: REF })).not.toThrow();
  });
});

describe('order snapshot rules', () => {
  const posted = '2026-10-01T10:00:00+03:00';
  const salesOrder = (docEntry: number, overrides: Partial<SalesOrder> = {}): SalesOrder => ({
    docEntry,
    docNum: docEntry,
    postedAt: posted,
    customer: 'Demo',
    status: 'open',
    lines: [{ orderedQuantity: 10, deliveredQuantity: 4, projectCode: null }],
    ...overrides,
  });
  const productionOrder = (docEntry: number, overrides: Partial<ProductionOrder> = {}): ProductionOrder => ({
    docEntry,
    docNum: docEntry,
    createdAt: posted,
    status: 'released',
    plannedQuantity: 20,
    completedQuantity: 5,
    projectCode: null,
    ...overrides,
  });

  it('counts open sales orders with a remaining quantity only', () => {
    const orders = [
      salesOrder(1),
      salesOrder(2, { lines: [{ orderedQuantity: 10, deliveredQuantity: 10, projectCode: null }] }),
      salesOrder(3, { status: 'cancelled' }),
      salesOrder(4, { status: 'closed' }),
      salesOrder(5, { postedAt: REF }),
    ];
    expect(countOpenSalesOrders(orders, refMs)).toBe(1);
  });

  it('counts orders, not lines', () => {
    const lines = Array.from({ length: 5 }, () => ({ orderedQuantity: 10, deliveredQuantity: 0, projectCode: null }));
    expect(countOpenSalesOrders([salesOrder(1, { lines })], refMs)).toBe(1);
    expect(countOpenSalesOrders([salesOrder(1), salesOrder(1)], refMs)).toBe(1);
  });

  it('uses internal identity, so equal displayed numbers in two series stay two orders', () => {
    expect(countOpenSalesOrders([salesOrder(1, { docNum: 500 }), salesOrder(2, { docNum: 500 })], refMs)).toBe(2);
    expect(countActiveProductionOrders([productionOrder(1, { docNum: 500 }), productionOrder(2, { docNum: 500 })], refMs)).toBe(2);
  });

  it('excludes fully produced orders even while still released', () => {
    const orders = [
      productionOrder(1),
      productionOrder(2, { completedQuantity: 20 }),
      productionOrder(3, { completedQuantity: 25 }),
      productionOrder(4, { status: 'planned' }),
      productionOrder(5, { status: 'closed' }),
      productionOrder(6, { status: 'cancelled' }),
      productionOrder(7, { createdAt: REF }),
    ];
    expect(countActiveProductionOrders(orders, refMs)).toBe(1);
  });
});

describe('concrete output', () => {
  const concrete = [
    batch('sep', '2026-09-30T23:59:00+03:00', 50),
    batch('oct', '2026-10-01T00:00:00+03:00', 20),
    batch('day', '2026-10-14T08:00:00+03:00', 5),
  ];

  it('follows the selected period while month-to-date stays the reference month', () => {
    const data = prepareDataset(dataset({ concreteBatches: concrete }));
    const figures = (['daily', 'monthly', 'yearly'] as const).map((p) => buildDashboardSnapshot(data, p).concrete);
    expect(figures.map((c) => c.periodOutput)).toEqual([5, 25, 75]);
    expect(figures.every((c) => c.monthToDate === 25 && c.month === '2026-10' && c.unit === 'm3')).toBe(true);
    expect(figures.every((c) => c.monthToDateThrough === "2026-10-14T14:00:00+03:00")).toBe(true);
  });

  it('sums three-decimal volumes exactly', () => {
    const records = prepareConcrete([batch('a', '2026-10-01T08:00:00+03:00', 0.1), batch('b', '2026-10-01T09:00:00+03:00', 0.2)]);
    expect(concreteOutput(records, getPeriodWindow('monthly', refMs), refMs).periodOutput).toBe(0.3);
  });

  it('reports unknown, not zero, when no concrete source exists', () => {
    expect(snapshotOf({ concreteBatches: null }).concrete).toMatchObject({ periodOutput: null, monthToDate: null });
  });
});
