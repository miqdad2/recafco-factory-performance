// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDashboardSnapshot, prepareDataset } from '../../../lib/dashboard/aggregate';
import { generateDemoDataset } from '../../../lib/dashboard/fixtures/generate';
import { ALL_PROJECTS } from '../../../lib/dashboard/projects';
import { toMilli } from '../../../lib/dashboard/units';
import { formatCellQuantity, formatSeriesName } from '../labels';
import { AUTO_PAGE_MS } from '../useAutoPages';
import { ProjectSummaryPanel } from './ProjectSummaryPanel';

const data = prepareDataset(generateDemoDataset());
const yearly = buildDashboardSnapshot(data, 'yearly');
const KEY = 'hollowcore:m2';
const headline = yearly.output.rows.find((r) => r.key === KEY)!;
const series = { key: KEY, name: formatSeriesName(headline) };
const matching = yearly.projectSummary.filter((r) => r.rowKey === KEY);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Harness({ hold = false, project = ALL_PROJECTS, onSelectProject = () => {} }: { hold?: boolean; project?: string; onSelectProject?: (p: string) => void }) {
  const [auto, setAuto] = useState(false);
  const snapshot = project === ALL_PROJECTS ? yearly : buildDashboardSnapshot(data, 'yearly', project);
  return (
    <ProjectSummaryPanel
      rows={snapshot.projectSummary}
      options={snapshot.projectOptions}
      selectedProject={snapshot.selectedProject}
      period="yearly"
      series={series}
      onSelectProject={onSelectProject}
      autoPages={auto}
      onAutoPagesChange={setAuto}
      holdPages={hold}
    />
  );
}

const panel = () => screen.getByRole('region', { name: 'Project Summary' });
const visibleRows = () => within(within(panel()).getByRole('table')).getAllByRole('row').slice(1);
const pageText = () => within(panel()).getByText(/^Showing/).textContent;
const autoButton = () => within(screen.getByRole('group', { name: 'Auto pages' })).getByRole('button');
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('Project Summary totals', () => {
  it('totals every matching project across all pages, not just the visible rows', () => {
    render(<Harness />);
    const sum = (field: 'produced' | 'delivered') => matching.reduce((s, r) => s + toMilli(r[field]), 0);
    expect(sum('produced')).toBe(toMilli(headline.produced!));
    expect(sum('delivered')).toBe(toMilli(headline.delivered!));
    expect(visibleRows().length).toBeLessThan(matching.length); // more than one page
    const totals = within(panel()).getByText('All projects').parentElement!.textContent;
    expect(totals).toBe(`All projects · Produced ${formatCellQuantity(headline.produced!, 'm2')} · Delivered ${formatCellQuantity(headline.delivered!, 'm2')}`);
  });

  it('includes Unassigned in the total', () => {
    expect(matching.some((r) => r.projectKey === '__unassigned__')).toBe(true);
  });

  it('labels the total with the project when one is selected', () => {
    render(<Harness project="DEMO-P03" />);
    const scoped = buildDashboardSnapshot(data, 'yearly', 'DEMO-P03').output.rows.find((r) => r.key === KEY)!;
    const totals = within(panel()).getAllByText('Hospital Extension Block')[0]!.parentElement!.textContent;
    expect(totals).toContain(`Produced ${formatCellQuantity(scoped.produced!, 'm2')}`);
    expect(totals).toContain(`Delivered ${formatCellQuantity(scoped.delivered!, 'm2')}`);
  });
});

describe('Project Summary pagination wording', () => {
  it('names the range, total and page', () => {
    render(<Harness />);
    expect(pageText()).toBe(`Showing 1–4 of ${matching.length} projects · Page 1 of 2`);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(pageText()).toBe(`Showing 5–${matching.length} of ${matching.length} projects · Page 2 of 2`);
  });

  it('uses the singular for one project on one page', () => {
    render(<Harness project="DEMO-P03" />);
    expect(pageText()).toBe('Showing 1 project');
    expect(screen.queryByRole('group', { name: 'Auto pages' })).toBeNull();
  });
});

describe('automatic paging', () => {
  it('is off by default and starts on request, advancing every 15 seconds and looping', () => {
    render(<Harness />);
    expect(autoButton().textContent).toBe('Start');
    advance(AUTO_PAGE_MS * 2);
    expect(pageText()).toContain('Page 1 of 2');

    fireEvent.click(autoButton());
    expect(autoButton().textContent).toBe('Pause');
    expect(screen.getByText(/Auto pages on/)).toBeTruthy();
    advance(AUTO_PAGE_MS);
    expect(pageText()).toContain('Page 2 of 2');
    advance(AUTO_PAGE_MS);
    expect(pageText()).toContain('Page 1 of 2');
  });

  it('pauses and resumes', () => {
    render(<Harness />);
    fireEvent.click(autoButton());
    fireEvent.click(autoButton());
    expect(autoButton().textContent).toBe('Resume');
    advance(AUTO_PAGE_MS * 2);
    expect(pageText()).toContain('Page 1 of 2');
    fireEvent.click(autoButton());
    advance(AUTO_PAGE_MS);
    expect(pageText()).toContain('Page 2 of 2');
  });

  it('holds still while the pointer is over the summary', () => {
    render(<Harness />);
    fireEvent.click(autoButton());
    fireEvent.pointerEnter(panel());
    advance(AUTO_PAGE_MS * 2);
    expect(pageText()).toContain('Page 1 of 2');
    expect(screen.getByText('● Auto pages paused')).toBeTruthy();
    fireEvent.pointerLeave(panel());
    advance(AUTO_PAGE_MS);
    expect(pageText()).toContain('Page 2 of 2');
  });

  it('holds still while keyboard focus is inside the summary', () => {
    render(
      <>
        <Harness />
        <button type="button">elsewhere</button>
      </>,
    );
    fireEvent.click(autoButton());
    act(() => autoButton().focus());
    advance(AUTO_PAGE_MS * 2);
    expect(pageText()).toContain('Page 1 of 2');
    act(() => screen.getByRole('button', { name: 'elsewhere' }).focus());
    advance(AUTO_PAGE_MS);
    expect(pageText()).toContain('Page 2 of 2');
  });

  it('holds still while the screen asks it to (selector open, loading or failure)', () => {
    const { rerender } = render(<Harness />);
    fireEvent.click(autoButton());
    rerender(<Harness hold />);
    advance(AUTO_PAGE_MS * 2);
    expect(pageText()).toContain('Page 1 of 2');
    expect(screen.getByText('● Auto pages paused')).toBeTruthy();
  });

  it('stops when the user pages by hand, until resumed', () => {
    render(<Harness />);
    fireEvent.click(autoButton());
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(autoButton().textContent).toBe('Resume');
    advance(AUTO_PAGE_MS * 3);
    expect(pageText()).toContain('Page 2 of 2');
  });

  it('does not announce automatic page changes', () => {
    render(<Harness />);
    expect(within(panel()).getByText(/^Showing/).getAttribute('aria-live')).toBe('polite');
    fireEvent.click(autoButton());
    expect(within(panel()).getByText(/^Showing/).getAttribute('aria-live')).toBe('off');
  });

  it('leaves no timer running after the panel goes away', () => {
    const { unmount } = render(<Harness />);
    fireEvent.click(autoButton());
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
