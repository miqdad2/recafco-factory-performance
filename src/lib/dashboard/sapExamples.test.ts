/**
 * Regression cases from SAP screenshots supplied by RECAFCO (A–D in
 * docs/data-definitions.md). Only the fields the screenshots show are taken as fact;
 * anything else needed to build a record is marked "assumed". These records stay in
 * this test and are never part of the demo dataset.
 */
import { describe, expect, it } from 'vitest';
import { buildDashboardSnapshot, countActiveProductionOrders, prepareDataset } from './aggregate';
import type { DemoDataset, ItemRecord, ProductionOrder, ProductionReceiptLine } from './contracts';
import { parseInstant } from './periods';
import { ALL_PROJECTS } from './projects';
import { parseDemoDataset } from './validate';

/** Assumed: an evening after the receipt's posting date. */
const AS_OF = '2026-10-24T18:00:00+03:00';
const asOfMs = parseInstant(AS_OF);

const item = (itemCode: string, itemGroup: string, overrides: Partial<ItemRecord> = {}): ItemRecord => ({
  itemCode,
  description: itemCode,
  itemGroup,
  inventoryItem: true,
  finishedGoodsFlag: false,
  nosIsPhysicalCount: false,
  verifiedSubtype: null,
  ...overrides,
});

/** Eligibility is an explicit mapping; the screenshots show these are finished elements counted in Nos. */
const BEAM_PB_103 = item('Beam-PB-103 - 24/22', 'PRECAST', { nosIsPhysicalCount: true });
const BEAM_92_25 = item('Beam - 92/25-PRODUCTION', 'PRECAST');
const JOINT_PIT = item('Straight Joint Pit - 61/26', 'PRECAST', { nosIsPhysicalCount: true });
const CONCRETE = item('Concrete (component)', 'RAW-MATERIAL'); // assumed code and group
const STEEL = item('Steel reinforcement (example)', 'STEEL-SEMI'); // assumed code and group

const order = (overrides: Partial<ProductionOrder> & Pick<ProductionOrder, 'docEntry'>): ProductionOrder => ({
  docNum: overrides.docEntry,
  createdAt: '2026-09-01T08:00:00+03:00', // assumed
  status: 'released',
  plannedQuantity: 1,
  completedQuantity: 0,
  projectCode: null,
  ...overrides,
});

/** C. Receipt from Production 26301288. */
const receiptC: ProductionReceiptLine = {
  docEntry: 26301288,
  docNum: 26301288,
  lineNum: 0,
  postingDate: '2026-10-24',
  recordedAt: null, // the screenshot shows a posting date only
  cancelled: false,
  itemCode: JOINT_PIT.itemCode,
  quantity: 1,
  uom: 'Nos',
  productionOrderEntry: 26303249,
  orderCumulativeCompleted: 5, // planned and completed both show 5 on the order
  projectCode: 'PC/61-26/80067/017',
  verifiedElementCount: null,
};

const orders = {
  /** A. Closed beam order, 1 Nos planned and completed. */
  a: order({ docEntry: 1, status: 'closed', plannedQuantity: 1, completedQuantity: 1 }), // order number assumed
  /** B. Released beam order in m³; order-level, not daily production. */
  b: order({ docEntry: 25303757, plannedQuantity: 1195.405, completedQuantity: 1189.297, projectCode: 'PC/92-25/80117/417' }),
  /** C. The receipt's order; status not shown, so assumed released. */
  c: order({ docEntry: 26303249, plannedQuantity: 5, completedQuantity: 5, projectCode: 'PC/61-26/80067/017' }),
};

function dataset(overrides: Partial<DemoDataset> = {}): DemoDataset {
  return parseDemoDataset({
    referenceTime: AS_OF,
    items: [BEAM_PB_103, BEAM_92_25, JOINT_PIT, CONCRETE, STEEL],
    projects: [],
    productionReceipts: [receiptC],
    componentIssues: [
      // A. 3.88 m³ of concrete issued as a component of the beam order.
      { docEntry: 2, lineNum: 0, postingDate: '2026-10-22', itemCode: CONCRETE.itemCode, quantity: 3.88, uom: 'M3', productionOrderEntry: 1, projectCode: null },
    ],
    concreteBatches: [],
    deliveryNotes: [],
    salesOrders: [],
    productionOrders: Object.values(orders),
    ...overrides,
  });
}

const rowsOf = (data: DemoDataset, period: 'daily' | 'monthly' = 'daily', project: string = ALL_PROJECTS) =>
  buildDashboardSnapshot(prepareDataset(data), period, project).output.rows;
const row = (rows: ReturnType<typeof rowsOf>, key: string) => rows.find((r) => r.key === key);

describe('A. closed beam order with a concrete component', () => {
  it('never counts issued concrete as finished precast output', () => {
    const rows = rowsOf(dataset(), 'monthly');
    expect(row(rows, 'precast:m3')!.produced).toBe(0); // not 3.88
    expect(rows.some((r) => r.produced === 3.88)).toBe(false);
  });

  it('is not active once closed', () => {
    expect(countActiveProductionOrders([orders.a], asOfMs)).toBe(0);
  });
});

describe('B. released beam order measured in m³', () => {
  it('is active while 6.108 m³ remain', () => {
    expect(countActiveProductionOrders([orders.b], asOfMs)).toBe(1);
    expect(countActiveProductionOrders([orders.b], asOfMs, 'PC/92-25/80117/417')).toBe(1);
  });

  it('adds nothing to period production: order totals are not daily output', () => {
    const rows = rowsOf(dataset({ productionReceipts: [] }), 'monthly');
    expect(row(rows, 'precast:m3')!.produced).toBe(0); // not 1,189.297
  });
});

describe('C. Receipt from Production 26301288', () => {
  it('adds 1 piece to its posting date, not the order total of 5', () => {
    expect(row(rowsOf(dataset()), 'precast:pieces')!.produced).toBe(1);
  });

  it('belongs to its recorded project, which stays visible though missing from the project master', () => {
    const snapshot = buildDashboardSnapshot(prepareDataset(dataset()), 'daily', 'PC/61-26/80067/017');
    expect(snapshot.selectedProject).toEqual({ key: 'PC/61-26/80067/017', code: 'PC/61-26/80067/017', name: 'Project PC/61-26/80067/017' });
    expect(row(snapshot.output.rows, 'precast:pieces')!.produced).toBe(1);
  });

  it('is date-only, so Daily shows the day total without inventing an hour', () => {
    const series = buildDashboardSnapshot(prepareDataset(dataset()), 'daily').output.productionSeries.find((s) => s.key === 'precast:pieces')!;
    expect(series).toMatchObject({ hourlyDetail: 'unavailable', total: 1 });
  });

  it('leaves its fully completed order out of Active Production Orders', () => {
    expect(countActiveProductionOrders([orders.c], asOfMs)).toBe(0);
  });

  it('is shown as a data-quality issue, not a finished product, if the item has no mapping', () => {
    const rows = rowsOf(dataset({ items: [] }));
    expect(row(rows, 'precast:pieces')!.produced).toBe(0);
    expect(row(rows, 'unmapped:nos')!.produced).toBe(1);
  });

  it('is never classified from its description', () => {
    const rows = rowsOf(dataset({ items: [item(JOINT_PIT.itemCode, 'NEW-GROUP', { description: 'Precast Straight Joint Pit' })] }));
    expect(row(rows, 'unmapped:nos')!.produced).toBe(1);
  });
});

describe('D. steel reinforcement receipts', () => {
  const steel = (quantity: number): ProductionReceiptLine => ({ ...receiptC, docEntry: 99, docNum: 99, itemCode: STEEL.itemCode, quantity, projectCode: null });

  it('are not finished elements, though they are production receipts in Nos', () => {
    const rows = rowsOf(dataset({ productionReceipts: [steel(12)] }));
    expect(rows.every((r) => r.produced === 0)).toBe(true);
  });

  it('stay visible as unmapped, not Precast pieces, if the item group is unknown', () => {
    const rows = rowsOf(dataset({ items: [item(STEEL.itemCode, 'UNKNOWN')], productionReceipts: [steel(12)] }));
    expect(row(rows, 'unmapped:nos')!.produced).toBe(12);
    expect(row(rows, 'precast:pieces')!.produced).toBe(0);
  });
});
