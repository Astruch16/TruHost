# TruHost: Technical Spec

Status: **draft for review** (2026-10-05). Nothing in here is built yet beyond
the scaffold and `GET /health`. Items marked **[Q#]** depend on an open
question in [§8](#8-open-questions). Items marked **[A#]** rest on an
assumption in [§7](#7-assumptions).

Contents:

1. [Domain overview](#1-domain-overview)
2. [Data model (Prisma)](#2-data-model-prisma)
3. [Computed metrics](#3-computed-metrics)
4. [Cross-cutting API design](#4-cross-cutting-api-design)
5. [REST API surface](#5-rest-api-surface)
6. [Permissions matrix](#6-permissions-matrix)
7. [Assumptions](#7-assumptions)
8. [Open questions](#8-open-questions)
9. [Build order](#9-build-order)

---

## 1. Domain overview

- **Single tenant** [A1]. One company (TruHost) with many properties, so
  there is no `Organization` table.
- **Admin** is a company-wide role stored on `User.staffRole`, not a
  per-property membership. Admins see every property, including ones created
  after they joined. Creating admin memberships per property would invite
  "forgot to add the admin" bugs.
- **Owner** and **Cleaner** are per-property roles stored in `Membership`.
  One user can hold several (e.g. an owner who also cleans their own unit),
  and a property can have several owners (co-owners) [Q1].
- **Bookings** produce **cleans**: each guest or owner-stay checkout creates a
  turnover `Clean` on the checkout date. A booking that is cancelled or moved
  updates or cancels its clean in the same transaction.
- **Revenue numbers are never stored.** They are derived from `Booking`,
  `Expense` and the property's `Plan` at the time ([§3](#3-computed-metrics)).

---

## 2. Data model (Prisma)

Conventions:

- IDs are UUIDv7 (`@default(uuid(7)) @db.Uuid`). They are time-ordered, so
  B-tree indexes stay compact, and they are safe to expose in URLs.
- Money is `Int` cents. Rates are `Int` basis points (1 bps = 0.01%).
  A single row tops out at $21.4M, which is plenty. Aggregates are summed in
  SQL or as `bigint` and checked against `Number.MAX_SAFE_INTEGER`.
- Stay dates are `@db.Date` (property-local calendar days). Instants are
  `@db.Timestamptz` (UTC).
- Anything referenced by money, documents or evidence is soft-deleted
  (`archivedAt`, `voidedAt` or `revokedAt`) and never hard-deleted.
- `///` comments explain non-obvious fields and will be kept in the real
  `schema.prisma`.
- Constraints Prisma can't express (partial unique indexes, exclusion
  constraints, CHECKs and immutability triggers) are written as raw SQL in
  the migration and listed after the schema.

```prisma
// ───────────────────────── Identity & access ─────────────────────────

enum StaffRole {
  ADMIN
}

enum UserStatus {
  INVITED      /// Created by an admin. Clerk account not yet linked.
  ACTIVE
  DEACTIVATED
}

model User {
  id            String     @id @default(uuid(7)) @db.Uuid
  /// Null until the invitee completes Clerk sign-up. Linked by the user.created webhook.
  clerkUserId   String?    @unique
  /// Lower-cased. Must match the Clerk primary verified email when linking.
  email         String     @unique
  firstName     String
  lastName      String
  phone         String?
  /// Null means not staff. Company-wide role. Owner and cleaner access is in Membership.
  staffRole     StaffRole?
  status        UserStatus @default(INVITED)
  deactivatedAt DateTime?  @db.Timestamptz
  createdAt     DateTime   @default(now()) @db.Timestamptz
  updatedAt     DateTime   @updatedAt @db.Timestamptz

  memberships      Membership[]       @relation("MembershipUser")
  invites          Invite[]           @relation("InviteUser")
  assignedCleans   Clean[]            @relation("CleanAssignee")
  // ...remaining back-relations omitted for brevity
}

model Invite {
  id                String       @id @default(uuid(7)) @db.Uuid
  userId            String       @db.Uuid
  user              User         @relation("InviteUser", fields: [userId], references: [id])
  /// Clerk invitation id. Used to revoke and resend, and to match the webhook.
  clerkInvitationId String       @unique
  status            InviteStatus @default(PENDING)
  invitedById       String       @db.Uuid
  expiresAt         DateTime     @db.Timestamptz
  acceptedAt        DateTime?    @db.Timestamptz
  revokedAt         DateTime?    @db.Timestamptz
  createdAt         DateTime     @default(now()) @db.Timestamptz
}

enum InviteStatus {
  PENDING
  ACCEPTED
  REVOKED
  EXPIRED
}

enum MembershipRole {
  OWNER
  CLEANER
}

/// The single source of property-scoped access. Every non-admin query joins through this table.
model Membership {
  id          String         @id @default(uuid(7)) @db.Uuid
  userId      String         @db.Uuid
  user        User           @relation("MembershipUser", fields: [userId], references: [id])
  propertyId  String         @db.Uuid
  property    Property       @relation(fields: [propertyId], references: [id])
  role        MembershipRole
  createdById String         @db.Uuid
  createdAt   DateTime       @default(now()) @db.Timestamptz
  /// Soft revoke keeps a history of who had access when. A revoked cleaner's past photos stay attributed.
  revokedAt   DateTime?      @db.Timestamptz
  revokedById String?        @db.Uuid

  @@index([userId, revokedAt])
  @@index([propertyId, role])
  // + partial unique (userId, propertyId, role) WHERE revokedAt IS NULL
}

// ───────────────────────── Properties ─────────────────────────

model Property {
  id                    String    @id @default(uuid(7)) @db.Uuid
  name                  String    /// Internal nickname shown in UI, e.g. "Kits 2BR".
  addressLine1          String
  addressLine2          String?
  city                  String
  province              String    @default("BC")
  postalCode            String
  country               String    @default("CA")
  /// IANA zone. Used to turn check-in/out dates and times into instants and to bucket reports by month.
  timeZone              String    @default("America/Vancouver")
  /// Default times used to build clean windows when a booking doesn't override them. Stored as "HH:mm".
  checkInTime           String    @default("16:00")
  checkOutTime          String    @default("11:00")
  /// BC Short-Term Rental Registry number. Platforms must display it, so we keep it on file.
  provincialRegistrationNumber String?
  /// Municipal business licence (e.g. City of Vancouver STR licence). Separate from the provincial number.
  businessLicenceNumber String?
  /// Lockbox/door codes and parking. Sensitive: visible to admins and the property's cleaners only [Q14].
  accessInstructions    String?
  archivedAt            DateTime? @db.Timestamptz
  createdAt             DateTime  @default(now()) @db.Timestamptz
  updatedAt             DateTime  @updatedAt @db.Timestamptz

  memberships   Membership[]
  rooms         Room[]
  plans         PropertyPlan[]
  bookings      Booking[]
  expenses      Expense[]
  receipts      Receipt[]
  cleans        Clean[]
  supplyItems   SupplyItem[]
  damageReports DamageReport[]
  icalFeeds     IcalFeed[]
}

enum RoomType {
  BEDROOM
  BATHROOM
  KITCHEN
  LIVING
  DINING
  LAUNDRY
  OUTDOOR
  ENTRY
  OTHER
}

model Room {
  id          String    @id @default(uuid(7)) @db.Uuid
  propertyId  String    @db.Uuid
  property    Property  @relation(fields: [propertyId], references: [id])
  name        String    /// e.g. "Primary bedroom", "Ensuite"
  type        RoomType
  sortOrder   Int       @default(0) /// Order in the cleaner's photo checklist (walk-through order).
  /// Archived rooms drop out of the clean-completion requirement but keep their historic photos.
  archivedAt  DateTime? @db.Timestamptz
  createdAt   DateTime  @default(now()) @db.Timestamptz

  /// Lets CleanPhoto use a composite FK that proves the room belongs to the clean's property.
  @@unique([propertyId, id])
}

// ───────────────────────── Plans ─────────────────────────

/// A management plan, e.g. "Full service 20%". Fee terms are immutable once any property has used the plan,
/// so historic statements stay reproducible. Changing terms means creating a new plan. [Q3]
model Plan {
  id               String    @id @default(uuid(7)) @db.Uuid
  name             String    @unique
  description      String?
  /// Management fee rate in basis points (2000 = 20%).
  managementFeeBps Int
  /// Which revenue the fee is charged on. The enum stays provisional until Q4 is answered.
  feeBasis         FeeBasis
  archivedAt       DateTime? @db.Timestamptz
  createdAt        DateTime  @default(now()) @db.Timestamptz
}

enum FeeBasis {
  GROSS_REVENUE          /// accommodation + guest fees
  ACCOMMODATION_ONLY     /// excludes guest cleaning fees
  NET_OF_CHANNEL_FEES    /// gross minus platform host fees
}

/// Which plan applied to a property over which dates. Needed because reports for past months must use the plan
/// in force at that time, not today's.
model PropertyPlan {
  id            String   @id @default(uuid(7)) @db.Uuid
  propertyId    String   @db.Uuid
  property      Property @relation(fields: [propertyId], references: [id])
  planId        String   @db.Uuid
  plan          Plan     @relation(fields: [planId], references: [id])
  effectiveFrom DateTime @db.Date
  effectiveTo   DateTime? @db.Date /// Exclusive. Null means current.
  createdById   String   @db.Uuid
  createdAt     DateTime @default(now()) @db.Timestamptz
  // + EXCLUDE USING gist (propertyId WITH =, daterange(effectiveFrom, effectiveTo) WITH &&)
}

// ───────────────────────── Bookings ─────────────────────────

enum BookingSource {
  MANUAL  /// Entered by an admin.
  ICAL    /// Created by the iCal sync. Dates only, so an admin fills in money later.
  PMS     /// Created by a future PMS integration.
}

enum BookingChannel {
  AIRBNB
  VRBO
  BOOKING_COM
  DIRECT
  OTHER
}

enum BookingKind {
  GUEST       /// Revenue stay.
  OWNER_STAY  /// The owner is using the property. Counts as nights blocked, not revenue, and still needs a clean.
  BLOCK       /// Maintenance or hold. No clean is created by default.
}

enum BookingStatus {
  CONFIRMED
  CANCELLED
}

model Booking {
  id                   String         @id @default(uuid(7)) @db.Uuid
  propertyId           String         @db.Uuid
  property             Property       @relation(fields: [propertyId], references: [id])
  /// How the record got here (rule 3). This is separate from channel.
  source               BookingSource
  /// Where the guest booked. Drives which fee fields are expected.
  channel              BookingChannel
  kind                 BookingKind    @default(GUEST)
  status               BookingStatus  @default(CONFIRMED)
  /// Platform confirmation code or iCal UID. Makes sync idempotent: (propertyId, source, externalId) is unique.
  externalId           String?
  checkInDate          DateTime       @db.Date
  checkOutDate         DateTime       @db.Date  /// nights = checkOutDate - checkInDate. CHECK (checkOut > checkIn).
  /// Overrides Property.checkInTime/checkOutTime for early check-in or late checkout. Feeds the clean window.
  checkInTimeOverride  String?
  checkOutTimeOverride String?
  guestName            String?        /// PII. Hidden from owners unless Q8 says otherwise.
  guestCount           Int?

  // Money: entered by admins, all nullable because iCal-sourced bookings arrive without amounts.
  // Null means "not entered yet", which is different from 0. Reports flag GUEST bookings with null amounts as incomplete.
  /// Total nightly-rate revenue for the stay, before guest fees and taxes.
  accommodationCents    Int?
  /// Cleaning fee charged to the guest. Revenue, not a cost. [Q2]
  guestCleaningFeeCents Int?
  /// Pet fees, extra-guest fees and similar.
  otherGuestFeesCents   Int?
  /// Host-side fee the platform keeps (e.g. Airbnb host service fee). Reduces payout.
  channelFeeCents       Int?
  /// Taxes collected from the guest (GST/PST/MRDT). Never counted as revenue. Recorded for direct bookings
  /// where TruHost remits. For Airbnb, which remits PST/MRDT itself, this is usually 0. [Q11]
  taxesCollectedCents   Int?
  /// For cancelled bookings that still paid out (partial refund policy). Revenue is the amounts above as
  /// entered, so admins enter what was actually earned. [Q10]
  cancelledAt          DateTime?      @db.Timestamptz
  cancellationNote     String?
  notes                String?
  enteredById          String?        @db.Uuid /// Null for system-created (iCal/PMS) records.
  /// Optimistic concurrency. Clients send it back on PATCH, and a mismatch returns 409.
  version              Int            @default(0)
  lastSyncedAt         DateTime?      @db.Timestamptz
  createdAt            DateTime       @default(now()) @db.Timestamptz
  updatedAt            DateTime       @updatedAt @db.Timestamptz

  clean         Clean?
  damageReports DamageReport[]

  @@unique([propertyId, source, externalId])
  @@index([propertyId, checkInDate])
  @@index([propertyId, checkOutDate])
  // + EXCLUDE USING gist (propertyId WITH =, daterange(checkInDate, checkOutDate) WITH &&) WHERE status = 'CONFIRMED'
  //   prevents double-booking data-entry errors. Same-day turnover is fine because the range is half-open.
}

/// Phase 6. One feed per property per channel listing. The URL is a secret (anyone with it can read
/// availability), so it is encrypted at rest and never returned to non-admins.
model IcalFeed {
  id            String         @id @default(uuid(7)) @db.Uuid
  propertyId    String         @db.Uuid
  property      Property       @relation(fields: [propertyId], references: [id])
  channel       BookingChannel
  urlEncrypted  String
  active        Boolean        @default(true)
  lastFetchedAt DateTime?      @db.Timestamptz
  lastError     String?
  createdAt     DateTime       @default(now()) @db.Timestamptz
}

// ───────────────────────── Expenses & receipts ─────────────────────────

enum ExpenseCategory {
  CLEANING
  LAUNDRY
  SUPPLIES
  REPAIRS_MAINTENANCE
  FURNISHINGS
  UTILITIES
  INTERNET
  LICENSING_PERMITS
  INSURANCE
  STRATA
  OTHER
}

enum ExpenseBearer {
  OWNER    /// Deducted in the owner's net revenue (and shown to them).
  TRUHOST  /// TruHost absorbs it. Not shown to owners and not in owner net. [Q5]
}

model Expense {
  id          String          @id @default(uuid(7)) @db.Uuid
  propertyId  String          @db.Uuid
  property    Property        @relation(fields: [propertyId], references: [id])
  category    ExpenseCategory
  /// Who ultimately bears the cost. Determines whether it reduces owner net.
  bearer      ExpenseBearer   @default(OWNER)
  incurredOn  DateTime        @db.Date /// Bucket date for monthly reports.
  vendor      String?
  description String
  /// Pre-tax amount. Taxes are separate so GST input tax credits can be reported later.
  subtotalCents Int
  gstCents      Int           @default(0)
  pstCents      Int           @default(0)
  /// Optional link to the clean that generated it (e.g. per-clean cleaner pay). [Q6]
  cleanId     String?         @db.Uuid
  enteredById String          @db.Uuid
  /// Void instead of delete. Voided rows are excluded from reports but kept for audit.
  voidedAt    DateTime?       @db.Timestamptz
  voidedById  String?         @db.Uuid
  voidReason  String?
  version     Int             @default(0)
  createdAt   DateTime        @default(now()) @db.Timestamptz
  updatedAt   DateTime        @updatedAt @db.Timestamptz

  receipts Receipt[]

  @@index([propertyId, incurredOn])
  // + CHECK (subtotalCents >= 0 AND gstCents >= 0 AND pstCents >= 0). Refunds are a separate category/negative? [Q12]
}

/// A receipt or invoice document. Usually attached to an expense, but can stand alone (e.g. a warranty).
model Receipt {
  id           String    @id @default(uuid(7)) @db.Uuid
  propertyId   String    @db.Uuid
  property     Property  @relation(fields: [propertyId], references: [id])
  expenseId    String?   @db.Uuid
  expense      Expense?  @relation(fields: [expenseId], references: [id])
  fileId       String    @unique @db.Uuid
  file         StoredFile @relation(fields: [fileId], references: [id])
  receiptDate  DateTime  @db.Date
  description  String?
  uploadedById String    @db.Uuid
  voidedAt     DateTime? @db.Timestamptz
  voidedById   String?   @db.Uuid
  voidReason   String?
  createdAt    DateTime  @default(now()) @db.Timestamptz
}

// ───────────────────────── Files ─────────────────────────

enum FilePurpose {
  RECEIPT
  CLEAN_PHOTO
  DAMAGE_PHOTO
}

enum FileStatus {
  PENDING   /// Upload URL issued. Object may not exist yet.
  VERIFIED  /// Object exists in R2 with the declared size, type and SHA-256.
}

/// Every R2 object. Domain tables (Receipt, CleanPhoto, DamagePhoto) point here. Access to a file is decided
/// by what it is attached to, never by the file row alone.
model StoredFile {
  id               String      @id @default(uuid(7)) @db.Uuid
  purpose          FilePurpose
  /// Scoping key. Also the R2 key prefix: properties/{propertyId}/{purpose}/{id}.
  propertyId       String      @db.Uuid
  r2Key            String      @unique
  contentType      String      /// Allow-listed: image/jpeg, image/png, image/heic, image/webp, application/pdf.
  sizeBytes        Int
  /// Hex SHA-256 declared by the client and enforced by R2 via x-amz-checksum-sha256 on the presigned PUT.
  sha256           String
  status           FileStatus  @default(PENDING)
  uploadedById     String      @db.Uuid
  /// Server time the upload was authorised. Evidence timestamp, not client-controlled.
  createdAt        DateTime    @default(now()) @db.Timestamptz
  /// Server time we confirmed the object exists in R2.
  verifiedAt       DateTime?   @db.Timestamptz
  /// Device-reported capture time (EXIF or client clock). Untrusted. Shown for context only.
  clientCapturedAt DateTime?   @db.Timestamptz
  originalFilename String?

  @@index([status, createdAt]) /// Lets the nightly job purge PENDING rows and objects older than 24h.
}

// ───────────────────────── Cleaning ─────────────────────────

enum CleanKind {
  TURNOVER  /// Auto-created from a booking's checkout.
  ADHOC     /// Created by an admin (deep clean, pre-listing, inspection).
}

enum CleanStatus {
  SCHEDULED
  IN_PROGRESS
  COMPLETE
  CANCELLED   /// Added to the brief's three states: needed when the triggering booking is cancelled.
}

model Clean {
  id                String      @id @default(uuid(7)) @db.Uuid
  propertyId        String      @db.Uuid
  property          Property    @relation(fields: [propertyId], references: [id])
  kind              CleanKind
  /// The stay whose checkout triggers this clean. Unique, so one booking has at most one turnover.
  bookingId         String?     @unique @db.Uuid
  booking           Booking?    @relation(fields: [bookingId], references: [id])
  scheduledDate     DateTime    @db.Date
  /// Checkout instant to next check-in instant. The cleaner's working window, recomputed when bookings change.
  /// windowEnd is null when there is no next booking.
  windowStart       DateTime?   @db.Timestamptz
  windowEnd         DateTime?   @db.Timestamptz
  status            CleanStatus @default(SCHEDULED)
  /// Must hold an active CLEANER membership on the property (checked in the service).
  assignedCleanerId String?     @db.Uuid
  assignedCleaner   User?       @relation("CleanAssignee", fields: [assignedCleanerId], references: [id])
  startedAt         DateTime?   @db.Timestamptz
  startedById       String?     @db.Uuid
  completedAt       DateTime?   @db.Timestamptz
  completedById     String?     @db.Uuid
  cancelledAt       DateTime?   @db.Timestamptz
  cancelReason      String?
  notes             String?
  version           Int         @default(0)
  createdAt         DateTime    @default(now()) @db.Timestamptz
  updatedAt         DateTime    @updatedAt @db.Timestamptz

  photos         CleanPhoto[]
  supplyStatuses SupplyStatus[]
  damageReports  DamageReport[]

  @@unique([propertyId, id]) /// Target of CleanPhoto's composite FK.
  @@index([propertyId, scheduledDate])
  @@index([assignedCleanerId, scheduledDate])
}

enum PhotoPhase {
  BEFORE
  AFTER
}

/// Immutable. Several photos per (clean, room, phase) are allowed: a cleaner who took a bad shot adds another
/// rather than replacing it. [Q9]
model CleanPhoto {
  id           String     @id @default(uuid(7)) @db.Uuid
  cleanId      String     @db.Uuid
  /// Denormalised so the composite FKs below can prove clean and room share a property.
  propertyId   String     @db.Uuid
  roomId       String     @db.Uuid
  phase        PhotoPhase
  fileId       String     @unique @db.Uuid
  file         StoredFile @relation(fields: [fileId], references: [id])
  uploadedById String     @db.Uuid
  createdAt    DateTime   @default(now()) @db.Timestamptz

  clean Clean @relation(fields: [propertyId, cleanId], references: [propertyId, id])
  room  Room  @relation(fields: [propertyId, roomId], references: [propertyId, id])

  @@index([cleanId, roomId, phase])
  // + trigger: reject UPDATE and DELETE
}

// ───────────────────────── Supplies ─────────────────────────

/// What a property stocks (toilet paper, coffee pods...). Per property, because units differ.
model SupplyItem {
  id         String    @id @default(uuid(7)) @db.Uuid
  propertyId String    @db.Uuid
  property   Property  @relation(fields: [propertyId], references: [id])
  name       String
  unit       String?   /// e.g. "rolls", "pods". Display only.
  sortOrder  Int       @default(0)
  archivedAt DateTime? @db.Timestamptz
  createdAt  DateTime  @default(now()) @db.Timestamptz

  statuses SupplyStatus[]

  @@unique([propertyId, name])
}

enum SupplyLevel {
  FULL
  OK
  LOW
  OUT
}

/// Append-only reading. The current level is the latest row, so history (and how fast things run out) is
/// never lost.
model SupplyStatus {
  id           String      @id @default(uuid(7)) @db.Uuid
  supplyItemId String      @db.Uuid
  supplyItem   SupplyItem  @relation(fields: [supplyItemId], references: [id])
  level        SupplyLevel
  note         String?
  /// Set when recorded during a clean. Lets admins see stock at each turnover.
  cleanId      String?     @db.Uuid
  clean        Clean?      @relation(fields: [cleanId], references: [id])
  reportedById String      @db.Uuid
  reportedAt   DateTime    @default(now()) @db.Timestamptz

  @@index([supplyItemId, reportedAt(sort: Desc)])
}

// ───────────────────────── Damage ─────────────────────────

enum DamageSeverity {
  MINOR
  MODERATE
  SEVERE
}

enum DamageStatus {
  DRAFT         /// Being written. Photos can be added. Only the reporter and admins can see it.
  SUBMITTED     /// Locked: title, description and links can no longer change.
  ACKNOWLEDGED
  CLAIM_FILED   /// Claim lodged with the channel (e.g. AirCover, which has a 14-day deadline after checkout).
  RESOLVED
}

model DamageReport {
  id                 String         @id @default(uuid(7)) @db.Uuid
  propertyId         String         @db.Uuid
  property           Property       @relation(fields: [propertyId], references: [id])
  /// The clean during which it was found, if any.
  cleanId            String?        @db.Uuid
  clean              Clean?         @relation(fields: [cleanId], references: [id])
  /// The stay believed responsible. Needed for platform damage claims.
  bookingId          String?        @db.Uuid
  booking            Booking?       @relation(fields: [bookingId], references: [id])
  roomId             String?        @db.Uuid
  reportedById       String         @db.Uuid
  title              String
  description        String
  severity           DamageSeverity
  status             DamageStatus   @default(DRAFT)
  estimatedCostCents Int?
  submittedAt        DateTime?      @db.Timestamptz
  resolvedAt         DateTime?      @db.Timestamptz
  resolutionNote     String?
  createdAt          DateTime       @default(now()) @db.Timestamptz
  updatedAt          DateTime       @updatedAt @db.Timestamptz

  photos DamagePhoto[]

  @@index([propertyId, status])
}

/// Immutable. Photos can be added after submission (more evidence) but never removed.
model DamagePhoto {
  id             String       @id @default(uuid(7)) @db.Uuid
  damageReportId String       @db.Uuid
  damageReport   DamageReport @relation(fields: [damageReportId], references: [id])
  fileId         String       @unique @db.Uuid
  file           StoredFile   @relation(fields: [fileId], references: [id])
  uploadedById   String       @db.Uuid
  createdAt      DateTime     @default(now()) @db.Timestamptz
  // + trigger: reject UPDATE and DELETE
}

// ───────────────────────── Audit & infrastructure ─────────────────────────

enum ActorType {
  USER
  SYSTEM   /// Scheduled jobs (iCal sync, file cleanup).
  WEBHOOK  /// Clerk/Stripe callbacks.
}

/// Append-only. Written inside the same transaction as the change it records (rule 7).
model AuditLog {
  id         String    @id @default(uuid(7)) @db.Uuid
  actorType  ActorType
  actorId    String?   @db.Uuid
  /// Dotted verb, e.g. "booking.update", "expense.void", "membership.revoke".
  action     String
  entityType String
  entityId   String    @db.Uuid
  /// Denormalised for "everything that happened to property X" queries.
  propertyId String?   @db.Uuid
  /// Field-level snapshots of changed fields only, with PII-light values.
  before     Json?
  after      Json?
  /// Correlates with request logs.
  requestId  String?
  ipAddress  String?
  createdAt  DateTime  @default(now()) @db.Timestamptz

  @@index([entityType, entityId])
  @@index([propertyId, createdAt])
  @@index([actorId, createdAt])
  // + trigger: reject UPDATE and DELETE
}

/// Makes POST retries safe for cleaners on flaky mobile connections. The same key replays the stored response.
model IdempotencyKey {
  userId         String   @db.Uuid
  key            String
  /// Hash of method + path + body. Reusing a key with a different request returns 422.
  requestHash    String
  responseStatus Int
  responseBody   Json
  createdAt      DateTime @default(now()) @db.Timestamptz

  @@id([userId, key])
  @@index([createdAt]) /// Purged after 24h.
}
```

### Constraints added as raw SQL in migrations

| Table | Constraint | Why |
|---|---|---|
| `Membership` | partial unique `(userId, propertyId, role) WHERE revokedAt IS NULL` | No duplicate active grants, while keeping revoked history. |
| `PropertyPlan` | `EXCLUDE USING gist` on `daterange(effectiveFrom, effectiveTo)` per property | A property can't be on two plans on the same day. |
| `Booking` | `CHECK (checkOutDate > checkInDate)`; `EXCLUDE USING gist` overlap for `CONFIRMED` | Rejects impossible stays and double entries. |
| `Booking`, `Expense` | `CHECK (<money> >= 0)` on every cents column | Negative values must be explicit (Q12), not typos. |
| `Plan` | `CHECK (managementFeeBps BETWEEN 0 AND 10000)` | Bounds. |
| `CleanPhoto`, `DamagePhoto`, `AuditLog`, `SupplyStatus` | `BEFORE UPDATE OR DELETE` trigger raising an exception | Rule 5 and rule 7, enforced even against buggy code or manual SQL. |
| `StoredFile` | trigger: `sha256`, `sizeBytes`, `r2Key` and `uploadedById` immutable; `status` may only go `PENDING → VERIFIED` | Evidence integrity. |

### Not modelled yet (deliberately)

- **Invoices / owner statements / payouts** come with Stripe Invoicing.
  Reports are computed live until then.
- **Notifications** (cleaner reminders, damage alerts) come after Phase 4.
- **Organization / multi-tenancy** stays out per [A1].

---

## 3. Computed metrics

All metrics are computed in `apps/api/src/reporting/` by pure functions over
records, with table-driven tests. The formulas below are **proposals pending
Q2–Q5 and Q10**.

For a property and date range `[from, to)` (property-local dates):

| Metric | Proposed definition |
|---|---|
| **Nights booked** | Count of nights `d` in range where a `CONFIRMED`, `kind = GUEST` booking has `checkIn ≤ d < checkOut`. Owner stays and blocks are reported separately. |
| **Gross revenue** | Σ (`accommodationCents` + `guestCleaningFeeCents` + `otherGuestFeesCents`) for GUEST bookings, allocated to the range (below). Excludes taxes. |
| **Channel fees** | Σ `channelFeeCents`, allocated the same way. |
| **Management fee** | `round_half_even(feeBase × managementFeeBps / 10000)` per booking, using the plan in force on the booking's check-in date [Q4]. |
| **Owner expenses** | Σ (`subtotal + gst + pst`) for non-voided expenses with `bearer = OWNER` and `incurredOn` in range. |
| **Net revenue (owner)** | Gross − channel fees − management fee (+ GST on the fee if TruHost is registered [Q11]) − owner expenses. |
| **ADR** | Allocated `accommodationCents` ÷ nights booked, rounded to the nearest cent. Excludes cleaning fees (industry standard). |
| **Occupancy** | Nights booked ÷ (nights in range − owner-stay − block nights). |

**Allocation across range boundaries** [Q7]: a stay that spans months has its
amounts split per night, with integer cents distributed by the
largest-remainder method so the parts sum exactly to the whole. Guest
cleaning fees go to the checkout night. Reports return
`incompleteBookings: n` whenever any GUEST booking in range has null
amounts.

---

## 4. Cross-cutting API design

- **Base path** `/v1`. JSON. **OpenAPI 3.1** is generated from the same zod
  schemas in `@truhost/shared` (via `nestjs-zod`) and served at `/v1/docs`
  outside production. The web (and later mobile) client is generated from it
  (`openapi-typescript` + `openapi-fetch`), so types never drift.
- **Errors**: RFC 9457 `application/problem+json` with a stable `code`
  (e.g. `CLEAN_MISSING_PHOTOS` with `missing: [{roomId, phase}]`).
- **Pagination**: cursor-based (`?cursor=&limit=`, max 100) on every list.
- **Authentication**: `Authorization: Bearer <Clerk session JWT>`, verified
  without a network call using `@clerk/backend` `verifyToken` and JWKS. The guard
  loads `User` by `clerkUserId`, rejects `DEACTIVATED` users, and attaches
  `Actor { userId, staffRole }`. Clerk sign-up is restricted (Clerk
  "Restricted" mode), so only invited emails can create accounts.
- **Authorization**: `AccessService` in `src/access/` owns a single policy
  table, `(role, resource, action) → scope`. Services call:
  - `access.assert(actor, 'expense:create', { propertyId })` for a single
    target,
  - `access.propertyScope(actor, 'booking:read')`, which returns a Prisma
    `where` fragment (`{}` for admins,
    `{ property: { memberships: { some: { userId, role, revokedAt: null } } } }`
    otherwise), for lists.

  Out-of-scope access returns **404**. Controllers never call Prisma.
- **Authz test matrix**: `test/authz/matrix.e2e-spec.ts` seeds two
  properties, each with its own owner and cleaner, plus an admin. It hits
  **every route** as every role against both properties and asserts
  allow/deny. A meta-test lists the Nest router's routes and fails if any
  route lacks a matrix entry.
- **Idempotency**: `Idempotency-Key` header accepted on all POSTs and
  required on cleaner-facing POSTs (photos, supply statuses, damage reports,
  clean transitions).
- **Concurrency**: mutable money rows and cleans carry `version`. PATCH and
  transitions must send `version`, and a mismatch returns 409.
- **Rate limiting** (`@nestjs/throttler`, keyed by user id, or by IP when
  unauthenticated). Storage is in-memory for one instance and Redis
  (Upstash) once there is more than one [Q13].

  | Tier | Limit | Applies to |
  |---|---|---|
  | `default` | 120 / min | All authenticated routes |
  | `write` | 30 / min | Mutating routes |
  | `upload` | 60 / 10 min | `POST /uploads` |
  | `auth` | 10 / min per IP + 30 / hour per user | `/invites*`, `/me` writes, `/webhooks/*` |
  | `public` | 30 / min per IP | `/health` |
- **Uploads (presigned)**:
  1. The client calls `POST /v1/uploads` with
     `{ purpose, propertyId, contentType, sizeBytes, sha256 }`.
  2. The API checks access for that purpose on that property, creates a
     `StoredFile(PENDING)`, and returns a PUT URL valid for 10 min. The URL
     signs `Content-Type`, `Content-Length` and `x-amz-checksum-sha256`, so
     R2 rejects any other body.
  3. The client PUTs to R2.
  4. The client calls the domain attach endpoint (e.g.
     `POST /cleans/:id/photos { fileId, roomId, phase }`). The API `HEAD`s the
     object, checks size, type and checksum, marks it `VERIFIED`, and creates
     the immutable domain row, all in one transaction.

  Viewing goes through `GET /v1/files/:id/url`. It authorises via the owning
  domain row and returns a GET URL valid for 5 min.
- **Audit**: `AuditService.record(tx, …)` takes the Prisma transaction
  client, so it can't be called outside one. Every admin mutation on
  Booking, Expense, Receipt, Plan, PropertyPlan, Membership, User role and
  DamageReport status is recorded.
- **Observability**: request id on every request, structured JSON logs
  (pino), Sentry for errors [Q13].

---

## 5. REST API surface

Roles: **A** = admin, **O** = owner (own properties only), **C** = cleaner
(assigned properties only). "own" = the caller's own records. All paths are
under `/v1`.

### Health
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/health` | public | Liveness. Already built. |

### Me & auth
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/me` | A O C | Profile, staffRole, active memberships. Drives the web/mobile nav. |
| PATCH | `/me` | A O C | Name and phone. Email changes go through Clerk. |
| POST | `/webhooks/clerk` | Svix-signed | `user.created` links an INVITED user by verified email. `user.deleted` deactivates. |

### Users & invites (team)
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/users` | A | Filter by `staffRole`, membership role, status. |
| GET | `/users/:id` | A | |
| PATCH | `/users/:id` | A | Name, phone, staffRole. Audited. |
| POST | `/users/:id/deactivate` | A | Sets DEACTIVATED and revokes Clerk sessions. Audited. Can't target self. |
| POST | `/invites` | A | `{ email, firstName, lastName, staffRole?, memberships: [{propertyId, role}] }`. Creates the User (INVITED), the memberships and the Clerk invitation in one go. |
| GET | `/invites` | A | |
| POST | `/invites/:id/resend` | A | |
| POST | `/invites/:id/revoke` | A | |

### Properties & memberships
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/properties` | A O C | A: all. O and C: scoped. The response shape varies by role (C gets no financial or plan fields). |
| POST | `/properties` | A | |
| GET | `/properties/:id` | A O C | `accessInstructions` only for A and C [Q14]. |
| PATCH | `/properties/:id` | A | |
| POST | `/properties/:id/archive` | A | |
| GET | `/properties/:id/memberships` | A | |
| POST | `/properties/:id/memberships` | A | `{ userId, role }`. Audited. |
| POST | `/memberships/:id/revoke` | A | Audited. Unassigns the user from future cleans. |

### Rooms
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/properties/:id/rooms` | A O C | |
| POST | `/properties/:id/rooms` | A | |
| PATCH | `/rooms/:id` | A | |
| POST | `/rooms/:id/archive` | A | |
| PUT | `/properties/:id/rooms/order` | A | `{ roomIds: [] }` |

### Plans
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/plans` | A | |
| POST | `/plans` | A | Audited. |
| PATCH | `/plans/:id` | A | Name and description only. Fee terms are immutable once used. |
| POST | `/plans/:id/archive` | A | |
| GET | `/properties/:id/plan` | A O | Current plan plus history. |
| POST | `/properties/:id/plan` | A | `{ planId, effectiveFrom }`. Closes the previous assignment. Audited. |

### Bookings & calendar
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/bookings` | A | Cross-property list with filters. |
| GET | `/properties/:id/bookings` | A O | `?from&to`. O gets guest PII redacted [Q8]. |
| GET | `/bookings/:id` | A O | |
| POST | `/properties/:id/bookings` | A | `source = MANUAL`. Creates or updates the turnover clean in the same transaction. Audited. |
| PATCH | `/bookings/:id` | A | Requires `version`. Reschedules the clean. Audited. |
| POST | `/bookings/:id/cancel` | A | Cancels the clean if it hasn't started. Audited. |
| GET | `/properties/:id/calendar` | A O | `?from&to`. Merged bookings, blocks and cleans, with minimal fields. |

### Expenses & receipts
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/expenses` | A | Cross-property. |
| GET | `/properties/:id/expenses` | A O | O sees `bearer = OWNER` only [Q5]. |
| POST | `/properties/:id/expenses` | A | Audited. |
| PATCH | `/expenses/:id` | A | Requires `version`. Audited. |
| POST | `/expenses/:id/void` | A | `{ reason }`. Audited. |
| GET | `/properties/:id/receipts` | A O | O sees receipts for OWNER-borne expenses and standalone receipts. |
| POST | `/properties/:id/receipts` | A | `{ fileId, expenseId?, receiptDate, description? }`. Audited. |
| POST | `/receipts/:id/void` | A | Audited. The file stays in storage. |

### Files
| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/uploads` | A C | Issues a presigned PUT. C may only request `CLEAN_PHOTO` or `DAMAGE_PHOTO` for assigned properties. |
| GET | `/files/:id/url` | A O C | Signed GET, valid 5 min. Authorised via the attached Receipt, CleanPhoto or DamagePhoto. PENDING or unattached files are visible only to their uploader. |

### Cleans
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/cleans` | A O C | `?propertyId&from&to&status&assignee=me`. Scoped. O is read-only. |
| GET | `/cleans/:id` | A O C | Includes the room checklist: per room, BEFORE and AFTER photo counts. |
| POST | `/properties/:id/cleans` | A | ADHOC clean. |
| PATCH | `/cleans/:id` | A | Assign cleaner, reschedule, notes. Only while SCHEDULED. |
| POST | `/cleans/:id/start` | A, C (assignee) | SCHEDULED → IN_PROGRESS. Not before `scheduledDate` [Q15]. |
| POST | `/cleans/:id/photos` | A, C (assignee) | `{ fileId, roomId, phase }`. Only while IN_PROGRESS. Room must be active and on this property. |
| GET | `/cleans/:id/photos` | A O C | Metadata plus file ids. Images come through `/files/:id/url`. |
| POST | `/cleans/:id/complete` | A, C (assignee) | IN_PROGRESS → COMPLETE. 422 `CLEAN_MISSING_PHOTOS` unless every active room has ≥1 BEFORE and ≥1 AFTER. |
| POST | `/cleans/:id/cancel` | A | SCHEDULED/IN_PROGRESS → CANCELLED. Audited. |

### Supplies
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/properties/:id/supplies` | A O C | Items with their latest level. |
| POST | `/properties/:id/supplies` | A | Create an item. |
| PATCH | `/supply-items/:id` | A | |
| POST | `/supply-items/:id/archive` | A | |
| POST | `/properties/:id/supply-statuses` | A C | Batch `{ cleanId?, readings: [{ supplyItemId, level, note? }] }`. Append-only. |
| GET | `/supply-items/:id/history` | A O | |
| GET | `/supplies/restock` | A | Cross-property list of items at LOW or OUT. |

### Damage reports
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/damage-reports` | A O C | Scoped. O never sees DRAFTs. C sees submitted reports on their properties plus their own drafts. |
| GET | `/damage-reports/:id` | A O C | Same visibility rules. |
| POST | `/properties/:id/damage-reports` | A C | Creates a DRAFT. |
| PATCH | `/damage-reports/:id` | A, C (reporter) | Only while DRAFT. |
| POST | `/damage-reports/:id/photos` | A, C (reporter) | `{ fileId }`. Allowed in DRAFT or after submission. Append-only. |
| POST | `/damage-reports/:id/submit` | A, C (reporter) | DRAFT → SUBMITTED. 422 `DAMAGE_REPORT_NO_PHOTOS` if there are no photos. |
| POST | `/damage-reports/:id/status` | A | `{ status, note?, estimatedCostCents? }`. Forward-only transitions. Audited. |

### Reports
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/properties/:id/summary` | A O | `?from&to`. Nights, gross, channel fees, management fee, owner expenses, net, ADR, occupancy, `incompleteBookings`. |
| GET | `/properties/:id/summary/monthly` | A O | `?year`. Twelve buckets. |
| GET | `/reports/portfolio` | A | `?from&to`. All properties. |

### Audit
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/audit-logs` | A | `?entityType&entityId&propertyId&actorId&from&to` |

---

## 6. Permissions matrix

Scope key: **all** = any property; **own** = properties where the caller has
an active membership in that role; **self** = records the caller created;
**assigned** = cleans where `assignedCleanerId = caller`; — = denied (404).

| Resource | Action | Admin | Owner | Cleaner |
|---|---|---|---|---|
| Me (profile) | read / update | self | self | self |
| User | list / read / update / deactivate | all | — | — |
| Invite | create / list / resend / revoke | all | — | — |
| Property | list / read | all | own | own (no money/plan fields) |
| Property | create / update / archive | all | — | — |
| Property access instructions | read | all | — [Q14] | own |
| Membership | list / create / revoke | all | — | — |
| Room | list / read | all | own | own |
| Room | create / update / archive / reorder | all | — | — |
| Plan | list / create / update / archive | all | — | — |
| Property plan | read | all | own | — |
| Property plan | assign | all | — | — |
| Booking | list / read | all | own (guest PII redacted [Q8]) | — |
| Booking | create / update / cancel | all | — | — |
| Calendar | read | all | own | — (cleaners use cleans) |
| Expense | list / read | all | own, `bearer = OWNER` | — |
| Expense | create / update / void | all | — | — |
| Receipt | list / read file | all | own (OWNER-borne or standalone) | — |
| Receipt | create / void | all | — | — |
| Upload URL | create | all | — | own (photo purposes only) |
| Clean | list / read | all | own | own |
| Clean | create (adhoc) / update / cancel | all | — | — |
| Clean | start / complete | all | — | own + assigned |
| Clean photo | create | all | — | own + assigned, IN_PROGRESS |
| Clean photo | list / read file | all | own | own |
| Clean photo | update / delete | — | — | — (immutable) |
| Supply item | list / read | all | own | own |
| Supply item | create / update / archive | all | — | — |
| Supply status | create | all | — | own |
| Supply status | history | all | own | — |
| Damage report | list / read | all | own, not DRAFT | own (submitted) + self (drafts) |
| Damage report | create | all | — | own |
| Damage report | update (DRAFT) / submit | all | — | self |
| Damage photo | create | all | — | self (reporter) |
| Damage photo | read file | all | own, not DRAFT | own |
| Damage report | change status | all | — | — |
| Report (property) | read | all | own | — |
| Report (portfolio) | read | all | — | — |
| Audit log | read | all | — | — |

Required negative tests (Phase 1 onward, extended each phase): owner A
cannot list, read or fetch file URLs for property B's bookings, expenses,
receipts, cleans, clean photos, damage reports, supplies or summaries. Cleaner
A likewise cannot touch property B. A cleaner cannot start or complete a
clean assigned to someone else. A revoked membership loses access
immediately. A deactivated user gets 401.

---

## 7. Assumptions

Each assumption is something I proceeded with. Tell me if any is wrong.

- **A1** Single company, so no multi-tenant `Organization`. Adding one later
  is a migration plus an access-scope change, not a rewrite.
- **A2** Admin is a global staff role, and there is only one staff role for
  now (no bookkeeper or ops-manager split).
- **A3** Currency is CAD only.
- **A4** Users are created at invite time (status INVITED) and linked to Clerk
  by verified email on `user.created`. Clerk runs in Restricted sign-up mode,
  so uninvited emails can't sign up at all.
- **A5** An owner sees all receipts and photos for their properties, but never
  TruHost-borne expenses or other owners' data.
- **A6** Every non-archived room needs BEFORE and AFTER photos, evaluated at
  completion time. A room archived mid-clean drops out of the requirement.
  (Alternative: snapshot the room list at `start`. Say if you'd prefer that.)
- **A7** Photos are uploaded only while a clean is IN_PROGRESS. Starting the
  clean is the cleaner's first action on arrival.
- **A8** Each GUEST or OWNER_STAY checkout generates exactly one turnover
  clean. BLOCKs don't.
- **A9** Cleaners don't see bookings or guest names, only cleans and their
  windows.
- **A10** Photo originals (including EXIF/GPS) are kept as evidence. Strip
  them only in derived thumbnails if we add them.
- **A11** R2 enforces `x-amz-checksum-sha256` on presigned PUTs. I'll verify
  this in Phase 2. If it doesn't, the fallback is the server streaming the
  object and hashing it on attach.
- **A12** The hosting target for the API is undecided ([Q13]). Phases end in
  something runnable locally plus a deploy step once that's decided.
- **A13** Tests need a real Postgres (exclusion constraints and triggers can't
  be mocked). There is no Docker on this machine, so the plan is a Neon
  branch per developer/CI run (Neon branching), or local Postgres if you
  install it [Q16].
- **A14** Plan fee terms are immutable once used. New terms mean a new plan
  assigned from a date.
- **A15** Next.js keeps a minimal BFF role only for Clerk session handling. All
  data comes from the API with the user's Clerk token.

---

## 8. Open questions

Money and reporting (these block Phase 2):

- **Q1 Owners.** Can a property have several owner users (co-owners,
  spouses)? Is an owner sometimes a company that will later need one Stripe
  customer per entity rather than per person?
- **Q2 Cleaning fees.** Where does the guest cleaning fee go: to the owner as
  revenue (with cleaners paid as an owner expense), to TruHost, or straight
  to the cleaner? Is the management fee charged on it?
- **Q3 Plans.** What are your management plans? For each: name, fee %, what
  it includes, and any flat monthly fees or minimums.
- **Q4 Fee basis.** Is the management fee a % of gross (incl. cleaning fee),
  accommodation only, or payout after channel fees?
- **Q5 Net revenue formula.** Please confirm or correct: *net = gross −
  channel fees − management fee (− GST on fee?) − owner-borne expenses.* Do
  owners see TruHost-borne expenses at all?
- **Q6 Cleaner pay.** Are cleaners paid per clean (fixed fee per property?),
  hourly, or salaried? Should a completed clean auto-create a CLEANING
  expense?
- **Q7 Month boundaries.** For a stay spanning Jan 30–Feb 3, should revenue
  be split per night (my proposal), or attributed wholly to the check-in
  month or the checkout or payout month? What do your current owner
  statements do?
- **Q10 Cancellations.** When a guest cancels but a partial payout still
  arrives, should it count as revenue (I'd keep the booking CANCELLED with
  amounts = what was actually earned and 0 nights)?
- **Q11 Taxes.** Is TruHost GST-registered (so the management fee carries
  5% GST)? Do you take direct bookings where TruHost collects and remits
  PST/MRDT/GST?
- **Q12 Refunds and credits.** Do you need negative expenses (vendor refunds)
  or owner credits, or should those be separate record types?

Product:

- **Q8 Guest PII.** Should owners see guest names (or first names only) on
  their calendar? Under BC PIPA I'd default to hiding them.
- **Q9 Bad photos.** If a cleaner uploads the wrong photo, is "add another
  and the latest counts" enough, or do admins need a "flag as invalid (with
  reason)" action that still never deletes?
- **Q14 Access instructions.** Should owners see lockbox codes and access
  notes for their own property?
- **Q15 Clean timing.** Can a cleaner start a clean before the scheduled
  date or before checkout time (e.g. an early departure)? Who assigns
  cleaners: always an admin, or a default cleaner per property?
- **Q17 Owner stays.** Do owners request their own stays through the app
  (later), or does an admin enter them?
- **Q18 Damage workflow.** Beyond reporting, do you track repair cost
  recovery (e.g. AirCover payout received) against the damage report?
- **Q19 Supply restocking.** Does TruHost restock supplies and bill owners
  (an expense), or do owners restock? Should LOW/OUT trigger a notification?

Infrastructure:

- **Q13 Hosting.** Where should the API run (Fly.io, Render, Railway, AWS)?
  Any Canadian data-residency requirement? Neon has no Canadian region that
  I can confirm, and R2 jurisdictions don't include Canada. Is a US region
  acceptable? Also: Sentry yes or no, and Upstash Redis for rate limiting.
- **Q16 Local DB for tests.** Would you install Docker or Postgres locally, or
  should tests run against a Neon branch (needs network and a Neon API key
  in CI)?
- **Q20 Domain and email.** What domains for web and API (affects CORS and
  Clerk config), and which email sender for Clerk invites?

---

## 9. Build order

Each phase ends with something you can run and click through. Tests are
written within each phase, never deferred.

### Phase 0: Scaffold ✅ (done)
pnpm + Turborepo, `apps/api` (Nest 12, Vitest, oxlint), `apps/web` (Next 16,
Tailwind), `packages/shared` (zod). `GET /health`.
**Run:** `pnpm dev` and `curl localhost:3000/health`. `pnpm lint typecheck
test test:e2e` are all green.
Remaining here: GitHub Actions CI running lint, typecheck, test and e2e.

### Phase 1: Identity, access and properties
- Prisma + Neon, migrations, seed script. Models: User, Invite, Membership,
  Property, Room, Plan, PropertyPlan, AuditLog, IdempotencyKey, plus the raw
  SQL constraints and triggers.
- Clerk guard, `@Actor()`, Clerk webhook, invites, `/me`.
- `AccessService` + policy table + **authz matrix test harness** (including
  the meta-test that every route has an entry).
- Throttler tiers, problem+json errors, OpenAPI, generated client in
  `packages/shared` or `packages/api-client`.
- API routes: me, users, invites, properties, memberships, rooms, plans.
- Web: Clerk sign-in, role-aware shell, admin screens for properties, rooms,
  team and invites. Owner and cleaner see "my properties".

**Run:** invite yourself as admin via the seed, sign in, create a property
and rooms, invite a test owner and see their scoped view.

### Phase 2: Money (bookings, expenses, receipts, reports)
- Booking, Expense, Receipt, StoredFile. R2 presigned uploads (receipts
  first). Audit on all of it.
- `reporting` module with table-driven tests of every formula (needs
  Q2–Q7, Q10–Q12 answered).
- Web: admin booking and expense entry, receipt upload, owner dashboard
  (nights, gross, net, ADR, monthly chart, calendar, receipts).

**Run:** enter a month of bookings and expenses, log in as the owner and see
correct numbers. The authz matrix proves owner B sees none of it.

### Phase 3: Cleaning
- Clean (auto-created from bookings), CleanPhoto, SupplyItem, SupplyStatus.
  State machine with completion guard, idempotency on cleaner POSTs.
- Web (mobile-first): cleaner schedule, clean checklist by room with camera
  upload, supply levels. Admin schedule board and assignment. Owner photo
  gallery per clean.

**Run:** create a booking, see the clean appear, complete it on a phone
browser with photos, and confirm that completion is refused with a missing
photo.

### Phase 4: Damage reports and audit viewer
- DamageReport, DamagePhoto, submit guard, status workflow.
- Web: cleaner damage flow, admin triage, owner view, admin audit log viewer.

**Run:** file a damage report from a phone with photos, triage it as admin
and see it as the owner.

### Phase 5: Production hardening and deploy
Hosting per Q13, environments (staging and prod Neon branches), backups and
PITR check, Sentry, security review, rate-limit tuning, R2 bucket lock
retention for evidence prefixes, and a load sanity check.

**Run:** staging URL used for a real week of operations.

### Phase 6: iCal sync
IcalFeed, scheduled fetch (every 15–30 min), upsert by
`(propertyId, ICAL, UID)`, cancellation detection when an event disappears,
and an admin "needs financials" queue for iCal bookings with null amounts.

### Later
Expo app on the same API (`apps/mobile`), Stripe Invoicing (owner
statements/invoices), PMS integration (`source = PMS`), and notifications.
