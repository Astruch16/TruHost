import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Property, PropertyDeletion } from '@truhost/shared';
import { ApiContext } from '../lib/api-context';
import { DeletePropertyDialog } from './delete-property-dialog';

const property = { id: 'p1', name: 'Spare Cabin', archivedAt: null } as Property;

const open = (preview: PropertyDeletion, over: Partial<Property> = {}) => {
  const onArchive = vi.fn();
  const del = vi.fn().mockResolvedValue({ data: undefined, response: new Response(null, { status: 204 }) });
  render(
    <ApiContext.Provider value={{ DELETE: del } as never}>
      <QueryClientProvider client={new QueryClient()}>
        <DeletePropertyDialog
          property={{ ...property, ...over }}
          open
          onOpenChange={vi.fn()}
          onArchive={onArchive}
          onDeleted={vi.fn()}
          preview={preview}
        />
      </QueryClientProvider>
    </ApiContext.Provider>,
  );
  return { onArchive, del, user: userEvent.setup() };
};

describe('DeletePropertyDialog', () => {
  it('explains why a property with records can’t be deleted, and offers Archive', async () => {
    const { onArchive, user } = open({ allowed: false, bookings: 14, expenses: 1, receipts: 0 });
    expect(screen.getByRole('heading', { name: 'Spare Cabin can’t be deleted' })).toBeInTheDocument();
    expect(screen.getByText(/It has 14 bookings and 1 expense\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete property' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Archive instead' }));
    expect(onArchive).toHaveBeenCalled();
  });

  it('doesn’t offer Archive for a property that’s already archived', () => {
    open({ allowed: false, bookings: 1, expenses: 0, receipts: 0 }, { archivedAt: '2026-10-01T00:00:00Z' });
    expect(screen.queryByRole('button', { name: 'Archive instead' })).toBeNull();
    expect(screen.getByText(/already archived/)).toBeInTheDocument();
  });

  it('deletes only after the name is typed exactly', async () => {
    const { del, user } = open({ allowed: true, bookings: 0, expenses: 0, receipts: 0 });
    expect(screen.getByText(/permanently deletes the property/)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Delete property' });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText('Type “Spare Cabin” to confirm'), 'Spare cabin');
    expect(button).toBeDisabled();
    await user.clear(screen.getByLabelText('Type “Spare Cabin” to confirm'));
    await user.type(screen.getByLabelText('Type “Spare Cabin” to confirm'), 'Spare Cabin');
    await user.click(button);
    expect(del).toHaveBeenCalledWith('/v1/properties/{id}', { params: { path: { id: 'p1' } } });
  });
});
