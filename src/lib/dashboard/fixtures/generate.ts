/**
 * Deterministic generators for the demo dataset. Same seed → same records.
 * No record is ever dated at or after the reference time (no fake future output).
 */
import type {
  ConcreteBatchRecord,
  DeliveryNote,
  DemoDataset,
  ProductionOrder,
  ProductionReceiptLine,
  SalesOrder,
} from '../contracts';
import { kuwaitDateKey, kuwaitInstant, parseInstant, toKuwaitCivil, toKuwaitIso } from '../periods';
import {
  DEMO_DATASET_START,
  DEMO_DATE_ONLY_OUTPUT,
  DEMO_GRADES,
  DEMO_ITEMS,
  DEMO_PROJECT_SEED,
  DEMO_PROJECT_WORK,
  DEMO_PROJECTS,
  DEMO_RECEIPT_SEED,
  DEMO_REFERENCE_TIME,
  DEMO_SEED,
  DEMO_TIMED_OUTPUT,
  type DemoOutputItem,
} from './catalog';
import { createRandom, type Random } from './random';

const MINUTE_MS = 60_000;
const FRIDAY = 5;
const SATURDAY = 6;

/**
 * Typical hourly batching-plant output (m³) for a full working day; also used,
 * scaled to a 0–1 shift intensity, for production receipts.
 * Hours 02–04 are never scheduled.
 */
const WEEKDAY_HOURLY_BASE: Record<number, number> = {
  0: 5, 1: 4, 5: 6, 6: 16, 7: 22, 8: 24, 9: 25, 10: 24, 11: 22, 12: 12,
  13: 21, 14: 22, 15: 22, 16: 21, 17: 20, 18: 17, 19: 16, 20: 15, 21: 13, 22: 6, 23: 5,
};
/** Saturday: single morning shift. Friday: no production. */
const SATURDAY_HOURLY_BASE: Record<number, number> = { 6: 14, 7: 20, 8: 22, 9: 22, 10: 21, 11: 18, 12: 10, 13: 16 };

/** Highest hourly base above; scales a schedule to a 0–1 shift intensity. */
const PEAK_HOURLY_BASE = 25;

/** Lines recorded without a project reference. */
const UNASSIGNED_SHARE = 0.04;

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const pad = (n: number, width: number) => String(n).padStart(width, '0');

/** Kuwait calendar days from the dataset start up to and including the reference day. */
function* demoDays(referenceMs: number) {
  const { year, month, day } = DEMO_DATASET_START;
  for (let i = 0; ; i++) {
    const startMs = kuwaitInstant(year, month, day + i);
    if (startMs >= referenceMs) return;
    yield { startMs, civil: toKuwaitCivil(startMs) };
  }
}

/** Summer heat and month-to-month variation. */
function seasonalFactor(month: number): number {
  const factors = [0.95, 1.0, 1.04, 1.02, 0.97, 0.9, 0.84, 0.86, 0.93, 1.0, 1.03, 0.98];
  return factors[month - 1] ?? 1;
}

/** Whole-number count with the given mean (Knuth's Poisson sampler). */
function samplePieces(random: Random, mean: number): number {
  const limit = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= random.next();
  } while (p > limit);
  return k - 1;
}

/**
 * Attributes a line to a project that takes this item, using the project seed so
 * quantities do not change with attribution. A small share has no reference at all,
 * and `preferred` keeps most lines of one document on the same project.
 */
function pickProject(projects: Random, itemCode: string, preferred: string | null = null): string | null {
  if (projects.chance(UNASSIGNED_SHARE)) return null;
  const group = DEMO_ITEMS.find((i) => i.itemCode === itemCode)?.itemGroup ?? '';
  const eligible = DEMO_PROJECT_WORK.filter((p) => p.itemGroups.includes(group));
  if (eligible.length === 0) return null;
  if (preferred && eligible.some((p) => p.code === preferred)) return preferred;
  return projects.pick(eligible.map((p) => [p.code, p.weight] as const));
}

const lineQuantity = (random: Random, [low, high]: readonly [number, number], uom: string) =>
  uom === 'Nos' ? random.int(low, high) : round3(random.between(low, high));

/**
 * Receipt-from-production lines. Each line's quantity is that transaction alone; the
 * running total is repeated beside it, as order rows do, and must never be summed.
 * Includes cancelled receipts and ineligible raw-material and steel receipts to exclude.
 */
function generateReceipts(random: Random, projects: Random, referenceMs: number): ProductionReceiptLine[] {
  const lines: ProductionReceiptLine[] = [];
  const cumulative = new Map<number, number>();
  let docEntry = 0;

  const push = (itemCode: string, uom: string, quantity: number, postingMs: number, recordedAt: string | null) => {
    docEntry++;
    // Illustrative monthly run per item; not one of the current production orders.
    const productionOrderEntry = 1000 + DEMO_ITEMS.findIndex((i) => i.itemCode === itemCode) * 100 + toKuwaitCivil(postingMs).month;
    const cancelled = random.chance(0.01);
    const orderCumulativeCompleted = round3((cumulative.get(productionOrderEntry) ?? 0) + (cancelled ? 0 : quantity));
    cumulative.set(productionOrderEntry, orderCumulativeCompleted);
    lines.push({
      docEntry,
      docNum: 70000 + docEntry,
      lineNum: 0,
      postingDate: kuwaitDateKey(postingMs),
      recordedAt,
      cancelled,
      itemCode,
      quantity,
      uom,
      productionOrderEntry,
      orderCumulativeCompleted,
      projectCode: pickProject(projects, itemCode),
      verifiedElementCount: null,
    });
  };

  for (const { startMs, civil } of demoDays(referenceMs)) {
    if (civil.weekday === FRIDAY) continue;
    const schedule = civil.weekday === SATURDAY ? SATURDAY_HOURLY_BASE : WEEKDAY_HOURLY_BASE;
    const dayFactor = seasonalFactor(civil.month) * random.between(0.85, 1.12);

    for (const [hourText, base] of Object.entries(schedule)) {
      const hourStart = startMs + Number(hourText) * 60 * MINUTE_MS;
      if (hourStart >= referenceMs) continue;
      if (random.chance(0.06)) continue; // stoppage: elapsed hour with no receipts

      const intensity = (base / PEAK_HOURLY_BASE) * dayFactor;
      for (const item of DEMO_TIMED_OUTPUT) {
        const elements = samplePieces(random, item.hourlyRate * intensity);
        const atMs = hourStart + random.int(0, 59) * MINUTE_MS;
        if (elements === 0 || atMs >= referenceMs) continue;
        let quantity = 0;
        for (let e = 0; e < elements; e++) quantity += lineQuantity(random, item.elementSize, item.uom);
        push(item.itemCode, item.uom, round3(quantity), atMs, toKuwaitIso(atMs));
      }
      if (random.chance(0.04)) push('DEMO-STEEL-CAGE', 'Nos', random.int(5, 20), hourStart, toKuwaitIso(hourStart));
      if (random.chance(0.02)) push('DEMO-RM-AGGREGATE', 'm3', random.int(4, 12), hourStart, toKuwaitIso(hourStart));
    }

    for (const item of DEMO_DATE_ONLY_OUTPUT) {
      const receipts = random.int(1, 3);
      for (let r = 0; r < receipts; r++) push(item.itemCode, item.uom, lineQuantity(random, item.elementSize, item.uom), startMs, null);
    }
  }
  return lines;
}

/** Batching-plant concrete batches (m³). Used only for Concrete Output. */
function generateConcreteBatches(random: Random, referenceMs: number): ConcreteBatchRecord[] {
  const records: ConcreteBatchRecord[] = [];
  let seq = 0;

  for (const { startMs, civil } of demoDays(referenceMs)) {
    if (civil.weekday === FRIDAY) continue;
    const schedule = civil.weekday === SATURDAY ? SATURDAY_HOURLY_BASE : WEEKDAY_HOURLY_BASE;
    const dayFactor = seasonalFactor(civil.month) * random.between(0.85, 1.12);

    for (const [hourText, base] of Object.entries(schedule)) {
      const hourStart = startMs + Number(hourText) * 60 * MINUTE_MS;
      if (hourStart >= referenceMs) continue;
      if (random.chance(0.05)) continue; // stoppage: elapsed hour with zero output

      const hourTotal = base * dayFactor * random.between(0.8, 1.2);
      const batches = random.int(1, 3);
      for (let b = 0; b < batches; b++) {
        const producedAtMs = hourStart + random.int(0, 59) * MINUTE_MS;
        if (producedAtMs >= referenceMs) continue;
        seq++;
        records.push({
          id: `DEMO-BAT-${pad(seq, 6)}`,
          producedAt: toKuwaitIso(producedAtMs),
          grade: random.pick(DEMO_GRADES),
          volumeM3: round3((hourTotal / batches) * random.between(0.85, 1.15)),
          productionOrderId: `DEMO-PO-${pad(random.int(1, 60), 4)}`,
        });
      }
    }
  }
  return records;
}

/** A billing or transport line; carries a project but is excluded from output by rule. */
const chargeLine = (lineNum: number, itemCode: string, projectCode: string) => ({
  lineNum,
  itemCode,
  quantity: 1,
  uom: 'Nos',
  projectCode,
  verifiedElementCount: null,
});

/**
 * Delivery notes with quantities in each item's own unit. About a third stay Open in
 * SAP terms and still count; some carry billing or transport lines to exclude.
 */
function generateDeliveries(random: Random, projects: Random, referenceMs: number): DeliveryNote[] {
  const outputs: readonly (readonly [DemoOutputItem, number])[] = [
    ...DEMO_TIMED_OUTPUT.map((item) => [item, 1] as const),
    ...DEMO_DATE_ONLY_OUTPUT.map((item) => [item, 1] as const),
  ];
  const notes: DeliveryNote[] = [];
  let seq = 0;

  for (const { startMs, civil } of demoDays(referenceMs)) {
    if (civil.weekday === FRIDAY) continue;
    const count = civil.weekday === SATURDAY ? random.int(2, 4) : random.int(4, 8);
    for (let n = 0; n < count; n++) {
      // Dated by business date; a note later than the reference time does not exist yet.
      if (startMs + random.int(7 * 60, 19 * 60) * MINUTE_MS >= referenceMs) continue;
      seq++;
      const noteProject = projects.pick(DEMO_PROJECT_WORK.map((p) => [p.code, p.weight] as const));
      const lines: DeliveryNote['lines'] = Array.from({ length: random.int(1, 3) }, (_, lineNum) => {
        const item = random.pick(outputs);
        return {
          lineNum,
          itemCode: item.itemCode,
          quantity: lineQuantity(random, item.deliverySize, item.uom),
          uom: item.uom,
          projectCode: pickProject(projects, item.itemCode, noteProject),
          verifiedElementCount: null,
        };
      });
      if (random.chance(0.05)) lines.push(chargeLine(lines.length, 'DEMO-BILL-ADJ', noteProject));
      if (random.chance(0.1)) lines.push(chargeLine(lines.length, 'DEMO-SVC-TRANSPORT', noteProject));
      notes.push({
        docEntry: seq,
        docNum: 40000 + seq,
        postingDate: kuwaitDateKey(startMs),
        documentStatus: random.chance(0.35) ? 'open' : 'closed',
        cancelled: random.chance(0.03),
        lines,
      });
    }
  }
  return notes;
}

function generateSalesOrders(random: Random, projects: Random, referenceMs: number): SalesOrder[] {
  const anyProject = DEMO_PROJECT_WORK.map((p) => [p.code, p.weight] as const);
  return Array.from({ length: 80 }, (_, i) => {
    const orderProject = projects.pick(anyProject);
    const status = random.pick([['open', 0.65], ['closed', 0.27], ['cancelled', 0.08]] as const);
    const fullyDeliveredButOpen = status === 'open' && random.chance(0.12);
    const lines = Array.from({ length: random.int(1, 4) }, () => {
      const orderedQuantity = random.int(20, 400);
      const deliveredQuantity =
        status === 'closed' || fullyDeliveredButOpen
          ? orderedQuantity
          : status === 'cancelled'
            ? 0
            : Math.floor(orderedQuantity * random.between(0, 0.9));
      // Most lines follow the order's project; some name another, or none.
      const roll = projects.next();
      const projectCode = roll < UNASSIGNED_SHARE ? null : roll < 0.15 ? projects.pick(anyProject) : orderProject;
      return { orderedQuantity, deliveredQuantity, projectCode };
    });
    return {
      docEntry: i + 1,
      docNum: 21000 + i,
      postedAt: toKuwaitIso(referenceMs - random.int(1, 150) * 24 * 60 * MINUTE_MS),
      customer: `Demo Customer ${pad(random.int(1, 25), 2)}`,
      status,
      lines,
    };
  });
}

function generateProductionOrders(random: Random, projects: Random, referenceMs: number): ProductionOrder[] {
  return Array.from({ length: 60 }, (_, i) => {
    const status = random.pick([['released', 0.5], ['planned', 0.2], ['closed', 0.24], ['cancelled', 0.06]] as const);
    const plannedQuantity = random.int(10, 240);
    const completedQuantity =
      status === 'closed'
        ? plannedQuantity
        : status === 'released'
          ? random.chance(0.1)
            ? plannedQuantity // finished but not yet closed: not active
            : Math.floor(plannedQuantity * random.between(0, 0.95))
          : 0;
    return {
      docEntry: i + 1,
      docNum: 30000 + i,
      createdAt: toKuwaitIso(referenceMs - random.int(1, 90) * 24 * 60 * MINUTE_MS),
      status,
      plannedQuantity,
      completedQuantity,
      projectCode: projects.chance(UNASSIGNED_SHARE) ? null : projects.pick(DEMO_PROJECT_WORK.map((p) => [p.code, p.weight] as const)),
    };
  });
}

export function generateDemoDataset(): DemoDataset {
  const referenceMs = parseInstant(DEMO_REFERENCE_TIME);
  const random = createRandom(DEMO_SEED);
  const projects = createRandom(DEMO_PROJECT_SEED);
  return {
    referenceTime: DEMO_REFERENCE_TIME,
    items: DEMO_ITEMS,
    projects: DEMO_PROJECTS,
    concreteBatches: generateConcreteBatches(random, referenceMs),
    deliveryNotes: generateDeliveries(random, projects, referenceMs),
    salesOrders: generateSalesOrders(random, projects, referenceMs),
    productionOrders: generateProductionOrders(random, projects, referenceMs),
    productionReceipts: generateReceipts(createRandom(DEMO_RECEIPT_SEED), projects, referenceMs),
    // Demo output is generated as receipts; component consumption is not modelled.
    componentIssues: [],
  };
}

let cached: DemoDataset | null = null;

/** The demo dataset, generated once per page load. */
export function getDemoDataset(): DemoDataset {
  cached ??= generateDemoDataset();
  return cached;
}
