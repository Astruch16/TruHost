import { useState } from 'react';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@truhost/api-client';
import { Pencil } from 'lucide-react';
import { PropertyDetailsPanel } from '../../../components/owner/details-card';
import { ManagementCard } from '../../../components/owner/management-card';
import { OwnerExpenses, OwnerStays } from '../../../components/owner/month-lists';
import { MonthOverview } from '../../../components/owner/month-overview';
import { PropertyHero } from '../../../components/owner/property-hero';
import { PropertyRoomsCard } from '../../../components/property-basics';
import { PropertyDialog } from '../../../components/property-dialog';
import { RoomsEditor } from '../../../components/rooms/rooms-card';
import { NotAvailable } from '../../../components/shell/not-available';
import { ErrorAlert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
import { Skeleton } from '../../../components/ui/skeleton';
import { isAdmin, propertyPath } from '../../../lib/access';
import { useApi } from '../../../lib/api-context';
import { monthKey } from '../../../lib/months';
import { queries } from '../../../lib/queries';

/**
 * The owner's property page: a photo banner, the month (net, gross, nights, where the money went), its stays and
 * expenses, and on the side the management fee, details and rooms. Only for owners of this property. Cleaners go to
 * their own page (/cleaner/properties/:id), which has no financial sections, and admins to the admin page; anyone
 * else sees "not available". The API enforces the same on every call. Admins who own the property can edit it and its
 * rooms here, and switch it to no fee (their own property).
 */
export const Route = createFileRoute('/_app/properties/$propertyId')({
  component: PropertyPage,
});

function PropertyPage() {
  const { propertyId } = Route.useParams();
  const me = useQuery(queries.me(useApi()));
  if (!me.data) return <PageSkeleton />;
  const path = propertyPath(me.data, propertyId);
  if (path === null) return <NotAvailable />;
  if (path !== '/properties/$propertyId') return <Navigate to={path} params={{ propertyId }} replace />;
  return <OwnerPropertyView propertyId={propertyId} admin={isAdmin(me.data)} />;
}

function OwnerPropertyView({ propertyId, admin }: { propertyId: string; admin: boolean }) {
  const api = useApi();
  const property = useQuery(queries.property(api, propertyId));
  const list = useQuery(queries.properties(api));
  const [month, setMonth] = useState(monthKey);
  const [editing, setEditing] = useState(false);
  const [editingRooms, setEditingRooms] = useState(false);

  if (property.error) {
    return property.error instanceof ApiError && property.error.status === 404 ? (
      <NotAvailable />
    ) : (
      <ErrorAlert error={property.error} />
    );
  }
  if (!property.data) return <PageSkeleton />;
  const p = property.data;
  const index = Math.max(0, list.data?.items.findIndex((x) => x.id === p.id) ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <PropertyHero
        property={p}
        index={index}
        role="OWNER"
        actions={
          admin ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditing(true)}
              className="bg-white/90 backdrop-blur"
            >
              <Pencil aria-hidden className="size-4" /> Edit details
            </Button>
          ) : null
        }
      />
      <div className="grid grid-cols-1 items-start gap-6 @[68.75rem]/content:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <MonthOverview propertyId={propertyId} month={month} onMonthChange={setMonth} />
          <div className="grid grid-cols-1 gap-6 @[100rem]/content:grid-cols-2">
            <OwnerStays propertyId={propertyId} month={month} />
            <OwnerExpenses propertyId={propertyId} month={month} />
          </div>
        </div>
        <aside className="grid min-w-0 grid-cols-1 content-start gap-6 @2xl/content:grid-cols-2 @[68.75rem]/content:grid-cols-1">
          <ManagementCard propertyId={propertyId} canMarkOwn={admin} />
          <PropertyDetailsPanel property={p} />
          <PropertyRoomsCard propertyId={propertyId} onEdit={admin ? () => setEditingRooms(true) : undefined} />
        </aside>
      </div>
      {admin && <PropertyDialog property={p} open={editing} onOpenChange={setEditing} />}
      {admin && (
        <Dialog
          open={editingRooms}
          onOpenChange={setEditingRooms}
          size="xl"
          title="Edit rooms"
          description="The walkthrough cleaners follow and owners see photos in. Changes save as you go."
        >
          {/* Lays out against the dialog's width, as it does against the page's on the admin page. */}
          <div className="@container/content">
            <RoomsEditor propertyId={propertyId} layout={p} />
          </div>
        </Dialog>
      )}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading the property" className="flex flex-col gap-6">
      <Skeleton className="h-64 rounded-card @2xl/content:h-80" />
      <Skeleton className="h-72 rounded-card" />
    </div>
  );
}
