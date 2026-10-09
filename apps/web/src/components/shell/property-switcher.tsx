import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { cx } from '../../lib/cx';
import { monogram, TINTS } from '../../lib/dashboard-format';
import { menuSurfaceStyles } from '../../lib/styles';
import { CoverImage } from '../cover-image';

export interface SwitcherProperty {
  id: string;
  name: string;
  city: string;
  province: string;
  /** Card-sized cover photo (signed link), or null for none. */
  photoUrl?: string | null;
}

/** The property's cover photo, or its initials on the tint it has on property cards. */
function Thumb({ property, index, className }: { property: SwitcherProperty; index: number; className?: string }) {
  const tint = TINTS[index % TINTS.length]!;
  return (
    <span className={cx('relative grid shrink-0 place-items-center overflow-hidden', tint.bg, className)}>
      <CoverImage
        url={property.photoUrl}
        alt=""
        className="absolute inset-0 size-full"
        fallback={
          <span aria-hidden className={cx('text-[0.7rem] font-bold tracking-tight', tint.fg)}>
            {monogram(property.name)}
          </span>
        }
      />
    </span>
  );
}

/** "All properties": up to three photos in an overlapping row. */
function AllThumb({ properties, small = false }: { properties: SwitcherProperty[]; small?: boolean }) {
  const shown = properties.slice(0, 3);
  // Three photos fit the same 56px column as a property's thumbnail (46px in the button).
  const step = small ? 11 : 14;
  const size = small ? 24 : 28;
  return (
    <span
      aria-hidden
      className="relative shrink-0"
      style={{ width: size + step * Math.max(0, shown.length - 1), height: size }}
    >
      {shown.map((p, i) => (
        <span key={p.id} className="absolute top-0" style={{ left: i * step, zIndex: shown.length - i }}>
          <Thumb
            property={p}
            index={i}
            className={cx('rounded-lg ring-2 ring-surface', small ? 'size-6 rounded-md' : 'size-7')}
          />
        </span>
      ))}
    </span>
  );
}

const rowClass = cx(
  'group relative flex w-full items-center gap-3 rounded-xl p-2 text-left outline-none',
  'transition-[background-color,box-shadow] duration-150 ease-out',
  'hover:bg-sage-tint/50 focus-visible:bg-sage-tint/60 focus-visible:shadow-[inset_0_0_0_2px_var(--color-sage-deep)]',
  'aria-[current=true]:bg-sage-tint/70',
);

/**
 * The property switcher: a pill showing the current property (photo, name, place) that opens a searchable panel
 * of every property this user can see, each with its cover photo. Admins also get "All properties" and a link to
 * manage them. Arrow keys move through the list; Enter picks.
 */
export function PropertySwitcher({
  properties,
  selectedId,
  onSelect,
  allowAll = false,
}: {
  properties: SwitcherProperty[];
  selectedId: string | null;
  /** null = all properties (only when `allowAll`). */
  onSelect: (id: string | null) => void;
  allowAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedIndex = properties.findIndex((p) => p.id === selectedId);
  const selected = selectedIndex === -1 ? null : properties[selectedIndex]!;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return properties
      .map((p, index) => ({ p, index }))
      .filter(({ p }) => !q || `${p.name} ${p.city} ${p.province}`.toLowerCase().includes(q));
  }, [properties, query]);
  const showAll = allowAll && !query.trim();
  const count = `${properties.length} propert${properties.length === 1 ? 'y' : 'ies'}`;

  const pick = (id: string | null) => {
    onSelect(id);
    setOpen(false);
    setQuery('');
  };

  /** Up and down move between rows (and back to the search box from the top). */
  const onListKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-row]') ?? [])];
    if (rows.length === 0) return;
    e.preventDefault();
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') rows[at === -1 ? 0 : Math.min(at + 1, rows.length - 1)]!.focus();
    else if (at <= 0) inputRef.current?.focus();
    else rows[at - 1]!.focus();
  };

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
          'group flex min-h-12 w-full max-w-xs items-center gap-3 rounded-full border border-line bg-surface py-1.5 pr-4 pl-1.5 text-left',
          'transition-[border-color,box-shadow] duration-150 hover:border-ink/25 hover:shadow-sm',
          'data-[state=open]:border-sage-deep/40 data-[state=open]:shadow-[0_0_0_4px_rgba(35,68,47,0.08)]',
        )}
        aria-label={
          selected
            ? `Property: ${selected.name}. Switch property`
            : allowAll
              ? 'All properties. Switch property'
              : 'Choose a property'
        }
      >
        {selected ? (
          <Thumb property={selected} index={selectedIndex} className="size-9 rounded-full" />
        ) : allowAll && properties.length > 0 ? (
          <span className="grid h-9 shrink-0 place-items-center pl-1">
            <AllThumb properties={properties} small />
          </span>
        ) : (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-line-soft text-muted">—</span>
        )}
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate font-semibold text-ink">
            {selected?.name ?? (allowAll ? 'All properties' : 'Choose a property')}
          </span>
          <span className="block truncate text-xs text-muted">
            {selected ? `${selected.city}, ${selected.province}` : allowAll ? count : ''}
          </span>
        </span>
        <ChevronsUpDown
          aria-hidden
          className="size-4 shrink-0 text-muted transition-colors group-hover:text-ink group-data-[state=open]:text-sage-deep"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className={cx(menuSurfaceStyles, 'flex w-[min(26rem,calc(100vw-2rem))] flex-col p-0 focus:outline-none')}
          onKeyDown={onListKey}
        >
          <div className="flex items-baseline justify-between px-4 pt-3.5 pb-2">
            <p className="text-sm font-semibold text-ink">Switch property</p>
            <p className="text-xs text-muted">{count}</p>
          </div>
          <div className="px-3 pb-2">
            <label className="relative block">
              <span className="sr-only">Search properties</span>
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
              />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or town"
                className="min-h-11 w-full rounded-xl border border-transparent bg-ground pr-10 pl-9 text-sm transition-colors placeholder:text-muted/80 focus-visible:border-sage-deep/40 focus-visible:bg-surface focus-visible:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-line-soft hover:text-ink"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              )}
            </label>
          </div>

          <ul
            ref={listRef}
            aria-label="Properties"
            className="flex max-h-[min(22rem,60vh)] flex-col gap-0.5 overflow-y-auto px-2 pb-2"
          >
            {showAll && (
              <li>
                <button
                  type="button"
                  data-row
                  aria-current={selectedId === null || undefined}
                  onClick={() => pick(null)}
                  className={rowClass}
                >
                  <span className="grid h-10 w-14 shrink-0 place-items-center">
                    <AllThumb properties={properties} />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-semibold text-ink">All properties</span>
                    <span className="block truncate text-xs text-muted">The whole portfolio · {count}</span>
                  </span>
                  <SelectedMark show={selectedId === null} />
                </button>
              </li>
            )}
            {showAll && filtered.length > 0 && <li aria-hidden className="mx-2 my-1 h-px bg-line-soft" />}
            {filtered.map(({ p, index }) => (
              <li key={p.id}>
                <button
                  type="button"
                  data-row
                  aria-current={p.id === selectedId || undefined}
                  onClick={() => pick(p.id)}
                  className={rowClass}
                >
                  <Thumb property={p} index={index} className="h-10 w-14 rounded-lg" />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {p.city}, {p.province}
                    </span>
                  </span>
                  <SelectedMark show={p.id === selectedId} />
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-8 text-center">
                <p className="text-sm font-semibold text-ink">No properties match “{query.trim()}”</p>
                <p className="mt-1 text-xs text-muted">Try a property name or a town.</p>
              </li>
            )}
          </ul>

          {allowAll && (
            <div className="border-t border-line-soft p-2">
              <Link
                to="/admin/properties"
                onClick={() => setOpen(false)}
                className="flex min-h-10 items-center justify-between rounded-xl px-3 text-sm font-semibold text-sage-deep transition-colors hover:bg-sage-tint/50 focus-visible:bg-sage-tint/60 focus-visible:outline-none"
              >
                Manage properties
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SelectedMark({ show }: { show: boolean }) {
  if (!show) return <span className="size-6 shrink-0" />;
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sage-deep text-white">
      <Check aria-label="Selected" className="size-3.5" strokeWidth={3} />
    </span>
  );
}
