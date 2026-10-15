import type { DamageReportDetail } from '@truhost/shared';

/** Dev previews only: sample damage reports and stand-in photos (SVG data URIs, so no network). */
const photo = (bg: string, mark: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='${bg}'/><rect y='190' width='400' height='110' fill='#b9a58a'/><ellipse cx='210' cy='160' rx='95' ry='55' fill='${mark}' opacity='0.85'/><ellipse cx='250' cy='140' rx='40' ry='22' fill='${mark}' opacity='0.6'/></svg>`,
  )}`;

export const DEV_PHOTOS = [photo('#d9cfc2', '#7b1e3a'), photo('#c9d6dd', '#5a4632'), photo('#e8e2d6', '#3b3b3b')];

const base = (over: Partial<DamageReportDetail>): DamageReportDetail => ({
  id: 'd1',
  property: { id: 'p1', name: 'Fixture Suite' },
  title: 'Wine stain on the sofa',
  description:
    'Large red wine stain across the middle sofa cushion and the armrest. Blotted and treated with stain remover; still clearly visible.',
  severity: 'MODERATE',
  status: 'SUBMITTED',
  discoveredOn: '2026-10-04',
  estimatedCostCents: 45_000,
  claimReference: null,
  resolutionNote: null,
  booking: {
    id: 'b1',
    guestName: 'Jordan Guest',
    checkInDate: '2026-10-01',
    checkOutDate: '2026-10-04',
    channel: 'AIRBNB',
  },
  room: { id: 'r1', displayName: 'Living room' },
  reportedBy: { id: 'u2', firstName: 'Casey', lastName: 'Cleaner' },
  submittedAt: '2026-10-04T18:20:00.000Z',
  acknowledgedAt: null,
  claimFiledAt: null,
  resolvedAt: null,
  createdAt: '2026-10-04T18:00:00.000Z',
  photoCount: 3,
  coverThumbUrl: DEV_PHOTOS[0]!,
  claimDeadline: '2026-10-18',
  can: { edit: false, addPhotos: true, submit: false, manage: true },
  photos: DEV_PHOTOS.map((url, i) => ({
    id: `ph${i}`,
    url,
    thumbUrl: url,
    expiresAt: '2026-10-14T23:00:00.000Z',
    uploadedBy: { id: 'u2', firstName: 'Casey', lastName: 'Cleaner' },
    createdAt: '2026-10-04T18:05:00.000Z',
  })),
  ...over,
});

export const DEV_DAMAGE: DamageReportDetail[] = [
  base({}),
  base({
    id: 'd2',
    property: { id: 'p2', name: 'Fixture Cabin' },
    title: 'Cracked bathroom mirror',
    severity: 'SEVERE',
    status: 'CLAIM_FILED',
    discoveredOn: '2026-10-09',
    acknowledgedAt: '2026-10-09T20:00:00.000Z',
    claimFiledAt: '2026-10-10T16:00:00.000Z',
    claimReference: 'HMXP29D4',
    booking: {
      id: 'b2',
      guestName: 'Sam Rivers',
      checkInDate: '2026-10-06',
      checkOutDate: '2026-10-09',
      channel: 'AIRBNB',
    },
    room: { id: 'r2', displayName: 'Bathroom' },
    coverThumbUrl: DEV_PHOTOS[1]!,
    claimDeadline: '2026-10-23',
    photoCount: 2,
  }),
  base({
    id: 'd3',
    title: 'Burn mark on the counter',
    severity: 'MINOR',
    status: 'DRAFT',
    submittedAt: null,
    discoveredOn: '2026-10-12',
    booking: { id: 'b3', guestName: 'Leila', checkInDate: '2026-10-10', checkOutDate: '2026-10-12', channel: 'VRBO' },
    room: { id: 'r3', displayName: 'Kitchen' },
    coverThumbUrl: DEV_PHOTOS[2]!,
    claimDeadline: null,
    photoCount: 1,
    can: { edit: true, addPhotos: true, submit: true, manage: true },
  }),
];
