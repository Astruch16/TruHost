import { useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { ROOM_TYPE_LABELS, roomTypeNeedsLabel, type Room } from '@truhost/shared';
import { Check, GripVertical, Minus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { cx } from '../../lib/cx';
import { queries } from '../../lib/queries';
import {
  LABEL_PLACEHOLDER,
  MAX_PER_TYPE,
  previewRoomName,
  quickSetupCounts,
  reorderedRooms,
  ROOM_ICONS,
  ROOM_TYPES,
  roomsFromCounts,
  type RoomCounts,
  type RoomType,
} from '../../lib/rooms';
import { ErrorAlert } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ConfirmDialog } from '../ui/dialog';
import { Field } from '../ui/field';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';

/**
 * The rooms of a property, in walkthrough order (admin). An empty property starts with quick setup: a count per type
 * and one button. After that: add a room (type chips, optional label), and per room: edit its type and label,
 * delete it (archive), or drag it to a new place (also with the keyboard: Space to pick up, arrows, Space to drop).
 * Names come from the API; the previews here use the same rule (roomDisplayNames in shared).
 */
export function RoomsCard({
  propertyId,
  layout,
}: {
  propertyId: string;
  /** The property's layout fields, to start quick setup with its bedroom and bathroom counts. */
  layout: { bedrooms: number | null; bathrooms: number | null; halfBathrooms: number | null };
}) {
  const api = useApi();
  const qc = useQueryClient();
  // Deleted rooms too: they keep their numbers, so previews of a new room's name match what the API will give.
  const query = queries.rooms(api, propertyId, true);
  const rooms = useQuery(query);
  const [deleting, setDeleting] = useState<Room | null>(null);
  const all = rooms.data?.items ?? [];
  const items = all.filter((r) => !r.archivedAt);
  const refresh = () => qc.invalidateQueries({ queryKey: ['properties', propertyId, 'rooms'] });

  const reorder = useMutation({
    mutationFn: (roomIds: string[]) =>
      unwrap(api.PUT('/v1/properties/{id}/rooms/order', { params: { path: { id: propertyId } }, body: { roomIds } })),
    onMutate: async (roomIds) => {
      await qc.cancelQueries({ queryKey: query.queryKey });
      const before = qc.getQueryData(query.queryKey);
      if (before) {
        // Show the new order straight away (names don't change: they come from each room's own number).
        const byId = new Map(before.items.map((r) => [r.id, r]));
        const moved = reorderedRooms(
          roomIds.map((id) => byId.get(id)!),
          0,
          0,
        );
        qc.setQueryData(query.queryKey, { ...before, items: [...moved, ...before.items.filter((r) => r.archivedAt)] });
      }
      return { before };
    },
    onError: (_e, _ids, context) => context?.before && qc.setQueryData(query.queryKey, context.before),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/v1/rooms/{id}/archive', { params: { path: { id } } })),
    onSuccess: async () => {
      await refresh();
      setDeleting(null);
    },
  });

  return (
    <Card
      title="Rooms"
      description="The walkthrough: cleaners photograph rooms in this order, and owners see photos the same way."
    >
      {rooms.error ? (
        <ErrorAlert error={rooms.error} />
      ) : !rooms.data ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="flex flex-col gap-5">
          {items.length === 0 ? (
            <QuickSetup propertyId={propertyId} layout={layout} onDone={refresh} />
          ) : (
            <RoomList
              rooms={items}
              allRooms={all}
              onReorder={(ids) => reorder.mutate(ids)}
              onDelete={setDeleting}
              onSaved={refresh}
            />
          )}
          <ErrorAlert error={reorder.error} />
          <AddRoom propertyId={propertyId} rooms={all} first={items.length === 0} onAdded={refresh} />
        </div>
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.displayName ?? 'room'}?`}
        description="It leaves the walkthrough, and the rooms after it move up. Photos already taken in it are kept."
        confirmLabel="Delete room"
        destructive
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </Card>
  );
}

// ── Quick setup ──

function QuickSetup({
  propertyId,
  layout,
  onDone,
}: {
  propertyId: string;
  layout: { bedrooms: number | null; bathrooms: number | null; halfBathrooms: number | null };
  onDone: () => void;
}) {
  const api = useApi();
  const [counts, setCounts] = useState<RoomCounts>(() => quickSetupCounts(layout));
  const planned = roomsFromCounts(counts);
  const create = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/properties/{id}/rooms/bulk', { params: { path: { id: propertyId } }, body: { rooms: planned } }),
      ),
    onSuccess: onDone,
  });
  const set = (type: RoomType, n: number) => setCounts({ ...counts, [type]: Math.min(MAX_PER_TYPE, Math.max(0, n)) });

  return (
    <section
      aria-labelledby="quick-setup"
      className="rounded-inner border border-line bg-ground/60 p-4 @2xl/content:p-5"
    >
      <h3 id="quick-setup" className="font-semibold text-ink">
        Quick setup
      </h3>
      <p className="mt-0.5 text-sm text-muted">
        How many of each? They’re created in this order, and you can rename, reorder or delete any of them after.
      </p>
      <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,14.5rem),1fr))] gap-2">
        {ROOM_TYPES.filter((t) => !roomTypeNeedsLabel(t)).map((type) => (
          <li key={type}>
            <Counter type={type} value={counts[type]} onChange={(n) => set(type, n)} />
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
        <p className="text-sm text-muted" aria-live="polite">
          {planned.length === 0
            ? 'Nothing to create yet.'
            : `${planned.length} room${planned.length === 1 ? '' : 's'} will be created.`}
        </p>
        <Button onClick={() => create.mutate()} loading={create.isPending} disabled={planned.length === 0}>
          Create rooms
        </Button>
      </div>
      {create.error ? (
        <div className="mt-3">
          <ErrorAlert error={create.error} />
        </div>
      ) : null}
    </section>
  );
}

function Counter({ type, value, onChange }: { type: RoomType; value: number; onChange: (n: number) => void }) {
  const Icon = ROOM_ICONS[type];
  const name = ROOM_TYPE_LABELS[type];
  const id = useId();
  const stepper =
    'grid size-9 place-items-center rounded-full border border-line bg-surface text-ink transition-colors hover:border-ink/30 disabled:opacity-35 disabled:hover:border-line';
  return (
    <div
      role="group"
      aria-labelledby={id}
      className={cx(
        'flex items-center gap-3 rounded-inner border bg-surface py-2 pr-2 pl-3 transition-colors',
        value > 0 ? 'border-sage-deep/30' : 'border-line-soft',
      )}
    >
      <Icon aria-hidden className={cx('size-5 shrink-0', value > 0 ? 'text-sage-deep' : 'text-muted')} />
      <span id={id} className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
        {name}
      </span>
      <button
        type="button"
        aria-label={`One fewer ${name.toLowerCase()}`}
        className={stepper}
        disabled={value === 0}
        onClick={() => onChange(value - 1)}
      >
        <Minus aria-hidden className="size-4" />
      </button>
      <output
        aria-live="polite"
        aria-label={`${name}: ${value}`}
        className="figure w-6 text-center font-semibold text-ink"
      >
        {value}
      </output>
      <button
        type="button"
        aria-label={`One more ${name.toLowerCase()}`}
        className={stepper}
        disabled={value === MAX_PER_TYPE}
        onClick={() => onChange(value + 1)}
      >
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  );
}

// ── Add one room ──

function AddRoom({
  propertyId,
  rooms,
  first,
  onAdded,
}: {
  propertyId: string;
  rooms: Room[];
  first: boolean;
  onAdded: () => void;
}) {
  const api = useApi();
  const [type, setType] = useState<RoomType>('BEDROOM');
  const [label, setLabel] = useState('');
  const [open, setOpen] = useState(false);
  const preview = previewRoomName(rooms, { type, label });
  const add = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/properties/{id}/rooms', {
          params: { path: { id: propertyId } },
          body: { type, label: label.trim() || null },
        }),
      ),
    onSuccess: () => {
      setLabel('');
      onAdded();
    },
  });
  const blocked = preview.needsLabel || preview.clash !== null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!blocked) add.mutate();
  };

  if (!open) {
    return (
      <div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <Plus aria-hidden className="size-4" /> {first ? 'Or add one room' : 'Add a room'}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-inner border border-line p-4 @2xl/content:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-ink">Add a room</h3>
        <Button variant="quiet" size="sm" aria-label="Close" className="px-2" onClick={() => setOpen(false)}>
          <X aria-hidden className="size-4" />
        </Button>
      </div>
      <TypeChips value={type} onChange={setType} />
      <Field
        label="Label"
        hint={
          roomTypeNeedsLabel(type) ? 'Required for Other: what is this room?' : 'Tells rooms of the same type apart.'
        }
      >
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={roomTypeNeedsLabel(type) ? 'e.g. Wine cellar, Bunk room' : LABEL_PLACEHOLDER}
          maxLength={60}
          autoComplete="off"
        />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <NamePreview preview={preview} verb="Adds" />
        <Button type="submit" loading={add.isPending} disabled={blocked}>
          <Plus aria-hidden className="size-4" /> Add room
        </Button>
      </div>
      <ErrorAlert error={add.error} />
    </form>
  );
}

/** "Adds Bedroom 3", or why it can't be added yet. */
function NamePreview({ preview, verb }: { preview: ReturnType<typeof previewRoomName>; verb: string }) {
  return (
    <p aria-live="polite" className="text-sm">
      {preview.needsLabel ? (
        <span className="text-muted">Give an “Other” room a name.</span>
      ) : preview.clash ? (
        <span className="text-danger-deep">
          There’s already a room called “{preview.clash}”. Use a different label.
        </span>
      ) : (
        <span className="text-muted">
          {verb} <strong className="font-semibold text-ink">{preview.name}</strong>
        </span>
      )}
    </p>
  );
}

/** Room types as chips with icons: a radio group (arrow keys move, picking is immediate). */
function TypeChips({
  value,
  onChange,
  compact = false,
}: {
  value: RoomType;
  onChange: (t: RoomType) => void;
  compact?: boolean;
}) {
  const group = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = ROOM_TYPES[(ROOM_TYPES.indexOf(value) + step + ROOM_TYPES.length) % ROOM_TYPES.length]!;
    onChange(next);
    group.current?.querySelector<HTMLButtonElement>(`[data-type="${next}"]`)?.focus();
  };
  return (
    <div ref={group} role="radiogroup" aria-label="Room type" onKeyDown={onKey} className="flex flex-wrap gap-1.5">
      {ROOM_TYPES.map((t) => {
        const Icon = ROOM_ICONS[t];
        const selected = t === value;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            data-type={t}
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t)}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-deep',
              compact ? 'min-h-8 px-2.5 text-xs' : 'min-h-9 px-3 text-sm',
              selected
                ? 'border-primary bg-primary text-white'
                : 'border-line bg-surface text-ink hover:border-ink/25 hover:bg-ground',
            )}
          >
            <Icon aria-hidden className={compact ? 'size-3.5' : 'size-4'} />
            {ROOM_TYPE_LABELS[t]}
          </button>
        );
      })}
    </div>
  );
}

// ── The list ──

function RoomList({
  rooms,
  allRooms,
  onReorder,
  onDelete,
  onSaved,
}: {
  /** Active rooms, in walkthrough order. */
  rooms: Room[];
  /** Deleted ones too, for name previews (they hold their numbers). */
  allRooms: Room[];
  onReorder: (ids: string[]) => void;
  onDelete: (room: Room) => void;
  onSaved: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const nameOf = (id: string | number) => rooms.find((r) => r.id === id)?.displayName ?? 'Room';
  const placeOf = (id: string | number) => rooms.findIndex((r) => r.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}, position ${placeOf(active.id)} of ${rooms.length}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is now at position ${placeOf(over.id)} of ${rooms.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} dropped at position ${placeOf(over.id)} of ${rooms.length}.`
        : `${nameOf(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} cancelled. It stays at position ${placeOf(active.id)}.`,
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = rooms.findIndex((r) => r.id === active.id);
    const to = rooms.findIndex((r) => r.id === over.id);
    onReorder(reorderedRooms(rooms, from, to).map((r) => r.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'To move a room, press Space to pick it up, the up and down arrows to move it, then Space to drop it, or Escape to cancel.',
        },
      }}
    >
      <SortableContext items={rooms.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <ol aria-label="Rooms in walkthrough order" className="flex flex-col gap-1.5">
          {rooms.map((room, i) => (
            <SortableRoom
              key={room.id}
              room={room}
              index={i}
              rooms={allRooms}
              onDelete={() => onDelete(room)}
              onSaved={onSaved}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRoom({
  room,
  index,
  rooms,
  onDelete,
  onSaved,
}: {
  room: Room;
  index: number;
  rooms: Room[];
  onDelete: () => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: room.id,
    disabled: editing,
  });
  const Icon = ROOM_ICONS[room.type];

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx(
        'rounded-inner border bg-surface',
        isDragging ? 'relative z-10 border-sage-deep/40 shadow-lg' : 'border-line-soft',
      )}
    >
      {editing ? (
        <RoomEditor
          room={room}
          rooms={rooms}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onSaved();
          }}
        />
      ) : (
        <div className="flex items-center gap-2 py-1.5 pr-1.5 pl-1">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${room.displayName}`}
            className="grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-control-sm text-muted hover:bg-ground hover:text-ink focus-visible:outline-2 focus-visible:outline-blue-deep active:cursor-grabbing"
          >
            <GripVertical aria-hidden className="size-4" />
          </button>
          <span className="figure grid size-6 shrink-0 place-items-center rounded-full bg-ground text-xs font-semibold text-muted">
            {index + 1}
          </span>
          <Icon aria-hidden className="size-4 shrink-0 text-sage-deep" />
          <span className="min-w-0 flex-1 py-1 text-sm font-medium [overflow-wrap:anywhere] text-ink">
            {/* Keep the dot with the label when the name wraps: "Bedroom / · Primary". */}
            {room.displayName.replace(' · ', ' ·\u00a0')}
          </span>
          <IconButton label={`Edit ${room.displayName}`} onClick={() => setEditing(true)}>
            <Pencil aria-hidden className="size-4" />
          </IconButton>
          <IconButton label={`Delete ${room.displayName}`} onClick={onDelete} danger>
            <Trash2 aria-hidden className="size-4" />
          </IconButton>
        </div>
      )}
    </li>
  );
}

function IconButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cx(
        'grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors focus-visible:outline-2 focus-visible:outline-blue-deep',
        danger ? 'hover:bg-danger-tint hover:text-danger-deep' : 'hover:bg-ground hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

/** Inline edit: change the type and the label. Enter saves, Escape cancels. */
function RoomEditor({
  room,
  rooms,
  onClose,
  onSaved,
}: {
  room: Room;
  rooms: Room[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useApi();
  const [type, setType] = useState<RoomType>(room.type);
  const [label, setLabel] = useState(room.label ?? '');
  const preview = previewRoomName(rooms, { id: room.id, type, label });
  const changed = type !== room.type || (label.trim() || null) !== room.label;
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.PATCH('/v1/rooms/{id}', { params: { path: { id: room.id } }, body: { type, label: label.trim() || null } }),
      ),
    onSuccess: onSaved,
  });
  const blocked = preview.needsLabel || preview.clash !== null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!changed) onClose();
    else if (!blocked) save.mutate();
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), onClose())}
      aria-label={`Edit ${room.displayName}`}
      className="flex flex-col gap-3 p-3"
    >
      <TypeChips value={type} onChange={setType} compact />
      <div className="flex flex-col gap-2 @xl/content:flex-row @xl/content:items-center">
        <label className="sr-only" htmlFor={`label-${room.id}`}>
          Label
        </label>
        <Input
          id={`label-${room.id}`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={roomTypeNeedsLabel(type) ? 'e.g. Wine cellar, Bunk room' : LABEL_PLACEHOLDER}
          maxLength={60}
          autoComplete="off"
          autoFocus
          className="@xl/content:flex-1"
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" loading={save.isPending} disabled={changed && blocked}>
            <Check aria-hidden className="size-4" /> Save
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
        </div>
      </div>
      {changed && <NamePreview preview={preview} verb="Will be" />}
      <ErrorAlert error={save.error} />
    </form>
  );
}
