interface ProgressBarProps {
  /** Values outside 0–100 are clamped for drawing only. */
  percent: number;
  colorClass: string;
  label: string;
}

/** Solid horizontal bar. The figure itself is always printed next to it by the caller. */
export function ProgressBar({ percent, colorClass, label }: ProgressBarProps) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      className="h-[1rem] w-full overflow-hidden rounded-full bg-raised"
    >
      <div
        className={`h-full rounded-full ${colorClass} motion-safe:transition-[width] motion-safe:duration-300`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
