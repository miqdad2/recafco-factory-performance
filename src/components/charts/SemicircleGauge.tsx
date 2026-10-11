interface SemicircleGaugeProps {
  /** Percentage; drawn up to 100 while the printed value stays true. null = not available. */
  percent: number | null;
  valueText: string;
  caption: string;
  trackColor: string;
  fillColor: string;
}

/**
 * Semicircle gauge as inline SVG. The viewBox keeps its aspect ratio inside any
 * container, so the arc and the text inside it scale together without clipping.
 */
export function SemicircleGauge({ percent, valueText, caption, trackColor, fillColor }: SemicircleGaugeProps) {
  const arc = 'M 19 120 A 101 101 0 0 1 221 120';
  const drawn = percent === null ? 0 : Math.max(0, Math.min(100, percent));

  return (
    <svg viewBox="0 9 240 118" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${valueText} ${caption}`} className="h-full w-full">
      <path d={arc} fill="none" stroke={trackColor} strokeWidth={18} />
      {drawn > 0 && (
        <path
          d={arc}
          fill="none"
          stroke={fillColor}
          strokeWidth={18}
          pathLength={100}
          strokeDasharray={`${drawn} 100`}
          className="motion-safe:transition-[stroke-dasharray] motion-safe:duration-300"
        />
      )}
      {/* "29.1%" fits at 44; longer values such as "113.6%" step down so they clear the arc. */}
      <text
        x={120}
        y={100}
        textAnchor="middle"
        fontSize={percent === null ? 26 : valueText.length > 5 ? 38 : 44}
        fontWeight={700}
        fill="var(--text-primary)"
      >
        {valueText}
      </text>
      <text x={120} y={121} textAnchor="middle" fontSize={16} fill="var(--text-secondary)">
        {caption}
      </text>
    </svg>
  );
}
