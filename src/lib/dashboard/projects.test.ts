import { describe, expect, it } from 'vitest';
import { buildDashboardSnapshot, countActiveProductionOrders, countOpenSalesOrders, prepareDataset } from './aggregate';
import { PERIODS, type DeliveryNote, type DemoDataset, type ItemRecord, type ProductionReceiptLine, type SalesOrder } from './contracts';
import { generateDemoDataset } from './fixtures/generate';
import { parseInstant } from './periods';
import { ALL_PROJECTS, buildProjectOptions, projectKeyOf, UNASSIGNED_PROJECT } from './projects';
import { toMilli } from './units';
import { parseSnapshot } from './validate';

const REF = '2026-10-14T14:00:00+03:00';
const refMs = parseInstant(REF);
const posted = '2026-10-01T10:00:00+03:00';

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
const ITEMS = [item('HCS', 'HOLLOWCORE'), item('WALL', 'PRECAST'), item('STAIR', 'PRECAST', { nosIsPhysicalCount: true })];
const PROJECTS = [
  { code: 'P1', name: 'First Project' },
  { code: 'P2', name: 'Second Project' },
];

let nextDoc = 1;
function receipt(projectCode: string | null, itemCode: string, quantity: number, uom: string, overrides: Partial<ProductionReceiptLine> = {}): ProductionReceiptLine {
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
    projectCode,
    verifiedElementCount: null,
    ...overrides,
  };
}
function note(lines: [string | null, string, number, string][]): DeliveryNote {
  const docEntry = nextDoc++;
  return {
    docEntry,
    docNum: docEntry,
    postingDate: '2026-10-14',
    documentStatus: 'closed',
    cancelled: false,
    lines: lines.map(([projectCode, itemCode, quantity, uom], lineNum) => ({ lineNum, itemCode, quantity, uom, projectCode, verifiedElementCount: null })),
  };
}
const dataset = (overrides: Partial<DemoDataset>): DemoDataset => ({
  referenceTime: REF,
  items: ITEMS,
  projects: PROJECTS,
  productionReceipts: [],
  componentIssues: [],
  concreteBatches: [],
  deliveryNotes: [],
  salesOrders: [],
  productionOrders: [],
  ...overrides,
});
const snapshotOf = (overrides: Partial<DemoDataset>, project: string = ALL_PROJECTS) =>
  buildDashboardSnapshot(prepareDataset(dataset(overrides)), 'daily', project);

const salesOrder = (docEntry: number, lines: [string | null, number, number][]): SalesOrder => ({
  docEntry,
  docNum: docEntry,
  postedAt: posted,
  customer: 'Demo',
  status: 'open',
  lines: lines.map(([projectCode, orderedQuantity, deliveredQuantity]) => ({ projectCode, orderedQuantity, deliveredQuantity })),
});

describe('project references', () => {
  it('treats missing or blank references as Unassigned', () => {
    expect([null, '', '   '].map(projectKeyOf)).toEqual([UNASSIGNED_PROJECT, UNASSIGNED_PROJECT, UNASSIGNED_PROJECT]);
    expect(projectKeyOf(' P1 ')).toBe('P1');
  });

  it('offers All Projects first, Unassigned last, and keeps a code missing from the master', () => {
    const options = buildProjectOptions(PROJECTS, ['P1', 'ZZ9', UNASSIGNED_PROJECT]);
    expect(options.map((o) => o.key)).toEqual([ALL_PROJECTS, 'P1', 'P2', 'ZZ9', UNASSIGNED_PROJECT]);
    expect(options[3]).toEqual({ key: 'ZZ9', code: 'ZZ9', name: 'Project ZZ9' });
  });

  it('never guesses a project from an item description', () => {
    const items = [item('HCS', 'HOLLOWCORE', { description: 'Slab for First Project P1' })];
    const s = snapshotOf({ items, productionReceipts: [receipt(null, 'HCS', 5, 'm2')] }, 'P1');
    expect(s.output.rows.every((r) => r.produced === 0)).toBe(true);
  });
});

describe('distinct order counts by project', () => {
  const orders = [
    salesOrder(1, [['P1', 10, 0], ['P2', 10, 0]]), // both projects
    salesOrder(2, [['P1', 10, 0], ['P1', 5, 0]]), // one project, two lines
    salesOrder(3, [['P1', 10, 10], ['P2', 10, 0]]), // P1 fully delivered
    salesOrder(4, [[null, 10, 0]]), // no project
  ];

  it('counts a multi-project order once in All Projects and once in each project', () => {
    expect(countOpenSalesOrders(orders, refMs)).toBe(4);
    expect(countOpenSalesOrders(orders, refMs, 'P1')).toBe(2);
    expect(countOpenSalesOrders(orders, refMs, 'P2')).toBe(2);
    expect(countOpenSalesOrders(orders, refMs, UNASSIGNED_PROJECT)).toBe(1);
  });

  it('shows why project counts are not additive', () => {
    const sum = ['P1', 'P2', UNASSIGNED_PROJECT].reduce((total, p) => total + countOpenSalesOrders(orders, refMs, p), 0);
    expect(sum).toBe(5);
    expect(countOpenSalesOrders(orders, refMs)).toBe(4);
  });

  it('scopes production orders and keeps those without a project under Unassigned', () => {
    const order = (docEntry: number, projectCode: string | null) => ({
      docEntry,
      docNum: docEntry,
      createdAt: posted,
      status: 'released' as const,
      plannedQuantity: 10,
      completedQuantity: 1,
      projectCode,
    });
    const orders = [order(1, 'P1'), order(2, 'P1'), order(3, null)];
    expect(countActiveProductionOrders(orders, refMs)).toBe(3);
    expect(countActiveProductionOrders(orders, refMs, 'P1')).toBe(2);
    expect(countActiveProductionOrders(orders, refMs, 'P2')).toBe(0);
    expect(countActiveProductionOrders(orders, refMs, UNASSIGNED_PROJECT)).toBe(1);
  });

  it('counts a multi-project delivery note once in each view', () => {
    const notes = [note([['P1', 'HCS', 5, 'm2'], ['P2', 'HCS', 7, 'm2']])];
    expect(snapshotOf({ deliveryNotes: notes }).output.deliveryDocumentCount).toBe(1);
    expect(snapshotOf({ deliveryNotes: notes }, 'P1').output.deliveryDocumentCount).toBe(1);
    expect(snapshotOf({ deliveryNotes: notes }, 'P2').output.deliveryDocumentCount).toBe(1);
  });
});

describe('quantities by project', () => {
  const records = {
    productionReceipts: [
      receipt('P1', 'WALL', 12.5, 'm3'),
      receipt('P1', 'STAIR', 3, 'Nos'),
      receipt('P2', 'HCS', 40, 'm2'),
      receipt(null, 'HCS', 6, 'm2'),
      receipt('P2', 'HCS', 99, 'm2', { cancelled: true }),
    ],
    deliveryNotes: [note([['P1', 'WALL', 2, 'm3'], ['P2', 'HCS', 10, 'm2'], [null, 'WALL', 1, 'm3']])],
  };

  it('splits one note line by line, and keeps unassigned quantities visible', () => {
    const value = (project: string, key: string) => snapshotOf(records, project).output.rows.find((r) => r.key === key)!;
    expect(value('P1', 'precast:m3')).toMatchObject({ produced: 12.5, delivered: 2 });
    expect(value('P1', 'precast:pieces')).toMatchObject({ produced: 3 });
    expect(value('P2', 'hollowcore:m2')).toMatchObject({ produced: 40, delivered: 10 });
    expect(value(UNASSIGNED_PROJECT, 'hollowcore:m2')).toMatchObject({ produced: 6 });
    expect(value(UNASSIGNED_PROJECT, 'precast:m3')).toMatchObject({ delivered: 1 });
    expect(value(ALL_PROJECTS, 'hollowcore:m2')).toMatchObject({ produced: 46 });
  });

  it('keeps mixed units on separate summary rows, never added', () => {
    const rows = snapshotOf(records, 'P1').projectSummary;
    expect(rows.map((r) => [r.rowKey, r.produced, r.delivered])).toEqual([
      ['precast:m3', 12.5, 2],
      ['precast:pieces', 3, 0],
    ]);
  });

  it('lists every project in All Projects, with Unassigned last', () => {
    const keys = snapshotOf(records).projectSummary.map((r) => r.projectKey);
    expect([...new Set(keys)]).toEqual(['P1', 'P2', UNASSIGNED_PROJECT]);
  });

  it('shows only the selected project in its summary, and an empty summary when idle', () => {
    expect(new Set(snapshotOf(records, 'P2').projectSummary.map((r) => r.projectKey))).toEqual(new Set(['P2']));
    expect(snapshotOf({}, 'P1').projectSummary).toEqual([]);
  });

  it('never scopes concrete, which has no project reference', () => {
    const concreteBatches = [{ id: 'b', producedAt: '2026-10-14T08:00:00+03:00', grade: 'C40', volumeM3: 25, productionOrderId: 'PO' }];
    for (const project of [ALL_PROJECTS, 'P1', UNASSIGNED_PROJECT]) {
      expect(snapshotOf({ concreteBatches }, project).concrete).toMatchObject({ scope: 'all-projects', periodOutput: 25 });
    }
  });

  it('rejects a summary that does not add up to the cards', () => {
    const s = snapshotOf(records);
    const bad = { ...s, source: 'demo', fetchedAt: REF, projectSummary: s.projectSummary.slice(1) };
    expect(() => parseSnapshot(bad)).toThrow(/failed validation/);
  });
});

describe('verified subtype and element count (prepared for later)', () => {
  it('keeps Precast split by unit alone, with no element count, until verified', () => {
    const s = snapshotOf({ productionReceipts: [receipt('P1', 'WALL', 12.5, 'm3'), receipt('P1', 'WALL', 4, 'm3')] });
    const row = s.output.rows.find((r) => r.key === 'precast:m3')!;
    expect(row.subtype).toBeNull();
    expect(row.producedElementCount).toBeNull(); // not 2 transaction lines, not derived from 16.5 m³
  });

  it('gives a verified subtype its own row, separate from the plain product', () => {
    const items = [...ITEMS, item('BEAM', 'PRECAST', { verifiedSubtype: 'Beam' })];
    const s = snapshotOf({ items, productionReceipts: [receipt('P1', 'BEAM', 3, 'm3'), receipt('P1', 'WALL', 5, 'm3')] });
    expect(s.output.rows.find((r) => r.key === 'precast/Beam:m3')).toMatchObject({ subtype: 'Beam', produced: 3 });
    expect(s.output.rows.find((r) => r.key === 'precast:m3')).toMatchObject({ subtype: null, produced: 5 });
    expect(() => parseSnapshot({ ...s, source: 'demo', fetchedAt: REF })).not.toThrow();
  });

  it('reports an element count only when every record carries a verified count', () => {
    const verified = (count: number | null) => receipt('P1', 'WALL', 5, 'm3', { verifiedElementCount: count });
    const countOf = (lines: ProductionReceiptLine[]) => snapshotOf({ productionReceipts: lines }).output.rows.find((r) => r.key === 'precast:m3')!.producedElementCount;
    expect(countOf([verified(4), verified(6)])).toBe(10);
    expect(countOf([verified(4), verified(null)])).toBeNull();
  });
});

describe('demo dataset by project', () => {
  const raw = generateDemoDataset();
  const data = prepareDataset(raw);
  const projectKeys = data.projectOptions.map((o) => o.key).filter((k) => k !== ALL_PROJECTS);

  it('marks fixture projects DEMO and includes unassigned and multi-project records', () => {
    expect(raw.projects.every((p) => p.code.startsWith('DEMO-'))).toBe(true);
    expect(raw.productionReceipts.some((r) => r.projectCode === null)).toBe(true);
    expect(raw.salesOrders.some((o) => new Set(o.lines.map((l) => l.projectCode)).size > 1)).toBe(true);
  });

  it.each(PERIODS)('reconciles cards, chart and project summary across every project (%s)', (period) => {
    const all = buildDashboardSnapshot(data, period);
    const projects = projectKeys.map((p) => buildDashboardSnapshot(data, period, p));

    for (const row of all.output.rows) {
      const across = (field: 'produced' | 'delivered') =>
        projects.reduce((sum, s) => sum + toMilli(s.output.rows.find((r) => r.key === row.key)?.[field] ?? 0), 0);
      expect(across('produced')).toBe(toMilli(row.produced!));
      expect(across('delivered')).toBe(toMilli(row.delivered!));
    }
    for (const s of [all, ...projects]) {
      expect(() => parseSnapshot({ ...s, source: 'demo', fetchedAt: REF })).not.toThrow();
      s.output.rows.forEach((row, i) => expect(s.output.productionSeries[i]!.total).toBe(row.produced));
    }
  });

  it('keeps order counts unchanged across periods within a project', () => {
    const counts = PERIODS.map((p) => buildDashboardSnapshot(data, p, 'DEMO-P01').orders.openSalesOrders);
    expect(new Set(counts).size).toBe(1);
  });

  it('has a project with no records for a product, for the no-production state', () => {
    const s = buildDashboardSnapshot(data, 'yearly', 'DEMO-P02');
    expect(s.output.rows.find((r) => r.key === 'hollowcore:m2')!.produced).toBe(0);
  });
});
