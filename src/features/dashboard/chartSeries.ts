import type { ProductionSeries } from '../../lib/dashboard/contracts';
import { formatSeriesName } from './labels';

/** A product-and-unit choice, kept with its name so it can be reported even if a view has no such row. */
export interface ChosenSeries {
  key: string;
  name: string;
}

/** The user's choice, or the first row when nothing has been chosen yet. */
export function resolveSeries(series: readonly ProductionSeries[], chosen: ChosenSeries | null): ChosenSeries | null {
  if (chosen) return chosen;
  const first = series[0];
  return first ? { key: first.key, name: formatSeriesName(first) } : null;
}
