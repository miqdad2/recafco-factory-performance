import { useEffect, useRef } from 'react';
import { echarts, type EChartsCoreOption } from './echarts';

interface EChartProps {
  option: EChartsCoreOption;
  /** Text alternative describing the essential values shown. */
  ariaLabel: string;
  className?: string;
}

/**
 * Owns one ECharts instance: creates it on mount, resizes it to its container
 * and disposes it (plus the observer and any pending frame) on unmount.
 */
export function EChart({ option, ariaLabel, className }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const optionRef = useRef(option);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = echarts.init(container, null, { renderer: 'canvas' });
    chartRef.current = chart;

    // Canvas text does not re-flow when the web font arrives; redraw once it has loaded.
    let disposed = false;
    document.fonts?.ready.then(() => {
      if (!disposed) chart.setOption(optionRef.current, { notMerge: true });
    });

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => chart.resize());
    });
    observer.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    optionRef.current = option;
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={containerRef} role="img" aria-label={ariaLabel} className={className} />;
}
