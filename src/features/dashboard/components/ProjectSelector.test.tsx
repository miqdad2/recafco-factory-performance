// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectOption } from '../../../lib/dashboard/contracts';
import { ALL_PROJECTS, UNASSIGNED_PROJECT } from '../../../lib/dashboard/projects';
import { arrangeProjectOptions, matchesProject } from '../projectSearch';
import { ProjectSelector } from './ProjectSelector';

afterEach(cleanup);

const LONG_NAME = 'Kuwait International Airport Terminal 2 Precast Facade and Structural Package';
const OPTIONS: ProjectOption[] = [
  { key: ALL_PROJECTS, code: null, name: 'All Projects' },
  { key: 'DEMO-P03', code: 'DEMO-P03', name: 'Hospital Extension Block' },
  { key: 'PC/92-25/80117/417', code: 'PC/92-25/80117/417', name: LONG_NAME },
  { key: 'DEMO-P01', code: 'DEMO-P01', name: 'Coastal Residential Towers' },
  { key: 'DEMO-P09', code: 'DEMO-P09', name: 'coastal residential towers' }, // same name, different code
  { key: 'DEMO-P02', code: 'DEMO-P02', name: 'Ring Road Bridge Segments' },
  { key: UNASSIGNED_PROJECT, code: null, name: 'Unassigned' },
];

function Harness({ onSelect = () => {}, initial = ALL_PROJECTS }: { onSelect?: (key: string) => void; initial?: string }) {
  const [requested, setRequested] = useState(initial);
  return (
    <>
      <ProjectSelector
        options={OPTIONS}
        requested={requested}
        requestState="settled"
        onSelect={(key) => {
          setRequested(key);
          onSelect(key);
        }}
      />
      <button type="button">elsewhere</button>
    </>
  );
}

const trigger = () => screen.getByRole('button', { name: /^Project:/ });
const search = () => screen.getByRole('combobox');
const results = () =>
  within(screen.getByRole('group', { name: 'Matching projects' }))
    .queryAllByRole('option')
    .map((o) => o.textContent);
const activeName = () => document.getElementById(search().getAttribute('aria-activedescendant')!)!.textContent;

describe('arrangeProjectOptions and matchesProject', () => {
  it('pins All Projects, sorts by name with the code as tie-breaker, and keeps Unassigned last', () => {
    const { all, projects } = arrangeProjectOptions(OPTIONS);
    expect(all?.key).toBe(ALL_PROJECTS);
    expect(projects.map((p) => p.key)).toEqual(['DEMO-P01', 'DEMO-P09', 'DEMO-P03', 'PC/92-25/80117/417', 'DEMO-P02', UNASSIGNED_PROJECT]);
  });

  it('matches name or code, partially, ignoring case and surrounding spaces', () => {
    const option = OPTIONS[2]!;
    for (const query of ['airport', 'AIRPORT', '  terminal 2 ', '80117', 'pc/92', '92-25/801']) expect(matchesProject(option, query)).toBe(true);
    expect(matchesProject(option, 'hospital')).toBe(false);
    expect(matchesProject(option, '   ')).toBe(true);
  });
});

describe('ProjectSelector', () => {
  it('lists projects alphabetically under a pinned All Projects, name above the exact code', async () => {
    render(<Harness />);
    await userEvent.click(trigger());
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getAllByRole('option')[0]!.textContent).toBe('All ProjectsEvery project✓');
    expect(results()).toEqual([
      'Coastal Residential TowersDEMO-P01',
      'coastal residential towersDEMO-P09',
      'Hospital Extension BlockDEMO-P03',
      `${LONG_NAME}PC/92-25/80117/417`,
      'Ring Road Bridge SegmentsDEMO-P02',
      'UnassignedNo project recorded',
    ]);
  });

  it('finds a project from part of its code and keeps All Projects available', async () => {
    render(<Harness />);
    await userEvent.click(trigger());
    await userEvent.type(search(), ' 80117 ');
    expect(results()).toEqual([`${LONG_NAME}PC/92-25/80117/417`]);
    expect(screen.getByRole('option', { name: /All Projects/ })).toBeTruthy();
  });

  it('says No matching projects and still offers All Projects', async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} initial="DEMO-P03" />);
    await userEvent.click(trigger());
    await userEvent.type(search(), 'zzz');
    expect(results()).toEqual([]);
    expect(screen.getByText('No matching projects')).toBeTruthy();
    await userEvent.keyboard('{Enter}'); // the pinned All Projects is the only choice
    expect(onSelect).toHaveBeenCalledWith(ALL_PROJECTS);
  });

  it('marks only the selected option with a check mark', async () => {
    render(<Harness initial="DEMO-P02" />);
    await userEvent.click(trigger());
    const options = screen.getAllByRole('option');
    expect(options.filter((o) => o.getAttribute('aria-selected') === 'true').map((o) => o.textContent)).toEqual(['Ring Road Bridge SegmentsDEMO-P02✓']);
    expect(options.filter((o) => o.textContent?.includes('✓'))).toHaveLength(1);
  });

  it('moves the keyboard option with arrows, Home and End, while hover leaves it alone', async () => {
    render(<Harness initial="DEMO-P03" />);
    await userEvent.click(trigger());
    expect(activeName()).toContain('Hospital Extension Block'); // opens on the selected project
    await userEvent.keyboard('{ArrowDown}');
    expect(activeName()).toContain(LONG_NAME);
    await userEvent.hover(screen.getByRole('option', { name: /Unassigned/ }));
    expect(activeName()).toContain(LONG_NAME);
    await userEvent.keyboard('{Home}');
    expect(activeName()).toContain('All Projects');
    await userEvent.keyboard('{End}');
    expect(activeName()).toContain('Unassigned');
  });

  it('picks with Enter and returns focus to the button', async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await userEvent.click(trigger());
    await userEvent.type(search(), 'ring{Enter}');
    expect(onSelect).toHaveBeenCalledWith('DEMO-P02');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('closes with Escape, returns focus, and opens again with an empty search', async () => {
    render(<Harness />);
    await userEvent.click(trigger());
    await userEvent.type(search(), 'hosp');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger());
    await userEvent.click(trigger());
    expect((search() as HTMLInputElement).value).toBe('');
    expect(results()).toHaveLength(6);
  });

  it('clears the search when closed by clicking elsewhere', async () => {
    render(<Harness />);
    await userEvent.click(trigger());
    await userEvent.type(search(), 'hosp');
    await userEvent.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    await userEvent.click(trigger());
    expect((search() as HTMLInputElement).value).toBe('');
  });

  it('gives a long selected name in full to assistive technology and as a tooltip', () => {
    render(<Harness initial="PC/92-25/80117/417" />);
    expect(trigger().getAttribute('aria-label')).toBe(`Project: ${LONG_NAME}`);
    expect(trigger().getAttribute('title')).toBe(LONG_NAME);
  });
});
