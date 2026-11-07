/**
 * Project attribution. A record belongs to the project written on it, and nothing
 * else: projects are never guessed from item descriptions. A missing reference is
 * "Unassigned", which stays selectable so those records are never lost.
 * Proposed rules, NOT confirmed SAP definitions; see docs/data-definitions.md.
 */
import type { ProjectOption, ProjectRecord } from './contracts';

export const ALL_PROJECTS = '__all__';
export const UNASSIGNED_PROJECT = '__unassigned__';

/** The project a recorded reference belongs to. Blank counts as missing. */
export const projectKeyOf = (code: string | null): string => code?.trim() || UNASSIGNED_PROJECT;

/** True when a record attributed to `recordKey` is inside the selected project scope. */
export const inProjectScope = (scope: string, recordKey: string): boolean => scope === ALL_PROJECTS || scope === recordKey;

/**
 * All Projects, then the project master, then any code recorded on a transaction
 * but missing from the master (shown by its code, never dropped), then Unassigned.
 */
export function buildProjectOptions(projects: readonly ProjectRecord[], recordedKeys: Iterable<string>): ProjectOption[] {
  const known = new Set(projects.map((p) => p.code));
  const unlisted = [...new Set(recordedKeys)].filter((k) => k !== UNASSIGNED_PROJECT && !known.has(k)).sort();
  return [
    { key: ALL_PROJECTS, code: null, name: 'All Projects' },
    ...projects.map((p) => ({ key: p.code, code: p.code, name: p.name })),
    ...unlisted.map((code) => ({ key: code, code, name: `Project ${code}` })),
    { key: UNASSIGNED_PROJECT, code: null, name: 'Unassigned' },
  ];
}
