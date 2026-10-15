import type { Statement, StatementLine, StatementMonth } from './api-types';

/**
 * Dev-only fixtures for /dev/statements: September 2026 at a few properties, in every state. The figures are what the
 * API computes for these records (gross split per night, TruPlan 22% rounded once, owner-stay cleaning, adjustments).
 */

const admin = { id: 'u-admin', firstName: 'Adam', lastName: 'Struch' };
const owner = { id: 'u-owner', firstName: 'Test', lastName: 'Owner' };

const stay = (
  bookingId: string,
  date: string,
  endDate: string,
  channel: StatementLine['channel'],
  guestName: string,
  amountCents: number,
  o: Partial<StatementLine> = {},
): StatementLine => ({
  kind: 'STAY',
  bookingId,
  expenseId: null,
  adjustmentId: null,
  date,
  endDate,
  channel,
  category: null,
  description: 'Stay',
  detail: null,
  nights: null,
  totalNights: null,
  stayGrossCents: amountCents,
  cancelled: false,
  payoutPending: false,
  amountCents,
  guestName,
  ...o,
});

const expense = (
  expenseId: string,
  date: string,
  description: string,
  vendor: string,
  category: StatementLine['category'],
  cents: number,
  receipt: string | null,
): StatementLine => ({
  kind: 'EXPENSE',
  bookingId: null,
  expenseId,
  adjustmentId: null,
  date,
  endDate: null,
  channel: null,
  category,
  description,
  detail: vendor,
  nights: null,
  totalNights: null,
  stayGrossCents: null,
  cancelled: false,
  payoutPending: false,
  amountCents: -cents,
  receipts: receipt
    ? [
        {
          id: `r-${expenseId}`,
          fileId: `f-${expenseId}`,
          receiptDate: date,
          description: null,
          filename: receipt,
          contentType: 'application/pdf',
        },
      ]
    : [],
});

const CEDAR_LINES: StatementLine[] = [
  stay('b1', '2026-08-30', '2026-09-03', 'AIRBNB', 'Jordan Rivera', 64_000, {
    nights: 2,
    totalNights: 4,
    stayGrossCents: 128_000,
  }),
  stay('b3', '2026-09-13', '2026-09-19', 'BOOKING_COM', 'Priya Shah', 177_000, { nights: 6, totalNights: 6 }),
  stay('b4', '2026-09-23', '2026-09-27', 'AIRBNB', 'Sam Okafor', 136_000, { nights: 4, totalNights: 4 }),
  stay('b5', '2026-09-28', '2026-10-02', 'VRBO', 'Lee Martin', 21_000, {
    nights: 0,
    totalNights: 4,
    cancelled: true,
    description: 'Cancelled Vrbo stay',
  }),
  {
    ...stay('b2', '2026-09-09', '2026-09-11', null, '', -15_000),
    kind: 'OWNER_STAY_CLEANING',
    stayGrossCents: null,
    guestName: undefined,
    description: 'Cleaning after owner stay',
  },
  expense('e1', '2026-09-05', 'Restock: firewood, batteries', 'Canadian Tire', 'SUPPLIES', 8_975, 'canadian-tire.pdf'),
  expense(
    'e2',
    '2026-09-20',
    'Fix kitchen tap',
    'Sea to Sky Plumbing',
    'REPAIRS_MAINTENANCE',
    14_500,
    'invoice-2231.pdf',
  ),
  {
    kind: 'ADJUSTMENT',
    bookingId: null,
    expenseId: null,
    adjustmentId: 'a1',
    date: '2026-10-03',
    endDate: null,
    channel: null,
    category: null,
    description: 'August Vrbo payout arrived after finalizing',
    detail: 'Corrects August 2026',
    nights: null,
    totalNights: null,
    stayGrossCents: null,
    cancelled: false,
    payoutPending: false,
    amountCents: 4_250,
  },
];

const base = {
  property: { id: 'p-cedar', name: 'Cedar Cabin', archived: false },
  owners: [owner],
  month: '2026-09',
  plan: { name: 'TruPlan', managementFeeBps: 2200 },
  adjustments: [
    {
      id: 'a1',
      amountCents: 4_250,
      reason: 'August Vrbo payout arrived after finalizing',
      corrects: { id: 's-cedar-aug', month: '2026-08' },
      createdAt: '2026-10-03T17:20:00.000Z',
      createdBy: admin,
      voidedAt: null,
      voidReason: null,
    },
    {
      id: 'a0',
      amountCents: -2_000,
      reason: 'Duplicate of the firewood restock',
      corrects: null,
      createdAt: '2026-10-03T17:05:00.000Z',
      createdBy: admin,
      voidedAt: '2026-10-03T17:10:00.000Z',
      voidReason: 'Entered twice',
    },
  ],
  correctable: [{ id: 's-cedar-aug', month: '2026-08', status: 'RELEASED' as const }],
  created: { at: '2026-10-01T16:00:00.000Z', by: admin },
  calcVersion: null,
} satisfies Partial<Statement>;

const CEDAR_TOTALS: Statement['totals'] = {
  nightsBooked: 12,
  grossCents: 398_000,
  managementFeeBps: 2200,
  managementFeeCents: 87_560,
  expensesCents: 23_475,
  ownerStayCleaningCents: 15_000,
  adjustmentsCents: 4_250,
  netCents: 276_215,
};

export const CEDAR_DRAFT: Statement = {
  ...base,
  id: 's-cedar',
  status: 'DRAFT',
  totals: CEDAR_TOTALS,
  lines: CEDAR_LINES,
  blockers: [],
  pendingPayouts: [],
  finalized: null,
  released: null,
  pdf: null,
  can: { finalize: true, release: false, adjust: true, preview: true },
};

export const CEDAR_FINALIZED: Statement = {
  ...CEDAR_DRAFT,
  status: 'FINALIZED',
  finalized: { at: '2026-10-04T18:30:00.000Z', by: admin },
  calcVersion: 1,
  can: { finalize: false, release: true, adjust: false, preview: true },
};

export const CEDAR_RELEASED: Statement = {
  ...CEDAR_FINALIZED,
  status: 'RELEASED',
  released: { on: '2026-10-05', at: '2026-10-05T19:00:00.000Z', by: admin, paymentReference: 'ETF-88412' },
  pdf: {
    fileId: 'f-pdf',
    sha256: '9f2c4e1b7a0d3c58e6f1a2b4c7d9e0f13a5b6c8d0e2f4a6b8c0d1e3f5a7b9c2d4',
    sizeBytes: 6_812,
  },
  can: { finalize: false, release: false, adjust: false, preview: false },
};

/** Seaside Loft: a draft with a stay still waiting on its payout and an expense missing its receipt. */
export const SEASIDE_DRAFT: Statement = {
  ...base,
  id: 's-seaside',
  property: { id: 'p-seaside', name: 'Seaside Loft', archived: false },
  status: 'DRAFT',
  adjustments: [],
  correctable: [],
  totals: {
    nightsBooked: 16,
    grossCents: 221_750,
    managementFeeBps: 2200,
    managementFeeCents: 48_785,
    expensesCents: 8_319,
    ownerStayCleaningCents: 0,
    adjustmentsCents: 0,
    netCents: 164_646,
  },
  lines: [
    stay('s1', '2026-09-02', '2026-09-05', 'AIRBNB', 'Maya Chen', 55_500, { nights: 3, totalNights: 3 }),
    stay('s2', '2026-09-07', '2026-09-12', 'VRBO', 'Daniel Park', 86_250, { nights: 5, totalNights: 5 }),
    stay('s3', '2026-09-15', '2026-09-18', 'AIRBNB', 'Ana Souza', 0, {
      nights: 3,
      totalNights: 3,
      stayGrossCents: null,
      payoutPending: true,
    }),
    stay('s4', '2026-09-21', '2026-09-26', 'DIRECT', 'Chris Lee', 80_000, { nights: 5, totalNights: 5 }),
    expense('x1', '2026-09-06', 'Restock: paper towels, soap, coffee', 'Costco', 'SUPPLIES', 6_420, 'costco.pdf'),
    expense('x2', '2026-09-15', 'Netflix Standard', 'Netflix', 'SUBSCRIPTIONS', 1_899, null),
  ],
  blockers: [{ code: 'MISSING_RECEIPTS', message: 'One expense needs a receipt.', expenseIds: ['x2'] }],
  pendingPayouts: [
    {
      bookingId: 's3',
      checkInDate: '2026-09-15',
      checkOutDate: '2026-09-18',
      channel: 'AIRBNB',
      guestName: 'Ana Souza',
    },
  ],
  finalized: null,
  released: null,
  pdf: null,
  can: { finalize: false, release: false, adjust: true, preview: true },
};

export const SEPTEMBER: StatementMonth = {
  month: '2026-09',
  items: [
    {
      property: { id: 'p-cedar', name: 'Cedar Cabin', archived: false },
      statementId: 's-cedar',
      state: 'FINALIZED',
      nightsBooked: 12,
      grossCents: 398_000,
      netCents: 276_215,
      blockers: 0,
      pendingPayouts: 0,
      finalizedAt: '2026-10-04T18:30:00.000Z',
      releasedOn: null,
    },
    {
      property: { id: 'p-harbour', name: 'Harbour Suite', archived: false },
      statementId: 's-harbour',
      state: 'RELEASED',
      nightsBooked: 21,
      grossCents: 312_400,
      netCents: 205_430,
      blockers: 0,
      pendingPayouts: 0,
      finalizedAt: '2026-10-02T17:00:00.000Z',
      releasedOn: '2026-10-05',
    },
    {
      property: { id: 'p-kits', name: 'Kits Garden Suite', archived: false },
      statementId: null,
      state: 'NOT_STARTED',
      nightsBooked: 9,
      grossCents: 141_000,
      netCents: 98_120,
      blockers: 0,
      pendingPayouts: 0,
      finalizedAt: null,
      releasedOn: null,
    },
    {
      property: { id: 'p-seaside', name: 'Seaside Loft', archived: false },
      statementId: 's-seaside',
      state: 'DRAFT',
      nightsBooked: 16,
      grossCents: 221_750,
      netCents: 164_646,
      blockers: 1,
      pendingPayouts: 1,
      finalizedAt: null,
      releasedOn: null,
    },
  ],
  totals: {
    netCents: 744_411,
    toReleaseCents: 276_215,
    releasedCents: 205_430,
    counts: { NOT_STARTED: 1, DRAFT: 1, FINALIZED: 1, RELEASED: 1 },
  },
};
