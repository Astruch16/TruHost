import { useId } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { NOTIFICATION_CATALOGUE, type NotificationSetting } from '@truhost/shared';
import { BellRing, Mail, MonitorSmartphone } from 'lucide-react';
import { ErrorAlert, LoadError } from '../ui/alert';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Switch } from '../ui/switch';
import { useApi } from '../../lib/api-context';
import { queries } from '../../lib/queries';

type Channel = 'email' | 'inApp';

/**
 * What TruHost tells this person about, by email and in the app. The categories depend on their roles (the API
 * decides). Each switch saves straight away.
 */
export function NotificationSettings() {
  const api = useApi();
  const qc = useQueryClient();
  const query = queries.notificationSettings(api);
  const settings = useQuery(query);
  const save = useMutation({
    mutationFn: (items: NotificationSetting[]) => unwrap(api.PUT('/v1/me/notification-settings', { body: { items } })),
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: query.queryKey });
      const before = qc.getQueryData(query.queryKey);
      qc.setQueryData(query.queryKey, { items });
      return { before };
    },
    onError: (_e, _items, context) => qc.setQueryData(query.queryKey, context?.before),
    onSuccess: (data) => qc.setQueryData(query.queryKey, data),
  });

  if (settings.error) {
    return (
      <LoadError what="your notifications" onRetry={() => void settings.refetch()} retrying={settings.isFetching} />
    );
  }
  if (!settings.data) return <Skeleton className="h-80 rounded-card" />;
  const items = settings.data.items;

  const toggle = (category: NotificationSetting['category'], channel: Channel, on: boolean) =>
    save.mutate(items.map((i) => (i.category === category ? { ...i, [channel]: on } : i)));

  return (
    <>
      <div className="flex items-start gap-3 rounded-card border border-blue-tint bg-blue-tint/40 p-4 text-sm">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-blue-deep">
          <BellRing aria-hidden className="size-4" />
        </span>
        <div>
          <p className="font-semibold text-blue-deep">Choose now, hear from us as each feature arrives</p>
          <p className="mt-0.5 text-blue-deep/80">
            TruHost doesn’t send notifications yet. Each one starts with the feature it’s about, using the choices you
            make here.
          </p>
        </div>
      </div>
      <Card title="Notifications" description="Pick what’s worth an email, and what can wait for the app.">
        {items.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing to set yet. Notifications appear here once you have access to a property.
          </p>
        ) : (
          <div role="table" aria-label="Notification settings">
            <div
              role="row"
              className="hidden grid-cols-[minmax(0,1fr)_5rem_5rem] gap-4 border-b border-line-soft pb-2 text-xs font-semibold text-muted @xl/content:grid"
            >
              <span role="columnheader">Notification</span>
              <span role="columnheader" className="flex items-center justify-center gap-1.5">
                <Mail aria-hidden className="size-3.5" /> Email
              </span>
              <span role="columnheader" className="flex items-center justify-center gap-1.5">
                <MonitorSmartphone aria-hidden className="size-3.5" /> In app
              </span>
            </div>
            {items.map((item) => (
              <NotificationRow key={item.category} item={item} onToggle={toggle} />
            ))}
          </div>
        )}
        <div className="mt-4">
          <ErrorAlert error={save.error} />
        </div>
      </Card>
    </>
  );
}

function NotificationRow({
  item,
  onToggle,
}: {
  item: NotificationSetting;
  onToggle: (category: NotificationSetting['category'], channel: Channel, on: boolean) => void;
}) {
  const id = useId();
  const entry = NOTIFICATION_CATALOGUE.find((c) => c.category === item.category);
  if (!entry) return null;
  const cell = (channel: Channel, label: string, Icon: typeof Mail) => (
    <span role="cell" className="flex items-center gap-2 @xl/content:justify-center">
      {entry.channels.includes(channel) ? (
        <>
          <Switch
            checked={item[channel]}
            onChange={(on) => onToggle(item.category, channel, on)}
            aria-label={`${entry.label}: ${label}`}
            aria-describedby={`${id}-desc`}
          />
          <span className="flex items-center gap-1 text-sm text-muted @xl/content:hidden">
            <Icon aria-hidden className="size-3.5" /> {label}
          </span>
        </>
      ) : (
        <span className="text-sm text-muted/70" aria-label={`${label}: not available`}>
          <span aria-hidden className="hidden @xl/content:inline">
            —
          </span>
          <span className="@xl/content:hidden">{label}: not available</span>
        </span>
      )}
    </span>
  );
  return (
    <div
      role="row"
      className="grid gap-3 border-b border-line-soft py-4 last:border-b-0 last:pb-0 @xl/content:grid-cols-[minmax(0,1fr)_5rem_5rem] @xl/content:items-center @xl/content:gap-4"
    >
      <div role="cell" className="min-w-0">
        <p id={`${id}-label`} className="font-semibold text-ink">
          {entry.label}
        </p>
        <p id={`${id}-desc`} className="mt-0.5 text-sm text-muted">
          {entry.description}
        </p>
        {!entry.live && entry.startsWith && (
          <p className="mt-1.5 inline-flex rounded-full bg-ground px-2 py-0.5 text-xs font-medium text-muted">
            Starts with {entry.startsWith}
          </p>
        )}
      </div>
      <div className="flex gap-6 @xl/content:contents">
        {cell('email', 'Email', Mail)}
        {cell('inApp', 'In app', MonitorSmartphone)}
      </div>
    </div>
  );
}
