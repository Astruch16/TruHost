import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import type { DamageReportDetail } from '@truhost/shared';
import type { ReactNode } from 'react';
import { ApiContext } from '../../lib/api-context';
import { DamageReportDialog } from './damage-report-dialog';
import { ReportDamageDialog } from './report-damage-dialog';

// Photos are resized in a canvas, which jsdom lacks: stand in for the upload-and-attach step.
const addDamagePhoto = vi.fn();
vi.mock('../../lib/damage-photo', () => ({
  DAMAGE_PHOTO_ACCEPT: 'image/jpeg',
  addDamagePhoto: (...args: unknown[]) => addDamagePhoto(...args),
}));

const ok = (data: unknown, status = 200) => Promise.resolve({ data, response: new Response(null, { status }) });

const REPORT: DamageReportDetail = {
  id: 'd1',
  property: { id: 'p1', name: 'Petersburg Retreat' },
  title: 'Burn mark on the counter',
  description: 'A pot burn mark.',
  severity: 'MODERATE',
  status: 'SUBMITTED',
  discoveredOn: '2026-10-04',
  estimatedCostCents: 40_000,
  claimReference: null,
  resolutionNote: null,
  booking: {
    id: 'b1',
    guestName: 'Jordan Guest',
    checkInDate: '2026-10-01',
    checkOutDate: '2026-10-04',
    channel: 'AIRBNB',
  },
  room: { id: 'r1', displayName: 'Kitchen' },
  reportedBy: { id: 'u2', firstName: 'Casey', lastName: 'Cleaner' },
  submittedAt: '2026-10-04T18:00:00.000Z',
  acknowledgedAt: null,
  claimFiledAt: null,
  resolvedAt: null,
  createdAt: '2026-10-04T17:00:00.000Z',
  photoCount: 1,
  coverThumbUrl: '/thumb.jpg',
  claimDeadline: '2099-10-18',
  can: { edit: false, addPhotos: true, submit: false, manage: true },
  photos: [
    {
      id: 'ph1',
      url: '/large.jpg',
      thumbUrl: '/thumb.jpg',
      expiresAt: '2026-10-04T19:00:00.000Z',
      uploadedBy: { id: 'u2', firstName: 'Casey', lastName: 'Cleaner' },
      createdAt: '2026-10-04T17:30:00.000Z',
    },
  ],
};

function renderWith(api: Partial<ApiClient>, ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ApiContext.Provider value={api as ApiClient}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </ApiContext.Provider>,
  );
}

describe('report damage', () => {
  beforeEach(() => addDamagePhoto.mockReset());

  function fakeApi() {
    const posts: { path: string; body?: unknown }[] = [];
    const GET = vi.fn((path: string) =>
      ok(
        path === '/v1/properties/{id}/damage-report-stays'
          ? {
              items: [
                {
                  id: 'b1',
                  guestName: 'Jordan Guest',
                  checkInDate: '2026-10-01',
                  checkOutDate: '2026-10-04',
                  channel: 'AIRBNB',
                },
              ],
            }
          : { items: [{ id: 'r1', displayName: 'Kitchen' }] },
      ),
    );
    const POST = vi.fn((path: string, init?: { body?: unknown }) => {
      posts.push({ path, body: init?.body });
      if (path === '/v1/properties/{id}/damage-reports') return ok({ ...REPORT, status: 'DRAFT' }, 201);
      return ok(REPORT);
    });
    return { api: { GET, POST } as unknown as ApiClient, posts };
  }

  const photo = () => new File(['x'], 'sofa.jpg', { type: 'image/jpeg' });

  it('needs what’s damaged, a description and a photo', async () => {
    const { api, posts } = fakeApi();
    renderWith(api, <ReportDamageDialog open onOpenChange={() => undefined} properties={[{ id: 'p1', name: 'A' }]} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Send report' }));
    expect(screen.getByText('Say what’s damaged')).toBeInTheDocument();
    expect(screen.getByText('Describe the damage')).toBeInTheDocument();
    expect(screen.getByText('Add at least one photo of the damage')).toBeInTheDocument();
    expect(posts).toEqual([]);
  });

  it('saves a draft blaming the likely stay, uploads the photos, then sends it', async () => {
    const { api, posts } = fakeApi();
    addDamagePhoto.mockResolvedValue(REPORT);
    const onOpenChange = vi.fn();
    renderWith(api, <ReportDamageDialog open onOpenChange={onOpenChange} properties={[{ id: 'p1', name: 'A' }]} />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/What’s damaged/), 'Burn mark on the counter');
    await user.type(screen.getByLabelText(/What happened/), 'A pot burn mark.');
    await user.click(screen.getByRole('radio', { name: /Severe/ }));
    await user.type(screen.getByPlaceholderText('$0.00'), '400');
    await user.upload(screen.getByLabelText('Add photos'), [photo(), photo()]);
    // The most recent stay is picked until someone changes it.
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /The stay/ })).toHaveTextContent(
        'Jordan Guest · Oct 1 → Oct 4 · Airbnb',
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(posts[0]).toMatchObject({
      path: '/v1/properties/{id}/damage-reports',
      body: { title: 'Burn mark on the counter', severity: 'SEVERE', bookingId: 'b1', estimatedCostCents: 40_000 },
    });
    expect(addDamagePhoto).toHaveBeenCalledTimes(2);
    expect(posts.at(-1)?.path).toBe('/v1/damage-reports/{id}/submit');
  });

  it('carries on from where it stopped when a photo fails, without a second draft', async () => {
    const { api, posts } = fakeApi();
    const failed = Object.assign(new Error('The upload failed.'), { name: 'UploadError' });
    addDamagePhoto.mockResolvedValueOnce(REPORT).mockRejectedValueOnce(failed);
    renderWith(api, <ReportDamageDialog open onOpenChange={() => undefined} properties={[{ id: 'p1', name: 'A' }]} />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/What’s damaged/), 'Broken lamp');
    await user.type(screen.getByLabelText(/What happened/), 'Cracked base.');
    await user.upload(screen.getByLabelText('Add photos'), [photo(), photo()]);
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('The upload failed.')).toBeInTheDocument();

    addDamagePhoto.mockResolvedValue(REPORT);
    await user.click(screen.getByRole('button', { name: 'Try sending again' }));
    await waitFor(() => expect(posts.at(-1)?.path).toBe('/v1/damage-reports/{id}/submit'));
    expect(posts.filter((p) => p.path === '/v1/properties/{id}/damage-reports')).toHaveLength(1);
    expect(addDamagePhoto).toHaveBeenCalledTimes(3); // the first photo once, the second twice
  });
});

describe('a damage report', () => {
  it('shows its photos, the stay, the claim window and the admin’s next step', async () => {
    const POST = vi.fn(() => ok({ ...REPORT, status: 'ACKNOWLEDGED' }));
    renderWith(
      { GET: vi.fn(() => ok(REPORT)), POST } as unknown as ApiClient,
      <DamageReportDialog reportId="d1" open onOpenChange={() => undefined} />,
    );
    expect(await screen.findByRole('link', { name: 'Open photo 1 full size' })).toHaveAttribute('href', '/large.jpg');
    expect(screen.getByText(/Jordan Guest · Oct 1 → Oct 4 · Airbnb/)).toBeInTheDocument();
    expect(screen.getByText(/File the AirCover claim by Oct 18/)).toBeInTheDocument();
    expect(screen.getByText('$400.00')).toBeInTheDocument();
    const next = screen.getByRole('region', { name: 'Next step' });
    await userEvent.type(within(next).getByLabelText(/Claim reference/), 'HMX123');
    await userEvent.click(within(next).getByRole('button', { name: 'Mark claim filed' }));
    expect(POST).toHaveBeenCalledWith('/v1/damage-reports/{id}/status', {
      params: { path: { id: 'd1' } },
      body: { status: 'CLAIM_FILED', claimReference: 'HMX123' },
    });
  });

  it('gives no next step to someone who can’t manage it (an owner)', async () => {
    renderWith(
      {
        GET: vi.fn(() => ok({ ...REPORT, can: { edit: false, addPhotos: false, submit: false, manage: false } })),
      } as unknown as ApiClient,
      <DamageReportDialog reportId="d1" open onOpenChange={() => undefined} />,
    );
    await screen.findByRole('link', { name: 'Open photo 1 full size' });
    expect(screen.queryByRole('region', { name: 'Next step' })).not.toBeInTheDocument();
    expect(screen.queryByText('Add photos')).not.toBeInTheDocument();
  });
});
