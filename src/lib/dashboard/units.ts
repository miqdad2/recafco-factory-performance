/**
 * Source quantities carry at most three decimals (matching the SAP report precision).
 * Sums are done in whole thousandths so every row, series and total is exact;
 * display values are derived only from those integer sums.
 * This is arithmetic only: it never converts between units.
 */
export const toMilli = (quantity: number): number => Math.round(quantity * 1000);
export const fromMilli = (milli: number): number => milli / 1000;
