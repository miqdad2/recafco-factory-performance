/**
 * Batching-plant concrete volumes carry at most three decimals (0.001 m³ = 1 litre),
 * matching the SAP report precision. Sums are done in whole litres so the monthly
 * capacity figures are exact; m³ values are derived only from those integer sums.
 * Finished elements are whole pieces and need no conversion.
 */
export const toLitres = (m3: number): number => Math.round(m3 * 1000);
export const fromLitres = (litres: number): number => litres / 1000;
