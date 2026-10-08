import { useState } from 'react';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { ApiError } from '@truhost/api-client';
import { CoverPhotoCard } from '../../components/cover-photo-card';
import { KpiCard, KpiMoney, KpiOf } from '../../components/dashboard/kpi-card';
import { NightlyRange, NightsStrip, ShareBar, StaysBar } from '../../components/dashboard/kpi-charts';
import { AllClearIllustration } from '../../components/illustrations/all-clear';
import { BookingsIllustration } from '../../components/illustrations/bookings';
import { ComingUpIllustration } from '../../components/illustrations/coming-up';
import { ExpensesIllustration } from '../../components/illustrations/expenses';
import { ReceiptsIllustration } from '../../components/illustrations/receipts';
import { RevenueIllustration } from '../../components/illustrations/revenue';
import { Guide } from '../../components/guide/guide';
import { GuidePicker } from '../../components/guide/guide-picker';
import { PropertyCard } from '../../components/property-card';
import { AppShell } from '../../components/shell/app-shell';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ConfirmDialog, Dialog } from '../../components/ui/dialog';
import { EmptyState } from '../../components/ui/empty-state';
import { Field } from '../../components/ui/field';
import { Input, Textarea } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { PageHeader } from '../../components/ui/page-header';
import { Confirmation } from '../../components/ui/confirmation';
import { Pill } from '../../components/ui/pill';
import { SuccessNotice } from '../../components/ui/success-notice';
import { Table, TableState, TBody, Td, Th, THead, Tr } from '../../components/ui/table';
import { GuideContext } from '../../lib/guide-context';
import { GUIDE_CHARACTERS, GUIDE_POSES, GUIDES, guideLabel, type GuideCharacter } from '../../lib/guides';
import { navItems } from '../../lib/nav';

/**
 * Dev-only style guide: the shell with sample data and every component in every state. Not served in production
 * builds. Sample names here are placeholders, not real data.
 */
export const Route = createFileRoute('/dev/ui')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: StyleGuide,
});

const sampleProperties = [
  { id: 'a', name: 'Cedar Suite', city: 'Chilliwack', province: 'BC' },
  { id: 'b', name: 'Lakeview Cabin', city: 'Cultus Lake', province: 'BC' },
  { id: 'c', name: 'Garden Loft', city: 'Chilliwack', province: 'BC' },
];

/** Dev-only stand-in for an uploaded cover photo (an illustration, not a real property). */
const SAMPLE_PHOTO = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9cc3e4"/><stop offset="1" stop-color="#e8f1f6"/></linearGradient></defs>
<rect width="640" height="360" fill="url(#s)"/>
<path d="M0 230 L120 120 L210 200 L320 90 L450 210 L540 140 L640 220 V360 H0Z" fill="#6f8f88"/>
<path d="M0 270 L140 200 L260 260 L380 190 L520 260 L640 230 V360 H0Z" fill="#3f6b5a"/>
<rect x="250" y="235" width="140" height="80" fill="#8a5a3c"/><path d="M235 240 L320 185 L405 240Z" fill="#5a3a28"/>
<rect x="305" y="270" width="30" height="45" fill="#f3e7c4"/><rect x="0" y="310" width="640" height="50" fill="#2f5548"/>
</svg>`)}`;

const sampleProperty = {
  id: '00000000-0000-7000-8000-000000000001',
  name: 'Cedar Suite',
  addressLine1: '1 Sample St',
  addressLine2: null,
  city: 'Chilliwack',
  province: 'BC',
  postalCode: 'V2P 1A1',
  country: 'CA',
  timeZone: 'America/Vancouver',
  checkInTime: '16:00',
  checkOutTime: '11:00',
  provincialRegistrationNumber: null,
  businessLicenceNumber: null,
  archivedAt: null,
  coverPhoto: { id: 'photo', url: SAMPLE_PHOTO, thumbUrl: SAMPLE_PHOTO, expiresAt: '2026-11-20T20:05:00Z' },
};

/** The board's sample month: 17 of 31 nights booked. */
const SAMPLE_BOOKED = new Set([1, 2, 3, 8, 9, 10, 11, 15, 16, 17, 22, 23, 24, 25, 26, 30, 31]);
const SAMPLE_NIGHTS = Array.from({ length: 31 }, (_, i) => ({
  booked: SAMPLE_BOOKED.has(i + 1) ? 1 : 0,
  available: 1,
}));

const sampleError = new ApiError(409, {
  type: 'about:blank',
  title: 'Conflict',
  status: 409,
  code: 'PLAN_RATE_LOCKED',
  detail: 'This plan is in use; create a new plan to change the rate',
});

function StyleGuide() {
  const [selected, setSelected] = useState<string | null>('a');
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [role, setRole] = useState('CLEANER');
  const [guide, setGuide] = useState<GuideCharacter>('sage');
  const nav = navItems({ staffRole: 'ADMIN', memberships: [{}] }).map((item, i) =>
    i === 3 ? { ...item, badge: 2 } : item,
  );

  return (
    <AppShell
      nav={nav}
      user={{ name: 'Sample Admin', initials: 'SA', role: 'Admin', email: 'admin@example.test' }}
      properties={sampleProperties}
      selectedPropertyId={selected}
      onSelectProperty={setSelected}
      unreadNotifications={1}
      onSignOut={() => undefined}
      onManageSignIn={() => undefined}
      allowAllProperties
    >
      <PageHeader
        eyebrow="Style guide"
        title="Components"
        description="Every core component and state, built from the design tokens."
        actions={
          <Button>
            <Plus aria-hidden className="size-4" /> Primary action
          </Button>
        }
      />
      <GuideContext.Provider value={guide}>
        <div className="flex flex-col gap-5">
          <Card title="Buttons" description="Primary, secondary, quiet and danger; default, disabled and loading.">
            <div className="flex flex-col gap-3">
              {(['primary', 'secondary', 'quiet', 'danger'] as const).map((variant) => (
                <div key={variant} className="flex flex-wrap items-center gap-2">
                  <Button variant={variant}>{variant[0]!.toUpperCase() + variant.slice(1)}</Button>
                  <Button variant={variant} disabled>
                    Disabled
                  </Button>
                  <Button variant={variant} loading>
                    Saving
                  </Button>
                  <Button variant={variant} size="sm">
                    Small
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Pills">
            <div className="flex flex-wrap gap-2">
              <Pill tone="dark">Out</Pill>
              <Pill tone="lavender">Low</Pill>
              <Pill tone="sage">Stocked</Pill>
              <Pill tone="blue">Open</Pill>
              <Pill tone="neutral">Archived</Pill>
              <Pill tone="danger">Overdue</Pill>
            </div>
          </Card>

          <Card title="Form fields">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Property name" hint="Internal nickname" required>
                <Input placeholder="e.g. Cedar Suite" />
              </Field>
              <Field label="Postal code" error="Expected a Canadian postal code" required>
                <Input defaultValue="12345" />
              </Field>
              <Field label="Role">
                <Select
                  value={role}
                  onValueChange={setRole}
                  options={[
                    { value: 'CLEANER', label: 'Cleaner' },
                    { value: 'OWNER', label: 'Owner' },
                    { value: 'ADMIN', label: 'Admin (TruHost staff)', disabled: true },
                  ]}
                />
              </Field>
              <Field label="Disabled">
                <Input value="adam@example.test" disabled readOnly />
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <Textarea placeholder="Parking and building entry" />
              </Field>
            </div>
          </Card>

          <Card title="Table" description="Rows highlight on hover; loading, error and empty states below.">
            <Table>
              <THead>
                <tr>
                  <Th>Date</Th>
                  <Th>Vendor</Th>
                  <Th>Category</Th>
                  <Th align="right">Amount</Th>
                </tr>
              </THead>
              <TBody>
                <Tr interactive>
                  <Td>Oct 2</Td>
                  <Td>Sample Wholesale</Td>
                  <Td>
                    <Pill tone="lavender">Supplies</Pill>
                  </Td>
                  <Td align="right">$41.99</Td>
                </Tr>
                <Tr interactive>
                  <Td>Oct 4</Td>
                  <Td>Sample Hardware</Td>
                  <Td>
                    <Pill tone="blue">Repairs</Pill>
                  </Td>
                  <Td align="right">$22.19</Td>
                </Tr>
              </TBody>
            </Table>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {[
                { label: 'Loading', props: { loading: true, error: null, empty: false } },
                { label: 'Error', props: { loading: false, error: sampleError, empty: false } },
                { label: 'Empty', props: { loading: false, error: null, empty: true } },
              ].map(({ label, props }) => (
                <Card key={label} inner title={label}>
                  <Table>
                    <TBody>
                      <TableState columns={1} {...props} />
                    </TBody>
                  </Table>
                </Card>
              ))}
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card
              title="Empty state: page"
              description="The page's main content. Sleeping guide; one per screen at most."
            >
              <EmptyState title="No properties yet" action={<Button>New property</Button>}>
                Add the first property to start tracking bookings and cleans.
              </EmptyState>
            </Card>
            <Card title="Confirmation" description="Routine actions: saved, updated, sent.">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Button>Save changes</Button>
                  <Confirmation>Saved</Confirmation>
                </div>
                <div className="flex items-center gap-3">
                  <Button>Send invite</Button>
                  <Confirmation>Invite sent to sam@example.test</Confirmation>
                </div>
              </div>
            </Card>
            <Card
              title="Milestone"
              description="Celebrating guide, reserved for milestones (completing a clean, finalizing a statement)."
            >
              <SuccessNotice title="Clean complete. Nice work.">
                All 6 rooms photographed. The owner and TruHost have been told.
              </SuccessNotice>
            </Card>
            <Card title="Dialogs and errors">
              <div className="flex flex-col gap-3">
                <ErrorAlert error={sampleError} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setDialog(true)}>
                    Open dialog
                  </Button>
                  <Button variant="danger" onClick={() => setConfirm(true)}>
                    Confirm dialog
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <Card
            title="KPI cards"
            description="Option A from docs/design/KpiCards.dc.html: no icons, the number leads, one small chart each. Board sample figures."
          >
            <div className="grid grid-cols-2 gap-3 @2xl/content:grid-cols-4 @2xl/content:gap-4">
              <KpiCard
                label="Gross revenue"
                value={<KpiMoney cents={285_600} />}
                support="From 5 stays"
                change={{ label: '+12%', direction: 'up', vs: 'Sep' }}
                chart={<StaysBar grossByStayCents={[50_400, 67_200, 50_400, 84_000, 33_600]} />}
              />
              <KpiCard
                label="TruPlan fees earned"
                value={<KpiMoney cents={62_832} />}
                support="22% of gross"
                chart={<ShareBar shareBps={2200} />}
              />
              <KpiCard
                label="Nights booked"
                value={<KpiOf value={17} of={31} />}
                support="55% occupancy"
                chart={<NightsStrip nightsByDay={SAMPLE_NIGHTS} />}
              />
              <KpiCard
                label="Avg. nightly earnings"
                value={<KpiMoney cents={16_800} />}
                support="Across 17 nights"
                chart={<NightlyRange lowCents={14_200} highCents={19_500} />}
              />
            </div>
          </Card>

          <Card
            title="Empty states: compact"
            description="Panels with nothing to show yet: the illustrations from docs/design/EmptyIcons.dc.html, with its wording."
          >
            <div className="grid gap-4 @3xl/content:grid-cols-2 @6xl/content:grid-cols-3">
              {(
                [
                  [
                    'Where the revenue went',
                    <RevenueIllustration key="i" />,
                    'No revenue this month yet',
                    "Once a stay's payout is entered, you'll see how it splits between owners, fees and expenses.",
                    null,
                  ],
                  [
                    'Bookings',
                    <BookingsIllustration key="i" />,
                    'No stays this month',
                    'Add a booking and it appears here as a bar across its nights.',
                    'Add booking',
                  ],
                  [
                    'Receipts this month',
                    <ReceiptsIllustration key="i" />,
                    'No receipts yet',
                    "Upload a receipt as a PDF or photo and it's filed against this property.",
                    'Upload receipt',
                  ],
                  [
                    'Expenses',
                    <ExpensesIllustration key="i" />,
                    'No expenses recorded',
                    "Restocks and repairs you pay for show up here and come off the owner's net.",
                    'Add expense',
                  ],
                  [
                    'Coming up',
                    <ComingUpIllustration key="i" />,
                    'Nothing in the next 14 days',
                    "Check-ins and check-outs will be listed here as they're booked.",
                    null,
                  ],
                  [
                    'Needs attention',
                    <AllClearIllustration key="i" />,
                    'All clear',
                    'No missing payouts, receipts or plans. Anything that needs you will show up here.',
                    null,
                  ],
                ] as const
              ).map(([panel, illustration, title, text, action]) => (
                <div
                  key={panel}
                  className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-surface px-[22px] py-5"
                >
                  <p className="text-base font-bold text-ink">{panel}</p>
                  <EmptyState
                    size="compact"
                    illustration={illustration}
                    title={title}
                    action={action && <Button variant="secondary">{action}</Button>}
                  >
                    {text}
                  </EmptyState>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title="Property cards"
            description="Cover photo (or initials), status and the month's figures: with a photo, without, loading, archived."
          >
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4">
              <PropertyCard
                property={{
                  id: 'a',
                  name: 'Cedar Suite',
                  location: '1 Sample St, Chilliwack',
                  archived: false,
                  hasPlan: true,
                  photoUrl: SAMPLE_PHOTO,
                }}
                figures={{ occupancyBps: 7200, grossCents: 431_000 }}
                index={0}
                revenueLabel="Gross, Oct"
              />
              <PropertyCard
                property={{
                  id: 'b',
                  name: 'Lakeview Cabin',
                  location: '2 Sample Rd, Cultus Lake',
                  archived: false,
                  hasPlan: false,
                  photoUrl: null,
                }}
                figures={{ occupancyBps: 833, grossCents: 0 }}
                index={1}
                revenueLabel="Gross, Oct"
              />
              <PropertyCard
                property={{
                  id: 'c',
                  name: 'Garden Loft',
                  location: '3 Sample Ave, Chilliwack',
                  archived: false,
                  hasPlan: null,
                  photoUrl: null,
                }}
                figures="loading"
                index={2}
                revenueLabel="Gross, Oct"
              />
              <PropertyCard
                property={{
                  id: 'd',
                  name: 'Old Barn',
                  location: '4 Sample Ln, Agassiz',
                  archived: true,
                  hasPlan: null,
                  photoUrl: null,
                }}
                figures={null}
                index={3}
                revenueLabel="Gross, Oct"
              />
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <CoverPhotoCard property={sampleProperty} />
            <CoverPhotoCard property={{ ...sampleProperty, coverPhoto: null }} />
          </div>

          <Card
            title="Guides"
            description="Every character in every pose, as in docs/design. The picker sets the guide used by the page empty state and the milestone above."
          >
            <div className="flex flex-col gap-6">
              <div className="max-w-2xl">
                <GuidePicker value={guide} onChange={setGuide} firstName="Sam" />
              </div>
              <div className="grid gap-5">
                {GUIDE_CHARACTERS.map((character) => (
                  <div
                    key={character}
                    className="grid grid-cols-2 gap-3 @2xl/content:grid-cols-3 @5xl/content:grid-cols-5"
                  >
                    {GUIDE_POSES.map((pose) => (
                      <figure
                        key={pose}
                        className="flex flex-col gap-2 rounded-inner border border-line bg-surface p-3"
                      >
                        <div
                          className="grid aspect-square place-items-center rounded-[12px]"
                          style={{ backgroundColor: GUIDES[character].tint }}
                        >
                          <Guide character={character} pose={pose} size={168} className="h-auto w-full max-w-[168px]" />
                        </div>
                        <figcaption className="flex items-baseline justify-between gap-2 px-1">
                          <span className="font-bold capitalize">{pose}</span>
                          <span className="text-[13px] text-muted">{GUIDES[character].name}</span>
                        </figcaption>
                        <p className="px-1 text-xs text-muted">{guideLabel(character, pose)}</p>
                      </figure>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </GuideContext.Provider>
      <Dialog
        open={dialog}
        onOpenChange={setDialog}
        title="Edit room"
        description="Rooms appear in the cleaner’s photo checklist."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setDialog(false)}>Save</Button>
          </>
        }
      >
        <Field label="Room name">
          <Input defaultValue="Primary bedroom" />
        </Field>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Archive Cedar Suite?"
        description="It will be hidden from lists. Owners keep access to its history."
        confirmLabel="Archive property"
        destructive
        pending={false}
        error={sampleError}
        onConfirm={() => setConfirm(false)}
      />
    </AppShell>
  );
}
