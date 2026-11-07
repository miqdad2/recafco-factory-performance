import type { ReactNode } from 'react';

interface DashboardLayoutProps {
  header: ReactNode;
  cards: ReactNode;
  trend: ReactNode;
  concrete: ReactNode;
  summary: ReactNode;
  footer: ReactNode;
  busy?: boolean;
}

/**
 * Shared screen grid for the loaded, loading and error states, so the layout
 * never jumps. On large displays the page is exactly one viewport high: the cards
 * take their content height and the trend takes all that remains, beside a column
 * of Concrete Output and Project Summary. Below the rem minimum (e.g.
 * 1366×768, the `compact` variant) the page grows to its content and scrolls
 * vertically instead of squeezing panels; narrow screens stack panels.
 */
export function DashboardLayout({ header, cards, trend, concrete, summary, footer, busy }: DashboardLayoutProps) {
  return (
    <main
      aria-busy={busy || undefined}
      className="flex min-h-dvh flex-col gap-5 overflow-x-clip p-6 lg:grid lg:h-dvh lg:min-h-[66rem] lg:compact:h-auto lg:grid-cols-[minmax(0,1fr)] lg:grid-rows-[auto_auto_minmax(20rem,1fr)_auto] lg:compact:grid-rows-[auto_auto_minmax(32rem,1fr)_auto]"
    >
      {header}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">{cards}</div>

      <div className="grid min-h-0 grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="flex min-h-0 min-w-0 flex-col lg:col-span-3">{trend}</div>
        <div className="flex min-h-0 min-w-0 flex-col gap-5 lg:col-span-2">
          <div className="flex shrink-0 flex-col">{concrete}</div>
          <div className="flex min-h-0 flex-1 flex-col">{summary}</div>
        </div>
      </div>

      {footer}
    </main>
  );
}
