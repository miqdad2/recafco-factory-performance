import type { ProjectOption } from '../../lib/dashboard/contracts';
import { ALL_PROJECTS, UNASSIGNED_PROJECT } from '../../lib/dashboard/projects';

const byName = (a: ProjectOption, b: ProjectOption) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || (a.code ?? '').localeCompare(b.code ?? '', 'en') || a.key.localeCompare(b.key);

/**
 * Splits the options for the selector: All Projects is pinned on its own; projects are
 * alphabetical by displayed name, with the code as a stable tie-breaker; Unassigned,
 * which is not a project, stays last.
 */
export function arrangeProjectOptions(options: readonly ProjectOption[]) {
  const all = options.find((o) => o.key === ALL_PROJECTS) ?? null;
  const unassigned = options.find((o) => o.key === UNASSIGNED_PROJECT);
  const projects = options.filter((o) => o !== all && o !== unassigned).sort(byName);
  return { all, projects: unassigned ? [...projects, unassigned] : projects };
}

/** Case-insensitive partial match on name or code; surrounding spaces are ignored. */
export function matchesProject(option: ProjectOption, query: string): boolean {
  const text = query.trim().toLowerCase();
  if (text === '') return true;
  return option.name.toLowerCase().includes(text) || (option.code?.toLowerCase().includes(text) ?? false);
}
