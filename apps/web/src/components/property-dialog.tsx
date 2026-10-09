import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import type { Property } from '@truhost/shared';
import { useApi } from '../lib/api-context';
import { emptyProperty, propertyToFormValues, type PropertyFormValues } from '../lib/property-values';
import { queries } from '../lib/queries';
import { PropertyForm } from './property-form';
import { Dialog } from './ui/dialog';

/** Add a property, or edit one (from its card or its page). */
export function PropertyDialog({
  property,
  open,
  onOpenChange,
  onCreated,
}: {
  /** The property to edit; leave out to add a new one. */
  property?: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (property: Property) => void;
}) {
  const api = useApi();
  const qc = useQueryClient();
  const editing = Boolean(property);
  const save = useMutation({
    mutationFn: (body: PropertyFormValues) =>
      property
        ? unwrap(api.PATCH('/v1/properties/{id}', { params: { path: { id: property.id } }, body }))
        : unwrap(api.POST('/v1/properties', { body })),
    onSuccess: async (saved) => {
      qc.setQueryData(queries.property(api, saved.id).queryKey, saved);
      await qc.invalidateQueries({ queryKey: ['properties'] });
      onOpenChange(false);
      if (!editing) onCreated?.(saved);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (save.isPending) return;
        if (!next) save.reset();
        onOpenChange(next);
      }}
      size="xl"
      title={property ? `Edit ${property.name}` : 'New property'}
      description={
        property
          ? 'Changes apply straight away. Past bookings and statements keep their figures.'
          : 'Add the basics now; you can fill in the rest later.'
      }
    >
      <PropertyForm
        key={property?.id ?? 'new'}
        initial={property ? propertyToFormValues(property) : emptyProperty}
        submitLabel={property ? 'Save changes' : 'Create property'}
        pending={save.isPending}
        error={save.error}
        onSubmit={(v) => save.mutate(v)}
        onCancel={() => onOpenChange(false)}
      />
    </Dialog>
  );
}
