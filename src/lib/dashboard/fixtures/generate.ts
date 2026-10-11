/**
 * Deterministic generators for the demo dataset. Same seed → same records.
 * No record is ever dated at or after the reference time (no fake future output).
 */
import type { DeliveryNote, DemoDataset, ProductionOrder, ProductionRecord, SalesOrder } from '../contracts';
import { kuwaitInstant, parseInstant, toKuwaitCivil, toKuwaitIso } from '../periods';
import {
  DEMO_CAPACITY_PLANS,
  DEMO_DATASET_START,
  DEMO_GRADES,
  DEMO_ITEMS,
  DEMO_PROJECT_DELIVERY_WEIGHTS,
  DEMO_PROJECTS,
  DEMO_REFERENCE_TIME,
  DEMO_SEED,
} from './catalog';
import { createRandom, type Random } from './random';

const MINUTE_MS = 60_000;
const FRIDAY = 5;
const SATURDAY = 6;

/** Typical hourly output (m³) for a full working day. Hours 02–04 are never scheduled. */
const WEEKDAY_HOURLY_BASE: Record<number, number> = {
  0: 5, 1: 4, 5: 6, 6: 16, 7: 22, 8: 24, 9: 25, 10: 24, 11: 22, 12: 12,
  13: 21, 14: 22, 15: 22, 16: 21, 17: 20, 18: 17, 19: 16, 20: 15, 21: 13, 22: 6, 23: 5,
};
/** Saturday: single morning shift. Friday: no production. */
const SATURDAY_HOURLY_BASE: Record<number, number> = { 6: 14, 7: 20, 8: 22, 9: 22, 10: 21, 11: 18, 12: 10, 13: 16 };

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

function generateProduction(random: Random, referenceMs: number): ProductionRecord[] {
  const records: ProductionRecord[] = [];
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
          id: `DEMO-PRD-${pad(seq, 6)}`,
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

function generateDeliveries(random: Random, referenceMs: number): DeliveryNote[] {
  const notes: DeliveryNote[] = [];
  let seq = 0;

  for (const { startMs, civil } of demoDays(referenceMs)) {
    if (civil.weekday === FRIDAY) continue;
    const count = civil.weekday === SATURDAY ? random.int(2, 4) : random.int(4, 8);
    for (let n = 0; n < count; n++) {
      const deliveredAtMs = startMs + random.int(7 * 60, 19 * 60) * MINUTE_MS;
      if (deliveredAtMs >= referenceMs) continue;
      seq++;
      const lines = Array.from({ length: random.int(1, 3) }, () => ({
        itemCode: random.pick(DEMO_ITEMS.map((item) => [item, 1] as const)),
        pieces: random.int(2, 10),
      }));
      notes.push({
        id: `DEMO-DN-${pad(seq, 5)}`,
        deliveredAt: toKuwaitIso(deliveredAtMs),
        status: random.chance(0.03) ? 'cancelled' : 'completed',
        projectCode: random.pick(DEMO_PROJECT_DELIVERY_WEIGHTS),
        lines,
      });
    }
  }
  return notes.sort((a, b) => a.deliveredAt.localeCompare(b.deliveredAt));
}

function generateSalesOrders(random: Random, referenceMs: number): SalesOrder[] {
  return Array.from({ length: 80 }, (_, i) => {
    const status = random.pick([['open', 0.65], ['closed', 0.27], ['cancelled', 0.08]] as const);
    const fullyDeliveredButOpen = status === 'open' && random.chance(0.12);
    const lines = Array.from({ length: random.int(1, 4) }, () => {
      const orderedPieces = random.int(20, 400);
      const deliveredPieces =
        status === 'closed' || fullyDeliveredButOpen
          ? orderedPieces
          : status === 'cancelled'
            ? 0
            : Math.floor(orderedPieces * random.between(0, 0.9));
      return { orderedPieces, deliveredPieces };
    });
    return {
      id: `DEMO-SO-${pad(i + 1, 4)}`,
      postedAt: toKuwaitIso(referenceMs - random.int(1, 150) * 24 * 60 * MINUTE_MS),
      customer: `Demo Customer ${pad(random.int(1, 25), 2)}`,
      status,
      lines,
    };
  });
}

function generateProductionOrders(random: Random, referenceMs: number): ProductionOrder[] {
  return Array.from({ length: 60 }, (_, i) => {
    const status = random.pick([['released', 0.5], ['planned', 0.2], ['closed', 0.24], ['cancelled', 0.06]] as const);
    const plannedPieces = random.int(10, 240);
    const completedPieces =
      status === 'closed'
        ? plannedPieces
        : status === 'released'
          ? random.chance(0.1)
            ? plannedPieces // finished but not yet closed: not active
            : Math.floor(plannedPieces * random.between(0, 0.95))
          : 0;
    return {
      id: `DEMO-PO-${pad(i + 1, 4)}`,
      createdAt: toKuwaitIso(referenceMs - random.int(1, 90) * 24 * 60 * MINUTE_MS),
      status,
      plannedPieces,
      completedPieces,
    };
  });
}

export function generateDemoDataset(): DemoDataset {
  const referenceMs = parseInstant(DEMO_REFERENCE_TIME);
  const random = createRandom(DEMO_SEED);
  return {
    referenceTime: DEMO_REFERENCE_TIME,
    productionRecords: generateProduction(random, referenceMs),
    deliveryNotes: generateDeliveries(random, referenceMs),
    salesOrders: generateSalesOrders(random, referenceMs),
    productionOrders: generateProductionOrders(random, referenceMs),
    projects: DEMO_PROJECTS,
    capacityPlans: DEMO_CAPACITY_PLANS,
  };
}

let cached: DemoDataset | null = null;

/** The demo dataset, generated once per page load. */
export function getDemoDataset(): DemoDataset {
  cached ??= generateDemoDataset();
  return cached;
}
