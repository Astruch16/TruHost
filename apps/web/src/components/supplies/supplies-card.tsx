import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { SUPPLY_CATEGORY_LABELS, type SupplyCategory, type SupplyItem } from '@truhost/shared';
import { Check, History, Pencil, Plus, Settings2, X } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { cx } from '../../lib/cx';
import { queries } from '../../lib/queries';
import {
  CATEGORY_ORDER,
  groupByCategory,
  LEVEL_OPTIONS,
  levelText,
  restockCount,
  suggestedSupplies,
  suppliesSummary,
  THRESHOLD_OPTIONS,
} from '../../lib/supplies';
import { SuppliesIllustration } from '../illustrations/supplies';
import { ErrorAlert, LoadError } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ConfirmDialog, Dialog } from '../ui/dialog';
import { EmptyState } from '../ui/empty-state';
import { Field } from '../ui/field';
import { Input } from '../ui/input';
import { Pill } from '../ui/pill';
import { Select } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { SupplyBar, SupplyMeta } from './supply-bar';

/**
 * - view: owners. Health bars and what needs restocking; tap a name for its history.
 * - report: cleaners. Each item also has one-tap levels (Full, ¾, ½, ¼, Empty) that save straight away.
 * - manage: admins. Report, plus add (from the common list or by name), edit, set the restock point, stop tracking,
 *   and "Restocked" for anything low.
 */
export type SuppliesMode = 'view' | 'report' | 'manage';

/**
 * A property's supplies as a card. Reaching an item's restock point (or empty) tells TruHost and the owners; the API
 * decides that, and works out each item's state, so this only shows what it returns.
 */
export function SuppliesCard({
  propertyId,
  mode,
  wide = false,
  onManage,
  className,
}: {
  propertyId: string;
  mode: SuppliesMode;
  /** Lay the items out in two columns where there's room (the card spans the page). */
  wide?: boolean;
  /** View mode for an admin: opens the editor (e.g. in a dialog). */
  onManage?: () => void;
  className?: string;
}) {
  const supplies = useQuery(queries.supplies(useApi(), propertyId));
  const items = supplies.data?.items ?? [];
  const due = restockCount(items);
  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          Supplies
          {due > 0 && <Pill tone={items.some((i) => i.state === 'OUT') ? 'danger' : 'amber'}>{due} to restock</Pill>}
        </span>
      }
      description={
        items.length === 0
          ? 'What’s kept stocked for guests, and how full it is.'
          : due > 0
            ? 'The marker on each bar is its restock point.'
            : `${suppliesSummary(items)}. The marker on each bar is its restock point.`
      }
      className={className}
      actions={
        onManage ? (
          <Button variant="secondary" size="sm" onClick={onManage}>
            <Settings2 aria-hidden className="size-4" /> Manage supplies
          </Button>
        ) : undefined
      }
    >
      <SuppliesBody propertyId={propertyId} mode={mode} wide={wide} />
    </Card>
  );
}

/** The admin editor without the card around it (for a dialog). */
export function SuppliesEditor({ propertyId }: { propertyId: string }) {
  return <SuppliesBody propertyId={propertyId} mode="manage" wide />;
}

function SuppliesBody({ propertyId, mode, wide }: { propertyId: string; mode: SuppliesMode; wide: boolean }) {
  const api = useApi();
  const qc = useQueryClient();
  const query = queries.supplies(api, propertyId);
  const supplies = useQuery(query);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [history, setHistory] = useState<SupplyItem | null>(null);

  const record = useMutation({
    mutationFn: (reading: { supplyItemId: string; levelPct: number }) =>
      unwrap(
        api.POST('/v1/properties/{id}/supply-statuses', {
          params: { path: { id: propertyId } },
          body: { readings: [{ ...reading, note: null }] },
        }),
      ),
    onSuccess: async (data) => {
      qc.setQueryData(query.queryKey, data);
      // The restock list, histories, and the bell (an admin who reports may be told too).
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['supplies'], predicate: (q) => q.queryKey[1] !== 'property' }),
        qc.invalidateQueries({ queryKey: ['me', 'notifications'] }),
      ]);
    },
  });

  if (supplies.error) {
    return <LoadError what="the supplies" onRetry={() => void supplies.refetch()} retrying={supplies.isFetching} />;
  }
  if (!supplies.data) {
    return (
      <div role="status" aria-label="Loading supplies" className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }
  const items = supplies.data.items;
  const canReport = mode !== 'view';
  const pending = record.isPending ? record.variables : undefined;

  if (items.length === 0) {
    return mode === 'manage' ? (
      <StarterSetup propertyId={propertyId} />
    ) : (
      <EmptyState size="compact" illustration={<SuppliesIllustration />} title="No supplies tracked yet">
        {mode === 'report'
          ? 'TruHost sets up the list of supplies kept here. Once it does, you can mark how full each one is.'
          : 'TruHost sets up the list of supplies kept here, then you’ll see how full each one is.'}
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {mode === 'manage' &&
        (adding ? (
          <AddSupply propertyId={propertyId} existing={items} onDone={() => setAdding(false)} />
        ) : (
          <div>
            <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
              <Plus aria-hidden className="size-4" /> Add a supply
            </Button>
          </div>
        ))}
      {groupByCategory(items).map((group) => (
        <section key={group.category} aria-label={group.label}>
          <h3 className="mb-1 text-xs font-semibold tracking-[0.08em] text-muted uppercase">{group.label}</h3>
          <ul className={cx('grid grid-cols-1', wide && 'gap-x-8 @3xl/content:grid-cols-2')}>
            {group.items.map((item) =>
              editing === item.id ? (
                <li key={item.id} className="border-b border-line-soft py-3 last:border-b-0">
                  <EditSupply item={item} existing={items} onDone={() => setEditing(null)} />
                </li>
              ) : (
                <SupplyRow
                  key={item.id}
                  item={item}
                  mode={mode}
                  pendingPct={pending?.supplyItemId === item.id ? pending.levelPct : null}
                  onReport={canReport ? (levelPct) => record.mutate({ supplyItemId: item.id, levelPct }) : undefined}
                  onEdit={mode === 'manage' ? () => setEditing(item.id) : undefined}
                  onHistory={mode === 'report' ? undefined : () => setHistory(item)}
                />
              ),
            )}
          </ul>
        </section>
      ))}
      <ErrorAlert error={record.error} />
      {history && <HistoryDialog item={history} open onOpenChange={(open) => !open && setHistory(null)} />}
    </div>
  );
}

function SupplyRow({
  item,
  mode,
  pendingPct,
  onReport,
  onEdit,
  onHistory,
}: {
  item: SupplyItem;
  mode: SuppliesMode;
  pendingPct: number | null;
  onReport?: (levelPct: number) => void;
  onEdit?: () => void;
  onHistory?: () => void;
}) {
  const due = item.state === 'LOW' || item.state === 'OUT';
  return (
    <li
      className={cx(
        'flex flex-col border-b border-line-soft last:border-b-0',
        mode === 'view' ? 'gap-1.5 py-2.5' : 'gap-2 py-3',
      )}
    >
      <div className="flex min-h-7 items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          {onHistory ? (
            <button
              type="button"
              onClick={onHistory}
              className="truncate rounded-sm text-left font-semibold text-ink underline-offset-4 hover:underline"
              aria-label={`${item.name}: history`}
            >
              {item.name}
            </button>
          ) : (
            <span className="truncate font-semibold text-ink">{item.name}</span>
          )}
          <StatePill state={item.state} />
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {mode === 'manage' && due && onReport && (
            <Button size="sm" variant="secondary" onClick={() => onReport(100)} loading={pendingPct === 100}>
              <Check aria-hidden className="size-4" /> Restocked
            </Button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${item.name}`}
              className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <Pencil aria-hidden className="size-4" />
            </button>
          )}
        </span>
      </div>
      <SupplyBar name={item.name} levelPct={item.levelPct} state={item.state} thresholdPct={item.thresholdPct} />
      <SupplyMeta levelPct={item.levelPct} lastCheckedAt={item.lastCheckedAt} thresholdPct={item.thresholdPct} />
      {onReport && (
        <LevelPicker
          name={item.name}
          current={item.levelPct}
          pendingPct={pendingPct}
          onPick={(pct) => pct !== item.levelPct && onReport(pct)}
        />
      )}
      {mode === 'report' && due && (
        <p className="text-xs font-medium text-amber-deep">
          {item.state === 'OUT' ? 'Out. ' : 'Running low. '}TruHost and the owner have been told.
        </p>
      )}
    </li>
  );
}

function StatePill({ state }: { state: SupplyItem['state'] }) {
  if (state === 'OUT') return <Pill tone="danger">Out</Pill>;
  if (state === 'LOW') return <Pill tone="amber">Running low</Pill>;
  if (state === 'UNKNOWN') return <Pill tone="neutral">Not checked</Pill>;
  return null;
}

/** Five big buttons (thumb-sized on a phone). The current level is pressed; tapping another saves it. */
function LevelPicker({
  name,
  current,
  pendingPct,
  onPick,
}: {
  name: string;
  current: number | null;
  pendingPct: number | null;
  onPick: (pct: number) => void;
}) {
  return (
    <div role="group" aria-label={`How much ${name} is left`} className="grid grid-cols-5 gap-1.5">
      {LEVEL_OPTIONS.map((o) => {
        const on = pendingPct === null ? current === o.pct : pendingPct === o.pct;
        return (
          <button
            key={o.pct}
            type="button"
            aria-pressed={on}
            aria-label={`${name}: ${o.name}`}
            disabled={pendingPct !== null}
            onClick={() => onPick(o.pct)}
            className={cx(
              'min-h-11 rounded-control-sm border text-sm font-semibold transition-colors disabled:cursor-progress',
              on
                ? o.pct === 0
                  ? 'border-danger-deep bg-danger-tint text-danger-deep'
                  : 'border-primary bg-primary text-primary-ink'
                : 'border-line bg-surface text-ink hover:bg-ground',
              pendingPct === o.pct && 'animate-pulse',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const categoryOptions = CATEGORY_ORDER.map((c) => ({ value: c, label: SUPPLY_CATEGORY_LABELS[c] }));
const thresholdOptions = (current?: number) =>
  [...new Set([...THRESHOLD_OPTIONS, ...(current === undefined ? [] : [current])])]
    .sort((a, b) => a - b)
    .map((pct) => ({ value: String(pct), label: `${pct}%` }));

/** Add one supply by name, or pick from the common ones the property doesn't track yet. */
function AddSupply({
  propertyId,
  existing,
  onDone,
}: {
  propertyId: string;
  existing: SupplyItem[];
  onDone: () => void;
}) {
  const api = useApi();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<SupplyCategory>('OTHER');
  const [threshold, setThreshold] = useState('25');
  const add = useMutation({
    mutationFn: (body: { name: string; category: SupplyCategory; thresholdPct: number }) =>
      unwrap(api.POST('/v1/properties/{id}/supplies', { params: { path: { id: propertyId } }, body })),
    onSuccess: () => {
      setName('');
      return qc.invalidateQueries({ queryKey: ['supplies'] });
    },
  });
  const suggestions = suggestedSupplies(existing);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) add.mutate({ name: name.trim(), category, thresholdPct: Number(threshold) });
  };

  return (
    <div className="flex flex-col gap-4 rounded-inner border border-line bg-ground/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-ink">Add a supply</p>
        <button
          type="button"
          onClick={onDone}
          aria-label="Close"
          className="grid size-8 place-items-center rounded-full text-muted hover:bg-ink/5 hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
      {suggestions.length > 0 && (
        <div>
          <p className="mb-2 text-sm text-muted">Common ones (tap to add):</p>
          <ul className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <li key={s.name}>
                <button
                  type="button"
                  disabled={add.isPending}
                  onClick={() => add.mutate({ name: s.name, category: s.category, thresholdPct: 25 })}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-sage-tint disabled:opacity-60"
                >
                  <Plus aria-hidden className="size-3.5" /> {s.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <form
        onSubmit={submit}
        className="grid grid-cols-1 gap-3 @xl/content:grid-cols-[minmax(0,1fr)_10rem_8rem_auto] @xl/content:items-end"
      >
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="e.g. Sugar packets"
          />
        </Field>
        <Field label="Kept in">
          <Select value={category} onValueChange={(v) => setCategory(v as SupplyCategory)} options={categoryOptions} />
        </Field>
        <Field label="Restock at">
          <Select value={threshold} onValueChange={setThreshold} options={thresholdOptions()} />
        </Field>
        <Button type="submit" loading={add.isPending} disabled={!name.trim()}>
          Add
        </Button>
      </form>
      <ErrorAlert error={add.error} />
    </div>
  );
}

function EditSupply({ item, existing, onDone }: { item: SupplyItem; existing: SupplyItem[]; onDone: () => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const formId = useId();
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<SupplyCategory>(item.category);
  const [threshold, setThreshold] = useState(String(item.thresholdPct));
  const [confirmRemove, setConfirmRemove] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.PATCH('/v1/supply-items/{id}', {
          params: { path: { id: item.id } },
          body: { name: name.trim(), category, thresholdPct: Number(threshold) },
        }),
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['supplies'] });
      onDone();
    },
  });
  const remove = useMutation({
    mutationFn: () => unwrap(api.POST('/v1/supply-items/{id}/archive', { params: { path: { id: item.id } } })),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['supplies'] });
      setConfirmRemove(false);
      onDone();
    },
  });
  const clash = existing.some((i) => i.id !== item.id && i.name.toLowerCase() === name.trim().toLowerCase());

  return (
    <form
      id={formId}
      aria-label={`Edit ${item.name}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) save.mutate();
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-1 gap-3 @xl/content:grid-cols-[minmax(0,1fr)_10rem_8rem]">
        <Field label="Name" error={clash ? 'Already on this list.' : undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
        </Field>
        <Field label="Kept in">
          <Select value={category} onValueChange={(v) => setCategory(v as SupplyCategory)} options={categoryOptions} />
        </Field>
        <Field label="Restock at">
          <Select value={threshold} onValueChange={setThreshold} options={thresholdOptions(item.thresholdPct)} />
        </Field>
      </div>
      <ErrorAlert error={save.error} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="danger" size="sm" onClick={() => setConfirmRemove(true)}>
          Stop tracking
        </Button>
        <span className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={save.isPending} disabled={!name.trim() || clash}>
            Save
          </Button>
        </span>
      </div>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Stop tracking ${item.name}?`}
        description="It leaves the list for everyone. Its past readings are kept."
        confirmLabel="Stop tracking"
        destructive
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() => remove.mutate()}
      />
    </form>
  );
}

/** First visit (admin): the common supplies, ticked, added in one go. Untick what the property doesn't keep. */
function StarterSetup({ propertyId }: { propertyId: string }) {
  const api = useApi();
  const qc = useQueryClient();
  const common = suggestedSupplies([]);
  const [picked, setPicked] = useState(() => new Set(common.map((s) => s.name)));
  const create = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/properties/{id}/supplies/bulk', {
          params: { path: { id: propertyId } },
          body: { items: common.filter((s) => picked.has(s.name)).map((s) => ({ ...s, thresholdPct: 25 })) },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplies'] }),
  });
  const toggle = (name: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <SuppliesIllustration size={72} className="shrink-0" />
        <div>
          <p className="font-semibold text-ink">Set up this property’s supplies</p>
          <p className="mt-0.5 text-sm text-muted">
            Cleaners mark how full each one is. When something reaches its restock point (25% to start), you and the
            owners are told. Untick anything this property doesn’t keep; you can add others after.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 @xl/content:grid-cols-2 @4xl/content:grid-cols-3">
        {groupByCategory(common.map((s, position) => ({ ...s, position }))).map((group) => (
          <fieldset key={group.category}>
            <legend className="mb-1.5 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
              {group.label}
            </legend>
            <div className="flex flex-col">
              {group.items.map((s) => (
                <label key={s.name} className="flex min-h-10 items-center gap-3 rounded-control-sm px-1 text-sm">
                  <input
                    type="checkbox"
                    checked={picked.has(s.name)}
                    onChange={(e) => toggle(s.name, e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <ErrorAlert error={create.error} />
      <div>
        <Button onClick={() => create.mutate()} loading={create.isPending} disabled={picked.size === 0}>
          Add {picked.size} {picked.size === 1 ? 'supply' : 'supplies'}
        </Button>
      </div>
    </div>
  );
}

function HistoryDialog({
  item,
  open,
  onOpenChange,
}: {
  item: SupplyItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const history = useQuery(queries.supplyHistory(useApi(), item.id));
  let body: ReactNode;
  if (history.error) body = <ErrorAlert error={history.error} />;
  else if (!history.data) body = <Skeleton className="h-32" />;
  else if (history.data.items.length === 0) body = <p className="text-sm text-muted">Not checked yet.</p>;
  else {
    body = (
      <ol className="flex flex-col divide-y divide-line-soft">
        {history.data.items.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-4 py-3 text-sm">
            <span className="min-w-0">
              <span className="block font-semibold text-ink">{levelText(r.levelPct)}</span>
              <span className="text-muted">
                {r.reportedBy.firstName} {r.reportedBy.lastName}
              </span>
              {r.note && <span className="mt-1 block text-ink">“{r.note}”</span>}
            </span>
            <time dateTime={r.reportedAt} className="shrink-0 text-muted">
              {new Date(r.reportedAt).toLocaleString('en-CA', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </time>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <History aria-hidden className="size-5 text-muted" /> {item.name}
        </span>
      }
      description="Every check, newest first."
    >
      {body}
    </Dialog>
  );
}
