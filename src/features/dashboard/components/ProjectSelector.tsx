import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import type { ProjectOption } from '../../../lib/dashboard/contracts';
import { arrangeProjectOptions, matchesProject } from '../projectSearch';

interface ProjectSelectorProps {
  options: ProjectOption[];
  /** The project the user chose most recently. */
  requested: string;
  /** Whether that project is still loading or has failed. */
  requestState: 'settled' | 'loading' | 'failed';
  onSelect?: (project: string) => void;
  /** Before the first successful load the selector cannot be used. */
  disabled?: boolean;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  /** Told when the list opens or closes, e.g. to hold automatic paging still. */
  onOpenChange?: (open: boolean) => void;
}

const supportingText = (option: ProjectOption) => option.code ?? (option.name === 'Unassigned' ? 'No project recorded' : 'Every project');

interface OptionRowProps {
  option: ProjectOption;
  id: string;
  selected: boolean;
  /** The keyboard's current option (aria-activedescendant). */
  active: boolean;
  onChoose: () => void;
}

/**
 * One option. Selected: check mark and a blue edge. Keyboard-current: a clear blue
 * outline. Pointer hover: a quiet background only, so it never looks chosen.
 */
function OptionRow({ option, id, selected, active, onChoose }: OptionRowProps) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      onClick={onChoose}
      className={[
        'flex min-h-[3.5rem] cursor-pointer items-center justify-between gap-3 rounded-control px-4 py-1.5 hover:bg-surface',
        selected ? 'shadow-[inset_0.25rem_0_0_0_var(--chart-blue)]' : '',
        active ? 'outline-3 -outline-offset-3 outline-chart-blue' : '',
      ].join(' ')}
    >
      {/* Long SAP names and codes wrap anywhere rather than scroll sideways. */}
      <span className="min-w-0 [overflow-wrap:anywhere]">
        <span className="block text-label leading-tight font-semibold text-ink">{option.name}</span>
        <span className="block text-support leading-tight text-ink-muted">{supportingText(option)}</span>
      </span>
      <span aria-hidden className="w-6 shrink-0 text-center text-label font-bold text-chart-blue">
        {selected ? '✓' : ''}
      </span>
    </div>
  );
}

/**
 * Large project picker. The closed button always names the chosen project; a name too
 * long for it ends in an ellipsis, with the full name in its accessible name and tooltip.
 * Opening it moves focus to a search box that filters by name or code. All Projects stays
 * pinned above the scrolling results, even while searching. Arrow keys, Home and End move,
 * Enter picks, Escape closes; closing always clears the search and returns focus.
 */
export function ProjectSelector({ options, requested, requestState, onSelect, disabled, triggerRef, onOpenChange }: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const localTriggerRef = useRef<HTMLButtonElement>(null);
  const buttonRef = triggerRef ?? localTriggerRef;
  const listId = useId();

  const { all, projects } = useMemo(() => arrangeProjectOptions(options), [options]);
  const results = useMemo(() => projects.filter((o) => matchesProject(o, search)), [projects, search]);
  // Keyboard order: the pinned All Projects first, then the visible results.
  const navigable = useMemo(() => (all ? [all, ...results] : results), [all, results]);
  const active = navigable[Math.min(activeIndex, navigable.length - 1)];
  const selected = options.find((o) => o.key === requested);
  const marker = requestState === 'loading' ? '…' : requestState === 'failed' ? ' !' : '';
  const optionId = (option: ProjectOption) => `${listId}-${option.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', closeOnOutsidePress);
    return () => document.removeEventListener('mousedown', closeOnOutsidePress);
  }, [open]);

  // Reports the open list to the screen, and "closed" again on close or unmount.
  useEffect(() => {
    if (!open) return;
    onOpenChange?.(true);
    return () => onOpenChange?.(false);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open && active) document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
  });

  const close = (returnFocus: boolean) => {
    setOpen(false);
    setSearch('');
    if (returnFocus) buttonRef.current?.focus();
  };

  const choose = (option: ProjectOption) => {
    onSelect?.(option.key);
    close(true);
  };

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    const last = navigable.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, activeIndex + 1),
      ArrowUp: Math.max(0, activeIndex - 1),
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActiveIndex(Math.max(0, moves[event.key]!));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (active) choose(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  const toggle = () => {
    if (open) return close(true);
    setSearch('');
    setActiveIndex(Math.max(0, (all ? [all, ...projects] : projects).findIndex((o) => o.key === requested)));
    setOpen(true);
  };

  const name = selected?.name ?? 'All Projects';

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Project: ${name}`}
        title={name}
        onClick={toggle}
        className={[
          'flex h-full w-[24rem] max-w-full items-center justify-between gap-3 rounded-panel border bg-surface px-5 py-1 text-left motion-safe:transition-colors motion-safe:duration-200 disabled:cursor-not-allowed',
          requestState === 'settled' ? 'border-line hover:bg-raised' : 'border-accent',
        ].join(' ')}
      >
        <span className="min-w-0">
          <span className="block text-support leading-tight text-ink-muted">Project</span>
          <span className="block truncate text-label leading-tight font-bold text-ink">
            {name}
            <span aria-hidden>{marker}</span>
          </span>
        </span>
        <span aria-hidden className="text-label text-ink-muted">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-30 mt-2 flex w-[30rem] max-w-[calc(100vw-3rem)] flex-col rounded-panel border-2 border-line bg-raised p-3 shadow-panel">
          <input
            autoFocus
            type="search"
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active ? optionId(active) : undefined}
            aria-label="Search projects by name or code"
            placeholder="Search name or code"
            value={search}
            onChange={(event) => {
              const next = event.target.value;
              setSearch(next);
              // Typing puts the keyboard on the first match, so Enter picks what was searched
              // for; with no match (or no text) it rests on the pinned All Projects.
              const hasMatch = next.trim() !== '' && projects.some((o) => matchesProject(o, next));
              setActiveIndex(hasMatch && all ? 1 : 0);
            }}
            onKeyDown={onSearchKey}
            className="w-full rounded-control border-2 border-line bg-surface px-4 py-2.5 text-label text-ink placeholder:text-ink-muted"
          />
          <div id={listId} role="listbox" aria-label="Projects" className="mt-2 flex min-h-0 flex-col">
            {all && <OptionRow option={all} id={optionId(all)} selected={all.key === requested} active={all === active} onChoose={() => choose(all)} />}
            {/* Only the project results scroll; the list stays inside the viewport. */}
            <div role="group" aria-label="Matching projects" className="mt-1 max-h-[min(26rem,calc(100dvh-16rem))] overflow-x-hidden overflow-y-auto border-t border-line pt-1">
              {results.map((option) => (
                <OptionRow
                  key={option.key}
                  option={option}
                  id={optionId(option)}
                  selected={option.key === requested}
                  active={option === active}
                  onChoose={() => choose(option)}
                />
              ))}
            </div>
          </div>
          {results.length === 0 && <p className="px-4 py-3 text-label text-ink-muted">No matching projects</p>}
        </div>
      )}
    </div>
  );
}
