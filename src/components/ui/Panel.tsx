import { useId, type ReactNode } from 'react';

interface PanelProps {
  title: string;
  /** Short context shown beside the title, e.g. period or unit. */
  meta?: ReactNode;
  /** Supporting line under the title, e.g. what a figure measures. */
  subtitle?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Solid navy panel with a large title row. Content fills the remaining height. */
export function Panel({ title, meta, subtitle, className = '', children }: PanelProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={`flex min-h-0 min-w-0 flex-1 flex-col rounded-panel border border-line bg-surface p-6 shadow-panel ${className}`}
    >
      <header>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id={titleId} className="text-panel font-semibold text-ink">
            {title}
          </h2>
          {meta && <p className="text-support text-ink-muted">{meta}</p>}
        </div>
        {subtitle && <p className="mt-0.5 text-support text-ink-muted">{subtitle}</p>}
      </header>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}
