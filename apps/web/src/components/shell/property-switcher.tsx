import { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cx } from '../../lib/cx';
import { initials } from '../../lib/nav';

export interface SwitcherProperty {
  id: string;
  name: string;
  city: string;
  province: string;
}

const avatar = (name: string) => {
  const [a = '', b = ''] = name.split(/\s+/);
  return initials(a, b || a.slice(1));
};

/** Pill button that opens a searchable list of the properties this user can see. */
export function PropertySwitcher({
  properties,
  selectedId,
  onSelect,
}: {
  properties: SwitcherProperty[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = properties.find((p) => p.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? properties.filter((p) => `${p.name} ${p.city}`.toLowerCase().includes(q)) : properties;
  }, [properties, query]);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <Popover.Trigger
        className={cx(
          'flex min-h-12 w-full max-w-xs items-center gap-3 rounded-full border border-line bg-surface py-1.5 pr-4 pl-1.5 text-left',
          'transition-[border-color,box-shadow] hover:border-ink/25 data-[state=open]:border-ink/25 data-[state=open]:shadow-sm',
        )}
        aria-label={selected ? `Property: ${selected.name}. Switch property` : 'Choose a property'}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-tint text-xs font-bold text-blue-deep">
          {selected ? avatar(selected.name) : '—'}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate font-semibold text-ink">{selected?.name ?? 'Choose a property'}</span>
          {selected && (
            <span className="block truncate text-xs text-muted">
              {selected.city}, {selected.province}
            </span>
          )}
        </span>
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          className="z-50 w-[min(22rem,calc(100vw-2rem))] rounded-inner border border-line bg-surface p-2 shadow-xl animate-pop-in focus:outline-none"
        >
          <label className="relative mb-1 block">
            <span className="sr-only">Search properties</span>
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search properties"
              className="min-h-10 w-full rounded-control-sm bg-ground pr-3 pl-9 text-sm placeholder:text-muted/80 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-blue-deep"
            />
          </label>
          <ul aria-label="Properties" className="max-h-72 overflow-y-auto">
            {filtered.map((p) => {
              const isSelected = p.id === selectedId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-current={isSelected || undefined}
                    onClick={() => {
                      onSelect(p.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className="flex min-h-11 w-full items-center gap-3 rounded-control-sm px-2 text-left transition-colors hover:bg-ground focus-visible:bg-ground focus-visible:outline-none"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-tint text-[0.7rem] font-bold text-blue-deep">
                      {avatar(p.name)}
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {p.city}, {p.province}
                      </span>
                    </span>
                    {isSelected && <Check aria-label="Selected" className="size-4 shrink-0 text-sage-deep" />}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-2 py-6 text-center text-sm text-muted">No matching properties</li>
            )}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
