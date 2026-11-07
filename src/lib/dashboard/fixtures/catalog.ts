/**
 * Fixed demo reference data. Everything here is FICTIONAL and illustrative.
 * See README.md in this folder for the full list of assumptions.
 */
import type { ItemRecord, ProjectRecord } from '../contracts';

/**
 * Demo reference timestamp: the moment all demo data refers to ("data as of").
 * Fixed so the dataset is reproducible and never empties as the real date moves on.
 * It is separate from the live Kuwait clock and from the provider's load time.
 */
export const DEMO_REFERENCE_TIME = '2026-10-14T14:00:00+03:00';

/** First day covered by demo records (Kuwait). Supports the Yearly view for 2026. */
export const DEMO_DATASET_START = { year: 2026, month: 1, day: 1 } as const;

export const DEMO_SEED = 20261014;
/** Separate seed for production receipts, so concrete and order records stay independent. */
export const DEMO_RECEIPT_SEED = DEMO_SEED + 1;
/** Separate seed for project references, so quantities do not depend on attribution. */
export const DEMO_PROJECT_SEED = DEMO_SEED + 2;

const item = (
  itemCode: string,
  description: string,
  itemGroup: string,
  flags: { inventoryItem?: boolean; finishedGoodsFlag: boolean; nosIsPhysicalCount?: boolean },
): ItemRecord => ({
  itemCode,
  description,
  itemGroup,
  inventoryItem: flags.inventoryItem ?? true,
  finishedGoodsFlag: flags.finishedGoodsFlag,
  nosIsPhysicalCount: flags.nosIsPhysicalCount ?? false,
  verifiedSubtype: null,
});

/**
 * Fictional item master. The Finished Goods flag is deliberately inconsistent,
 * as in the SAP examples, so the mapping rules cannot lean on it.
 */
export const DEMO_ITEMS: ItemRecord[] = [
  item('DEMO-HCS-150', 'Hollowcore slab 150 mm', 'HOLLOWCORE', { finishedGoodsFlag: true }),
  item('DEMO-HCS-200', 'Hollowcore slab 200 mm', 'HOLLOWCORE', { finishedGoodsFlag: false }),
  item('DEMO-WALL-150', 'Precast wall panel', 'PRECAST', { finishedGoodsFlag: true }),
  item('DEMO-BEAM-40', 'Precast beam', 'PRECAST', { finishedGoodsFlag: false }),
  item('DEMO-STAIR-01', 'Precast stair flight', 'PRECAST', { finishedGoodsFlag: true, nosIsPhysicalCount: true }),
  item('DEMO-COL-30', 'Precast column', 'PRECAST', { finishedGoodsFlag: false, nosIsPhysicalCount: true }),
  item('DEMO-GRC-PANEL', 'GRC facade panel', 'GRC', { finishedGoodsFlag: true }),
  item('DEMO-GRC-COPING', 'GRC coping', 'GRC', { finishedGoodsFlag: false }),
  item('DEMO-RM-AGGREGATE', 'Aggregate 10 mm', 'RAW-MATERIAL', { finishedGoodsFlag: true }),
  item('DEMO-STEEL-CAGE', 'Steel reinforcement cage', 'STEEL-SEMI', { finishedGoodsFlag: true }),
  item('DEMO-BILL-ADJ', 'Billing adjustment', 'BILLING-ADJ', { inventoryItem: false, finishedGoodsFlag: false }),
  item('DEMO-SVC-TRANSPORT', 'Transport charge', 'SERVICE', { inventoryItem: false, finishedGoodsFlag: false }),
];

/** Fictional project master. Codes are marked DEMO; names are invented. */
export const DEMO_PROJECTS: ProjectRecord[] = [
  { code: 'DEMO-P01', name: 'Coastal Residential Towers' },
  { code: 'DEMO-P02', name: 'Ring Road Bridge Segments' },
  { code: 'DEMO-P03', name: 'Hospital Extension Block' },
  { code: 'DEMO-P04', name: 'School Campus Phase 2' },
  { code: 'DEMO-P05', name: 'Logistics Warehouse Park' },
  { code: 'DEMO-P06', name: 'Marina Car Park Deck' },
  { code: 'DEMO-P07', name: 'Community Mosque Annex' },
];

/** Share of work per project, and the item groups each one takes. */
export const DEMO_PROJECT_WORK: readonly { code: string; weight: number; itemGroups: readonly string[] }[] = [
  { code: 'DEMO-P01', weight: 0.24, itemGroups: ['HOLLOWCORE', 'PRECAST', 'GRC'] },
  { code: 'DEMO-P02', weight: 0.2, itemGroups: ['PRECAST'] },
  { code: 'DEMO-P03', weight: 0.2, itemGroups: ['HOLLOWCORE', 'PRECAST', 'GRC'] },
  { code: 'DEMO-P04', weight: 0.1, itemGroups: ['HOLLOWCORE', 'PRECAST'] },
  { code: 'DEMO-P05', weight: 0.13, itemGroups: ['HOLLOWCORE', 'PRECAST'] },
  { code: 'DEMO-P06', weight: 0.08, itemGroups: ['HOLLOWCORE'] },
  { code: 'DEMO-P07', weight: 0.05, itemGroups: ['GRC', 'PRECAST'] },
];

/** One line of output or delivery for an eligible item. */
export interface DemoOutputItem {
  itemCode: string;
  uom: string;
  /** Mean elements received per hour at full shift intensity. */
  hourlyRate: number;
  /** Quantity range for one completed element, in the item's own unit. */
  elementSize: readonly [number, number];
  /** Quantity range for one delivery note line, in the item's own unit. */
  deliverySize: readonly [number, number];
}

/** Hollowcore and Precast receipts carry a completion time. */
export const DEMO_TIMED_OUTPUT: DemoOutputItem[] = [
  { itemCode: 'DEMO-HCS-150', uom: 'm2', hourlyRate: 2.2, elementSize: [9, 14], deliverySize: [40, 150] },
  { itemCode: 'DEMO-HCS-200', uom: 'm2', hourlyRate: 1.6, elementSize: [10, 16], deliverySize: [40, 180] },
  { itemCode: 'DEMO-WALL-150', uom: 'm3', hourlyRate: 1.1, elementSize: [1.5, 3.5], deliverySize: [4, 14] },
  { itemCode: 'DEMO-BEAM-40', uom: 'm3', hourlyRate: 0.6, elementSize: [0.8, 2.2], deliverySize: [2, 9] },
  { itemCode: 'DEMO-STAIR-01', uom: 'Nos', hourlyRate: 0.3, elementSize: [1, 1], deliverySize: [1, 4] },
  { itemCode: 'DEMO-COL-30', uom: 'Nos', hourlyRate: 0.3, elementSize: [1, 1], deliverySize: [1, 5] },
];

/** GRC receipts are date-only in the demo, so its Daily view cannot show hours. */
export const DEMO_DATE_ONLY_OUTPUT: DemoOutputItem[] = [
  { itemCode: 'DEMO-GRC-PANEL', uom: 'm2', hourlyRate: 0, elementSize: [8, 30], deliverySize: [10, 45] },
  { itemCode: 'DEMO-GRC-COPING', uom: 'm2', hourlyRate: 0, elementSize: [5, 18], deliverySize: [6, 24] },
];

/** Concrete grades of batching-plant batches (recorded, not shown). */
export const DEMO_GRADES = [
  ['C40', 0.33],
  ['C50', 0.25],
  ['C35', 0.18],
  ['C60', 0.11],
  ['C30', 0.08],
  ['C25', 0.05],
] as const;
