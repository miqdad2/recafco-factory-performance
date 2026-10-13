/**
 * Fixed demo reference data. Everything here is FICTIONAL and illustrative.
 * See README.md in this folder for the full list of assumptions.
 */
import type { CapacityPlan, ProductCategory, Project } from '../contracts';

/**
 * Demo reference timestamp: the moment all demo data refers to ("data as of").
 * Fixed so the dataset is reproducible and never empties as the real date moves on.
 * It is separate from the live Kuwait clock and from the provider's load time.
 */
export const DEMO_REFERENCE_TIME = '2026-10-14T14:00:00+03:00';

/** First day covered by demo records (Kuwait). Supports the Yearly view for 2026. */
export const DEMO_DATASET_START = { year: 2026, month: 1, day: 1 } as const;

export const DEMO_SEED = 20261014;
/** Separate seed for finished-element records, so other demo records stay unchanged. */
export const DEMO_ELEMENT_SEED = DEMO_SEED + 1;

/**
 * Mean completed pieces per hour at full shift intensity, by product category
 * (illustrative). A full weekday produces roughly 51 Hollowcore, 30 Precast and
 * 9 GRC elements, so production exceeds deliveries over every period. Categories
 * are mutually exclusive in the demo.
 */
export const DEMO_ELEMENT_HOURLY_RATE: Record<ProductCategory, number> = {
  hollowcore: 3.8,
  precast: 2.2,
  grc: 0.7,
};

/** Concrete grades of batching-plant batches (capacity records only; not shown). */
export const DEMO_GRADES = [
  ['C40', 0.33],
  ['C50', 0.25],
  ['C35', 0.18],
  ['C60', 0.11],
  ['C30', 0.08],
  ['C25', 0.05],
] as const;

/** Fictional precast item codes used on delivery note lines. */
export const DEMO_ITEMS = ['DEMO-HCS-200', 'DEMO-WALL-150', 'DEMO-BEAM-40', 'DEMO-COL-30', 'DEMO-STAIR-01'] as const;

/**
 * Projects. Four are featured on the dashboard; three others receive deliveries
 * but are not shown. Planned pieces and opening balances are invented.
 */
export const DEMO_PROJECTS: Project[] = [
  { code: 'DEMO-P01', name: 'Coastal Residential Towers', featured: true, plannedPieces: 5600, openingDeliveredPieces: 1450 },
  { code: 'DEMO-P02', name: 'Ring Road Bridge Segments', featured: true, plannedPieces: 8200, openingDeliveredPieces: 900 },
  { code: 'DEMO-P03', name: 'Hospital Extension Block', featured: true, plannedPieces: 11400, openingDeliveredPieces: 600 },
  { code: 'DEMO-P04', name: 'School Campus Phase 2', featured: true, plannedPieces: 3300, openingDeliveredPieces: 1250 },
  { code: 'DEMO-P05', name: 'Logistics Warehouse Park', featured: false, plannedPieces: 4000, openingDeliveredPieces: 300 },
  { code: 'DEMO-P06', name: 'Marina Car Park Deck', featured: false, plannedPieces: 3600, openingDeliveredPieces: 0 },
  { code: 'DEMO-P07', name: 'Community Mosque Annex', featured: false, plannedPieces: 1500, openingDeliveredPieces: 200 },
];

/** Share of delivery notes per project. */
export const DEMO_PROJECT_DELIVERY_WEIGHTS = [
  ['DEMO-P01', 0.19],
  ['DEMO-P02', 0.2],
  ['DEMO-P03', 0.17],
  ['DEMO-P04', 0.09],
  ['DEMO-P05', 0.15],
  ['DEMO-P06', 0.12],
  ['DEMO-P07', 0.08],
] as const;

/** Illustrative monthly batch plant capacity. NOT derived from SAP "T.VOL". */
export const DEMO_CAPACITY_PLANS: CapacityPlan[] = Array.from({ length: 12 }, (_, i) => ({
  month: `2026-${String(i + 1).padStart(2, '0')}`,
  plannedCapacityM3: 9000,
  basis: 'illustrative-demo' as const,
}));
