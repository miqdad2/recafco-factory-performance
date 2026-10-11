/**
 * Concrete volumes carry at most three decimals (0.001 m³ = 1 litre), matching
 * the SAP report precision. Sums are done in whole litres so period totals,
 * trend buckets and grade breakdowns reconcile exactly; m³ values are derived
 * only from those integer sums.
 */
export const toLitres = (m3: number): number => Math.round(m3 * 1000);
export const fromLitres = (litres: number): number => litres / 1000;
