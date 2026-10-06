# TruHost: Technical Spec

Status: **Phase 1 built; answers to all open questions applied** (2026-10-06) (revised 2026-10-05 with answers to the
blocking questions). Items marked **[N#]** are open but non-blocking questions
([§9](#9-open-questions-non-blocking)). Items marked **[A#]** are assumptions
([§8](#8-assumptions)).

Contents:

1. [Domain overview](#1-domain-overview)
2. [Money flow](#2-money-flow)
3. [Data model (Prisma)](#3-data-model-prisma)
4. [Computed metrics and statements](#4-computed-metrics-and-statements)
5. [Cross-cutting API design](#5-cross-cutting-api-design)
6. [REST API surface](#6-rest-api-surface)
7. [Permissions matrix](#7-permissions-matrix)
8. [Assumptions](#8-assumptions)
9. [Open questions (non-blocking)](#9-open-questions-non-blocking)
10. [Build order](#10-build-order)
11. [Decision log](#11-decision-log)

---

## 1. Domain overview

- **Single tenant** [A1]. One company (TruHost) with many properties, so
  there is no `Organization` table.
- **Admin** is a company-wide role stored on `User.staffRole`, not a
  per-property membership. Admins see every property.
- **Owner** and **Cleaner** are per-property roles stored in `Membership`.
  One user can hold several. In particular, **an admin can also hold an
  OWNER membership**. That is the starting state: TruHost's own Airbnb is the
  first property, and the admin owns it. Access is the union of the user's
  roles. The web app shows the owner view to anyone with an OWNER membership,
  admins included.
- **Bookings** produce **cleans**: each GUEST or OWNER_STAY checkout creates a
  turnover `Clean`. Cancelling or moving a booking updates or cancels its clean
  in the same transaction.
- **Each property has a default cleaner.** New cleans are assigned to them,
  and an admin can override the assignment per clean. A cleaner can start a
  clean any time on its scheduled day.
- **Each completed clean is owed to its cleaner.** The amount defaults from
  the property's rate. An admin records payments, which flips cleans to paid.
  A payment can be voided with a reason, but never deleted.
- **Owner stays are cleaned at the owner's expense.** When the turnover clean
  after an OWNER_STAY completes, the API adds an owner-borne CLEANING expense
  at the property's standard cleaning fee.
- **Owners are paid monthly** through an `OwnerStatement` per property per
  month: DRAFT → FINALIZED → RELEASED. Finalizing locks that month's bookings
  and expenses. Later corrections are adjustment lines on the next
  statement.
- **Revenue figures are never entered.** They are computed from bookings,
  expenses, adjustments and the plan. The one exception is a FINALIZED
  statement, which keeps a server-computed copy of its lines and totals so the
  document can never change after it has been issued ([§4](#4-computed-metrics-and-statements)).

## 2. Money flow

```
Airbnb ──payout──▶ TruHost
                   │
                   ├─ guest cleaning fee ─▶ TruHost revenue ─▶ pays cleaner (cleaner pay per clean)
                   │
                   └─ owner gross = payout − cleaning fee
                          − TruPlan fee (22% of the month's owner gross) ─▶ TruHost revenue
                          − owner-borne expenses (receipted purchases, e.g. supply restocks)
                          − owner-stay cleaning fees ─▶ TruHost revenue ─▶ pays cleaner
                          ± adjustments (corrections to finalized months)
                          = owner net ─▶ released to owner (statement RELEASED)
```

- An admin enters, per booking, the **payout received** and the **guest
  cleaning fee charged**. Airbnb's host fee is never entered or shown.
- **Owners absorb Airbnb's fee on the cleaning fee.** Airbnb charges its host
  fee on the cleaning fee too, but owner gross is still payout minus the
  _full_ cleaning fee.
- **Supplies**: TruHost restocks and records each purchase as an owner-borne
  SUPPLIES expense with a receipt.
- **TruPlan**: 22% of the month's owner gross. Plans stay versioned through
  `PropertyPlan`, so the rate can change later.
- **Taxes**: TruHost is not GST-registered and takes no direct bookings. Tax
  fields exist in the model, but the API rejects non-null values unless
  `TAX_FIELDS_ENABLED=true`, and the UI hides them.
- **No client invoices.** The monthly statement is the document. Stripe
  Invoicing is dropped.

---

## 3. Data model (Prisma)

Conventions:

- IDs are UUIDv7 (`@default(uuid(7)) @db.Uuid`).
- Money is `Int` cents (CAD) and rates are `Int` basis points. Sums happen in
  SQL as `bigint` or in JS with safe-integer checks.
- Stay dates and months are `@db.Date` (property-local calendar days).
  Instants are `@db.Timestamptz` (UTC).
- Anything referenced by money, documents or evidence is soft-deleted
  (`archivedAt`, `voidedAt` or `revokedAt`). Nothing is hard-deleted.
- `///` comments explain non-obvious fields and carry into `schema.prisma`.
- Constraints Prisma can't express are raw SQL in migrations
  ([table below](#constraints-added-as-raw-sql)).

```prisma
// ───────────────────────── Identity & access ─────────────────────────  (Phase 1)

enum StaffRole {
  ADMIN
}

enum UserStatus {
  INVITED      /// Created by an admin (or the bootstrap CLI). Clerk account not yet linked.
  ACTIVE
  DEACTIVATED
}

model User {
  id            String     @id @default(uuid(7)) @db.Uuid
  /// Null until first sign-in. Linked on the first authenticated request by matching Clerk's verified email.
  clerkUserId   String?    @unique
  /// Stored lower-cased. Unique.
  email         String     @unique
  firstName     String
  lastName      String
  phone         String?
  /// Null means not staff. Company-wide. Owner and cleaner access is in Membership.
  staffRole     StaffRole?
  status        UserStatus @default(INVITED)
  deactivatedAt DateTime?  @db.Timestamptz
  createdAt     DateTime   @default(now()) @db.Timestamptz
  updatedAt     DateTime   @updatedAt @db.Timestamptz
}

enum InviteStatus {
  PENDING
  ACCEPTED
  REVOKED
}

model Invite {
  id                String       @id @default(uuid(7)) @db.Uuid
  userId            String       @db.Uuid
  /// Clerk invitation id (created with notify: false, so Clerk sends no email). Its ticket URL is what we email.
  /// Used to revoke and resend. Null if Clerk was skipped (dev bootstrap without a key).
  clerkInvitationId String?      @unique
  /// Resend message id of the last invite email, for delivery troubleshooting. Null if not sent.
  emailMessageId    String?
  lastSentAt        DateTime?    @db.Timestamptz
  status            InviteStatus @default(PENDING)
  invitedById       String?      @db.Uuid /// Null for the bootstrap CLI.
  acceptedAt        DateTime?    @db.Timestamptz
  revokedAt         DateTime?    @db.Timestamptz
  createdAt         DateTime     @default(now()) @db.Timestamptz
}

enum MembershipRole {
  OWNER
  CLEANER
}

/// The single source of property-scoped access. Every non-admin query is scoped through this table.
model Membership {
  id          String         @id @default(uuid(7)) @db.Uuid
  userId      String         @db.Uuid
  propertyId  String         @db.Uuid
  role        MembershipRole
  createdById String?        @db.Uuid
  createdAt   DateTime       @default(now()) @db.Timestamptz
  /// Soft revoke keeps a history of who had access when.
  revokedAt   DateTime?      @db.Timestamptz
  revokedById String?        @db.Uuid

  @@index([userId, revokedAt])
  @@index([propertyId, role])
  // + partial unique (userId, propertyId, role) WHERE revokedAt IS NULL
}

// ───────────────────────── Properties ─────────────────────────  (Phase 1)

model Property {
  id                           String    @id @default(uuid(7)) @db.Uuid
  name                         String    /// Internal nickname, e.g. "Kits 2BR".
  addressLine1                 String
  addressLine2                 String?
  city                         String
  province                     String    @default("BC")
  postalCode                   String
  country                      String    @default("CA")
  /// IANA zone. Used to turn dates and times into instants and to bucket months.
  timeZone                     String    @default("America/Vancouver")
  /// Default "HH:mm" times used to build clean windows.
  checkInTime                  String    @default("16:00")
  checkOutTime                 String    @default("11:00")
  /// BC Short-Term Rental Registry number (platforms must display it).
  provincialRegistrationNumber String?
  /// Municipal business licence, separate from the provincial number.
  businessLicenceNumber        String?
  // No lockbox or door codes are stored in the app (decision 2026-10-06). See §10 "Later".
  /// Cleaner assigned to new cleans by default. Must hold an active CLEANER membership here; cleared when that
  /// membership is revoked. Admins can override per clean.
  defaultCleanerId             String?   @db.Uuid
  /// Cleaning fee normally charged to guests. Used as the owner-borne expense after an OWNER_STAY.
  standardCleaningFeeCents     Int       @default(0)
  /// Default amount owed to the cleaner per turnover. Copied onto each Clean at creation.
  defaultCleanerPayCents       Int       @default(0)
  archivedAt                   DateTime? @db.Timestamptz
  createdAt                    DateTime  @default(now()) @db.Timestamptz
  updatedAt                    DateTime  @updatedAt @db.Timestamptz
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
  id         String    @id @default(uuid(7)) @db.Uuid
  propertyId String    @db.Uuid
  name       String    /// e.g. "Primary bedroom", "Ensuite".
  type       RoomType
  sortOrder  Int       @default(0) /// Order in the cleaner's photo checklist.
  /// Archived rooms leave the clean-completion requirement but keep their historic photos.
  archivedAt DateTime? @db.Timestamptz
  createdAt  DateTime  @default(now()) @db.Timestamptz

  /// Target of CleanPhoto's composite FK, which proves the room belongs to the clean's property.
  @@unique([propertyId, id])
}

// ───────────────────────── Plans ─────────────────────────  (Phase 1)

/// A management plan, e.g. TruPlan at 2200 bps. The rate is immutable once any PropertyPlan references it, so past
/// statements stay reproducible. A new rate means a new plan.
model Plan {
  id               String    @id @default(uuid(7)) @db.Uuid
  name             String    @unique
  description      String?
  /// Management fee in basis points of the month's owner gross (2200 = 22%).
  managementFeeBps Int
  archivedAt       DateTime? @db.Timestamptz
  createdAt        DateTime  @default(now()) @db.Timestamptz
}

/// Which plan applied to a property from which month. Starts on the 1st of a month so every statement month has exactly
/// one rate.
model PropertyPlan {
  id            String    @id @default(uuid(7)) @db.Uuid
  propertyId    String    @db.Uuid
  planId        String    @db.Uuid
  effectiveFrom DateTime  @db.Date  /// CHECK: day = 1
  effectiveTo   DateTime? @db.Date  /// Exclusive. CHECK: day = 1. Null means current.
  createdById   String?   @db.Uuid
  createdAt     DateTime  @default(now()) @db.Timestamptz
  // + EXCLUDE USING gist (propertyId WITH =, daterange(effectiveFrom, effectiveTo) WITH &&)
}

// ───────────────────────── Bookings ─────────────────────────  (Phase 2)

enum BookingSource {
  MANUAL
  ICAL
  PMS
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
  OWNER_STAY  /// Owner using the property. Not revenue, but still gets a turnover clean.
  BLOCK       /// Maintenance or hold. No clean by default.
}

enum BookingStatus {
  CONFIRMED
  CANCELLED
}

model Booking {
  id                    String         @id @default(uuid(7)) @db.Uuid
  propertyId            String         @db.Uuid
  /// How the record got here (rule 3). Separate from channel.
  source                BookingSource
  /// Where the guest booked.
  channel               BookingChannel
  kind                  BookingKind    @default(GUEST)
  status                BookingStatus  @default(CONFIRMED)
  /// Platform confirmation code or iCal UID. (propertyId, source, externalId) is unique, so sync is idempotent.
  externalId            String?
  checkInDate           DateTime       @db.Date
  checkOutDate          DateTime       @db.Date /// nights = checkOutDate − checkInDate. CHECK (checkOut > checkIn).
  checkInTimeOverride   String?        /// Early check-in. Feeds the clean window.
  checkOutTimeOverride  String?        /// Late checkout. Feeds the clean window.
  guestName             String?        /// PII. Admin-only (hidden from owners and cleaners).
  guestCount            Int?

  // Money. Nullable because iCal bookings arrive without amounts. Null means "not entered", which is not 0.
  /// What the channel actually paid TruHost for this stay, after the channel's host fee.
  payoutCents           Int?
  /// Cleaning fee charged to the guest. TruHost revenue. Subtracted from payout to get owner gross.
  /// CHECK (guestCleaningFeeCents <= payoutCents).
  guestCleaningFeeCents Int?
  /// Guest-paid taxes. Must be null unless TAX_FIELDS_ENABLED. Never revenue.
  taxesCollectedCents   Int?

  cancelledAt           DateTime?      @db.Timestamptz
  cancellationNote      String?
  notes                 String?
  enteredById           String?        @db.Uuid /// Null for iCal or PMS records.
  /// Optimistic concurrency. A stale version on PATCH returns 409.
  version               Int            @default(0)
  createdAt             DateTime       @default(now()) @db.Timestamptz
  updatedAt             DateTime       @updatedAt @db.Timestamptz

  @@unique([propertyId, source, externalId])
  @@index([propertyId, checkInDate])
  @@index([propertyId, checkOutDate])
  // + EXCLUDE USING gist (propertyId WITH =, daterange(checkInDate, checkOutDate, '[)') WITH &&)
  //     WHERE (status = 'CONFIRMED')
  //   See "Booking overlap rules" below.
}

// ───────────────────────── iCal staging ─────────────────────────  (Phase 6)

/// One feed per channel listing. Anyone with the URL can read availability, so it is encrypted at rest and admin-only.
model IcalFeed {
  id            String         @id @default(uuid(7)) @db.Uuid
  propertyId    String         @db.Uuid
  channel       BookingChannel
  urlEncrypted  String
  active        Boolean        @default(true)
  lastFetchedAt DateTime?      @db.Timestamptz
  lastError     String?
  createdAt     DateTime       @default(now()) @db.Timestamptz
}

enum IcalImportState {
  PENDING    /// Fetched, not yet processed.
  APPLIED    /// Created or updated a Booking without conflict.
  CONFLICT   /// Overlaps or duplicates an existing booking. Waiting for an admin.
  RESOLVED   /// Admin linked, replaced or ignored it.
  IGNORED    /// Auto-ignored (e.g. unchanged re-fetch of an applied event).
}

/// Every iCal event lands here first. Sync never writes a conflicting Booking, so it can't trip the overlap constraint.
model IcalImport {
  id                String          @id @default(uuid(7)) @db.Uuid
  feedId            String          @db.Uuid
  propertyId        String          @db.Uuid
  uid               String          /// iCal UID.
  kind              BookingKind     /// Reservation → GUEST, "Not available" → BLOCK.
  checkInDate       DateTime        @db.Date
  checkOutDate      DateTime        @db.Date
  rawSummary        String?
  /// SHA-256 of the normalised event. An unchanged re-fetch is a no-op.
  eventHash         String
  state             IcalImportState @default(PENDING)
  /// Booking this event created or updated (APPLIED), or was linked to (RESOLVED).
  bookingId         String?         @db.Uuid
  /// The existing booking(s) it clashed with, for the review screen.
  conflictBookingIds String[]       @db.Uuid
  /// e.g. OVERLAP, POSSIBLE_DUPLICATE, CANCELLED_IN_FINALIZED_MONTH, DATES_CHANGED_IN_FINALIZED_MONTH
  conflictReason    String?
  resolvedById      String?         @db.Uuid
  resolvedAt        DateTime?       @db.Timestamptz
  resolution        String?         /// LINK | REPLACE | IGNORE
  createdAt         DateTime        @default(now()) @db.Timestamptz

  @@index([propertyId, state])
  @@index([feedId, uid])
}

// ───────────────────────── Expenses & receipts ─────────────────────────  (Phase 2)

enum ExpenseCategory {
  CLEANING            /// Owner-stay cleans (system-created).
  SUPPLIES            /// Restocks bought by TruHost.
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
  OWNER    /// Deducted on the owner statement. MANUAL ones must have a receipt before the month can be finalized.
  TRUHOST  /// TruHost's own cost for this property. Not shown to owners.
}

enum ExpenseSource {
  MANUAL            /// Entered by an admin. If owner-borne, needs a receipt before its month can be finalized.
  OWNER_STAY_CLEAN  /// Created by the API when an owner-stay clean completes. The clean is its evidence; no receipt needed.
}

model Expense {
  id            String          @id @default(uuid(7)) @db.Uuid
  propertyId    String          @db.Uuid
  category      ExpenseCategory
  bearer        ExpenseBearer   @default(OWNER)
  source        ExpenseSource   @default(MANUAL)
  /// The owner-stay clean that generated this expense. Unique, so one clean produces at most one charge.
  cleanId       String?         @unique @db.Uuid
  /// Purchase date: the date on the receipt (for a system-created cleaning charge, the clean's date). Decides which
  /// statement month it lands in.
  incurredOn    DateTime        @db.Date
  vendor        String?
  description   String
  /// Total paid, including any tax. This is what is deducted. CHECK (>= 0).
  amountCents   Int
  /// Tax breakdown. Must be null unless TAX_FIELDS_ENABLED.
  gstCents      Int?
  pstCents      Int?
  enteredById   String          @db.Uuid
  /// Void instead of delete. Voided rows are excluded from all money computations.
  voidedAt      DateTime?       @db.Timestamptz
  voidedById    String?         @db.Uuid
  voidReason    String?
  version       Int             @default(0)
  createdAt     DateTime        @default(now()) @db.Timestamptz
  updatedAt     DateTime        @updatedAt @db.Timestamptz

  @@index([propertyId, incurredOn])
}

/// A receipt document. Usually attached to an expense. Several receipts per expense are allowed (e.g. a multi-page
/// invoice).
model Receipt {
  id           String    @id @default(uuid(7)) @db.Uuid
  propertyId   String    @db.Uuid
  expenseId    String?   @db.Uuid
  fileId       String    @unique @db.Uuid
  receiptDate  DateTime  @db.Date
  description  String?
  uploadedById String    @db.Uuid
  voidedAt     DateTime? @db.Timestamptz
  voidedById   String?   @db.Uuid
  voidReason   String?
  createdAt    DateTime  @default(now()) @db.Timestamptz
}

// ───────────────────────── Owner statements ─────────────────────────  (Phase 2b)

enum StatementStatus {
  DRAFT      /// Computed live on every read. Nothing is snapshotted.
  FINALIZED  /// Lines and totals snapshotted. The month's bookings and expenses are locked.
  RELEASED   /// Net paid out to the owner.
}

/// One per property per month. A DRAFT row only holds status. Lines are computed live until finalized.
model OwnerStatement {
  id                 String          @id @default(uuid(7)) @db.Uuid
  propertyId         String          @db.Uuid
  /// First day of the month this statement covers.
  periodMonth        DateTime        @db.Date
  status             StatementStatus @default(DRAFT)

  // Server-computed copy taken at finalize. Never entered by a person. Null while DRAFT.
  /// Plan rate in force for the month, copied so a later plan edit can't change history.
  managementFeeBps   Int?
  nightsBooked       Int?
  grossCents         Int?
  managementFeeCents Int?
  expensesCents      Int?
  adjustmentsCents   Int?            /// Signed.
  netCents           Int?            /// Signed. Can be negative (see §10 "Later").
  /// Version of the reporting code that produced the copy, so recomputations can be compared.
  calcVersion        Int?

  finalizedAt        DateTime?       @db.Timestamptz
  finalizedById      String?         @db.Uuid
  /// Date the money was sent (business date, entered by the admin). Distinct from releasedAt.
  releasedOn         DateTime?       @db.Date
  releasedAt         DateTime?       @db.Timestamptz
  releasedById       String?         @db.Uuid
  /// e-Transfer or bank reference, for reconciliation.
  paymentReference   String?
  createdAt          DateTime        @default(now()) @db.Timestamptz
  updatedAt          DateTime        @updatedAt @db.Timestamptz

  @@unique([propertyId, periodMonth])
}

enum StatementLineKind {
  BOOKING         /// Owner gross allocated to this month (positive).
  MANAGEMENT_FEE  /// Negative.
  EXPENSE         /// Negative.
  ADJUSTMENT      /// Signed.
}

/// Immutable copy written at finalize. What the owner sees for a finalized month.
model OwnerStatementLine {
  id           String            @id @default(uuid(7)) @db.Uuid
  statementId  String            @db.Uuid
  kind         StatementLineKind
  bookingId    String?           @db.Uuid
  expenseId    String?           @db.Uuid
  adjustmentId String?           @db.Uuid
  description  String
  /// Nights of the booking that fall in this month (BOOKING lines only).
  nights       Int?
  /// Signed, from the owner's point of view.
  amountCents  Int
  sortOrder    Int
  // + trigger: reject UPDATE and DELETE
}

enum AdjustmentKind {
  REVENUE  /// Changes owner gross. TruPlan fee applies to it on the statement it lands on.
  EXPENSE  /// Changes owner expenses. No fee effect.
  OTHER    /// Neither (e.g. goodwill credit). No fee effect.
}

/// A correction to an already-finalized month. It lands on the next non-finalized statement for the property.
model StatementAdjustment {
  id                   String         @id @default(uuid(7)) @db.Uuid
  propertyId           String         @db.Uuid
  kind                 AdjustmentKind
  /// Signed, from the owner's point of view (+ owner receives more).
  amountCents          Int
  reason               String
  /// What it corrects. Shown on the statement line.
  correctsStatementId  String?        @db.Uuid
  bookingId            String?        @db.Uuid
  expenseId            String?        @db.Uuid
  /// Set when the statement it landed on is finalized. After that the adjustment is immutable.
  appliedStatementId   String?        @db.Uuid
  createdById          String         @db.Uuid
  createdAt            DateTime       @default(now()) @db.Timestamptz
  voidedAt             DateTime?      @db.Timestamptz /// Only before it is applied.
  voidedById           String?        @db.Uuid
  voidReason           String?
}

// ───────────────────────── Files ─────────────────────────  (Phase 2)

enum FilePurpose {
  RECEIPT
  CLEAN_PHOTO
  DAMAGE_PHOTO
}

enum FileStatus {
  PENDING   /// Upload URL issued. Object may not exist yet.
  VERIFIED  /// Object exists in R2 with the declared size, type and SHA-256.
}

/// Every R2 object. Access is decided by the domain row it's attached to (Receipt, CleanPhoto, DamagePhoto), never by
/// this row alone.
model StoredFile {
  id               String      @id @default(uuid(7)) @db.Uuid
  purpose          FilePurpose
  /// Scoping key and R2 key prefix: properties/{propertyId}/{purpose}/{id}.
  propertyId       String      @db.Uuid
  r2Key            String      @unique
  contentType      String      /// Allow-listed: image/jpeg, image/png, image/heic, image/webp, application/pdf.
  sizeBytes        Int
  /// Hex SHA-256 declared by the client and enforced by R2 via x-amz-checksum-sha256 on the presigned PUT.
  sha256           String
  status           FileStatus  @default(PENDING)
  uploadedById     String      @db.Uuid
  /// Server time the upload was authorised. Evidence timestamp.
  createdAt        DateTime    @default(now()) @db.Timestamptz
  /// Server time the object was confirmed in R2.
  verifiedAt       DateTime?   @db.Timestamptz
  /// Device-reported capture time. Untrusted, context only.
  clientCapturedAt DateTime?   @db.Timestamptz
  originalFilename String?

  @@index([status, createdAt]) /// Nightly purge of PENDING rows older than 24h.
}

// ───────────────────────── Cleaning & cleaner pay ─────────────────────────  (Phase 3)

enum CleanKind {
  TURNOVER  /// Auto-created from a booking's checkout.
  ADHOC     /// Admin-created (deep clean, inspection).
}

enum CleanStatus {
  SCHEDULED
  IN_PROGRESS
  COMPLETE
  CANCELLED   /// The triggering booking was cancelled.
}

model Clean {
  id                String      @id @default(uuid(7)) @db.Uuid
  propertyId        String      @db.Uuid
  kind              CleanKind
  /// The stay whose checkout triggers this clean. One turnover per booking.
  bookingId         String?     @unique @db.Uuid
  scheduledDate     DateTime    @db.Date
  /// From checkout to the next check-in. Recomputed when bookings change. windowEnd is null if nothing follows.
  windowStart       DateTime?   @db.Timestamptz
  windowEnd         DateTime?   @db.Timestamptz
  status            CleanStatus @default(SCHEDULED)
  /// Defaults to Property.defaultCleanerId at creation; an admin can override. Must hold an active CLEANER membership
  /// on the property. Required to start. Frozen once COMPLETE, because it identifies who is owed the pay.
  assignedCleanerId String?     @db.Uuid
  startedAt         DateTime?   @db.Timestamptz
  startedById       String?     @db.Uuid
  completedAt       DateTime?   @db.Timestamptz
  completedById     String?     @db.Uuid
  cancelledAt       DateTime?   @db.Timestamptz
  cancelReason      String?
  notes             String?

  /// Amount owed to the assigned cleaner, copied from Property.defaultCleanerPayCents at creation. Admins can change
  /// it until paid. Only COMPLETE cleans are payable.
  cleanerPayCents   Int         @default(0)
  /// The active (non-voided) payment covering this clean. Non-null means paid. Voiding the payment clears it, and
  /// CleanerPaymentLine keeps the history.
  cleanerPaymentId  String?     @db.Uuid

  version           Int         @default(0)
  createdAt         DateTime    @default(now()) @db.Timestamptz
  updatedAt         DateTime    @updatedAt @db.Timestamptz

  @@unique([propertyId, id])
  @@index([propertyId, scheduledDate])
  @@index([assignedCleanerId, scheduledDate])
  @@index([assignedCleanerId, cleanerPaymentId])
}

/// One payment to one cleaner (e.g. an e-Transfer) that covers one or more completed cleans. The total is the sum of
/// its lines. Never edited or deleted. A mistake is voided (with a required reason) and re-recorded.
model CleanerPayment {
  id          String    @id @default(uuid(7)) @db.Uuid
  cleanerId   String    @db.Uuid
  paidOn      DateTime  @db.Date
  reference   String?   /// e-Transfer reference.
  note        String?
  createdById String    @db.Uuid
  createdAt   DateTime  @default(now()) @db.Timestamptz
  /// Voiding returns the covered cleans to unpaid. The only change ever allowed on this row, and only once (trigger).
  voidedAt    DateTime? @db.Timestamptz
  voidedById  String?   @db.Uuid
  /// Required when voided (CHECK).
  voidReason  String?
}

/// Which cleans a payment covered and how much was paid for each. A copy taken at payment time, immutable, so a voided
/// payment still shows exactly what it covered.
model CleanerPaymentLine {
  id          String @id @default(uuid(7)) @db.Uuid
  paymentId   String @db.Uuid
  cleanId     String @db.Uuid
  amountCents Int

  @@unique([paymentId, cleanId])
  @@index([cleanId])
}

enum PhotoPhase {
  BEFORE
  AFTER
}

/// Immutable. A bad shot is fixed by adding another photo, never by replacing one.
model CleanPhoto {
  id           String     @id @default(uuid(7)) @db.Uuid
  cleanId      String     @db.Uuid
  /// Denormalised so composite FKs prove the clean and the room share a property.
  propertyId   String     @db.Uuid
  roomId       String     @db.Uuid
  phase        PhotoPhase
  fileId       String     @unique @db.Uuid
  uploadedById String     @db.Uuid
  createdAt    DateTime   @default(now()) @db.Timestamptz
  // FK (propertyId, cleanId) → Clean(propertyId, id); FK (propertyId, roomId) → Room(propertyId, id)
  @@index([cleanId, roomId, phase])
}

// ───────────────────────── Supplies ─────────────────────────  (Phase 3)

model SupplyItem {
  id         String    @id @default(uuid(7)) @db.Uuid
  propertyId String    @db.Uuid
  name       String
  unit       String?
  sortOrder  Int       @default(0)
  archivedAt DateTime? @db.Timestamptz
  createdAt  DateTime  @default(now()) @db.Timestamptz

  @@unique([propertyId, name])
}

enum SupplyLevel {
  FULL
  OK
  LOW
  OUT
}

/// Append-only. The current level is the latest row, so history is kept.
model SupplyStatus {
  id           String      @id @default(uuid(7)) @db.Uuid
  supplyItemId String      @db.Uuid
  level        SupplyLevel
  note         String?
  cleanId      String?     @db.Uuid /// Set when recorded during a clean.
  reportedById String      @db.Uuid
  reportedAt   DateTime    @default(now()) @db.Timestamptz

  @@index([supplyItemId, reportedAt(sort: Desc)])
}

// ───────────────────────── Damage ─────────────────────────  (Phase 4)

enum DamageSeverity {
  MINOR
  MODERATE
  SEVERE
}

enum DamageStatus {
  DRAFT         /// Visible to its reporter and to admins only.
  SUBMITTED     /// Title, description and links are locked from here on.
  ACKNOWLEDGED
  CLAIM_FILED   /// Claim lodged with the channel (AirCover has a 14-day window after checkout).
  RESOLVED
}

model DamageReport {
  id                 String         @id @default(uuid(7)) @db.Uuid
  propertyId         String         @db.Uuid
  cleanId            String?        @db.Uuid /// The clean during which it was found.
  bookingId          String?        @db.Uuid /// The stay believed responsible (needed for claims).
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

  @@index([propertyId, status])
}

/// Immutable. Photos can be added after submission but never removed.
model DamagePhoto {
  id             String   @id @default(uuid(7)) @db.Uuid
  damageReportId String   @db.Uuid
  fileId         String   @unique @db.Uuid
  uploadedById   String   @db.Uuid
  createdAt      DateTime @default(now()) @db.Timestamptz
}

// ───────────────────────── Audit & infrastructure ─────────────────────────  (Phase 1)

enum ActorType {
  USER
  SYSTEM   /// Jobs (iCal sync, file purge) and the bootstrap CLI.
}

/// Append-only. Written in the same transaction as the change.
model AuditLog {
  id         String    @id @default(uuid(7)) @db.Uuid
  actorType  ActorType
  actorId    String?   @db.Uuid
  /// Dotted verb, e.g. "booking.update", "statement.finalize", "clean.pay".
  action     String
  entityType String
  entityId   String    @db.Uuid
  /// Denormalised so "everything on property X" is one indexed query.
  propertyId String?   @db.Uuid
  /// Changed fields only.
  before     Json?
  after      Json?
  requestId  String?
  ipAddress  String?
  createdAt  DateTime  @default(now()) @db.Timestamptz

  @@index([entityType, entityId])
  @@index([propertyId, createdAt])
  @@index([actorId, createdAt])
}

/// Makes POST retries safe for clients on flaky connections. The same key replays the stored response.
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

(Relations are omitted above for readability. In `schema.prisma` every `…Id`
column gets a real `@relation` with `onDelete: Restrict`.)

### Constraints added as raw SQL

| Table                                                                                               | Constraint                                                                                                                                                       | Why                                                                                        |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `Membership`                                                                                        | partial unique `(userId, propertyId, role) WHERE revokedAt IS NULL`                                                                                              | No duplicate active grants, while keeping revoked history.                                 |
| `PropertyPlan`                                                                                      | `CHECK (EXTRACT(day FROM effectiveFrom) = 1)` (same for `effectiveTo`); `EXCLUDE USING gist` on `daterange(effectiveFrom, effectiveTo)` per property             | One rate per statement month, and no overlapping plans.                                    |
| `Plan`                                                                                              | `CHECK (managementFeeBps BETWEEN 0 AND 10000)`; trigger blocks `managementFeeBps` updates once referenced                                                        | Reproducible statements.                                                                   |
| `Booking`                                                                                           | `CHECK (checkOutDate > checkInDate)`; `CHECK (guestCleaningFeeCents <= payoutCents)`; `CHECK (money >= 0)`; exclusion constraint below                           | Rejects impossible stays and typos.                                                        |
| `Expense`                                                                                           | `CHECK (amountCents >= 0)`                                                                                                                                       | Negative corrections are adjustments, not negative expenses.                               |
| `OwnerStatement`                                                                                    | `CHECK (EXTRACT(day FROM periodMonth) = 1)`                                                                                                                      | Month key.                                                                                 |
| `CleanPhoto`, `DamagePhoto`, `AuditLog`, `SupplyStatus`, `OwnerStatementLine`, `CleanerPaymentLine` | `BEFORE UPDATE OR DELETE` trigger raising an exception                                                                                                           | Evidence, audit and issued documents stay immutable even against buggy code or manual SQL. |
| `StoredFile`                                                                                        | trigger: `sha256`, `sizeBytes`, `r2Key` and `uploadedById` immutable; `status` only goes `PENDING → VERIFIED`                                                    | Evidence integrity.                                                                        |
| `CleanerPayment`                                                                                    | trigger: only `voidedAt`, `voidedById` and `voidReason` may change, only from null, and never DELETE; `CHECK (voidedAt IS NULL OR length(trim(voidReason)) > 0)` | Payments are voided, never edited or removed.                                              |
| `Expense`                                                                                           | `CHECK ((source = 'OWNER_STAY_CLEAN') = (cleanId IS NOT NULL))`                                                                                                  | System cleaning charges always point at their clean, and nothing else does.                |

### Booking overlap rules

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Booking" ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    "propertyId" WITH =,
    daterange("checkInDate", "checkOutDate", '[)') WITH &&
  ) WHERE (status = 'CONFIRMED');
```

1. **Same-day turnover is allowed.** `'[)'` is half-open: a stay
   `[Mar 1, Mar 4)` occupies the nights of the 1st, 2nd and 3rd, so a stay
   starting Mar 4 doesn't overlap.
2. **Cancelled bookings are ignored**, through the partial `WHERE (status =
'CONFIRMED')`. Cancelling a booking frees its dates. Re-confirming one goes
   through the constraint again.
3. **All kinds participate.** A GUEST stay can't overlap an OWNER_STAY or a
   BLOCK on the same property.
4. **Manual entry:** a violation (SQLSTATE `23P01`) is mapped to
   `409 BOOKING_OVERLAP` with the clashing booking id.
5. **iCal sync never relies on the constraint.** Events are written to
   `IcalImport` first. The sync then, per event, in one transaction:
   - same `uid` already linked → update dates if changed (if that would
     overlap, or if the booking is locked by a finalized statement →
     `CONFLICT`);
   - no link, but an existing CONFIRMED booking overlaps → `CONFLICT`
     (`POSSIBLE_DUPLICATE` when the dates match exactly, typically the same
     stay entered manually first, otherwise `OVERLAP`);
   - otherwise → insert Booking (`source = ICAL`, null money) → `APPLIED`;
   - an applied UID that disappears from the feed → cancel the booking, unless
     it is locked → `CONFLICT`.

   The admin resolves each conflict with **LINK** (attach the UID to the
   existing booking), **REPLACE** (cancel the existing booking and apply
   the import) or **IGNORE**. As a backstop, a `23P01` hit during sync is
   caught and turned into `CONFLICT` rather than failing the run.

   Tests for all of the above ship with the Booking migration (Phase 2) and
   the sync (Phase 6). The SQL itself gets a test in Phase 2: same-day
   turnover inserts, a one-night overlap is rejected, and a cancelled
   overlap is accepted.

### Not modelled (deliberately)

- **Organization / multi-tenancy** [A1].
- **Owner-owes-TruHost balances**: see §10 "Later".
- **Notifications**: after Phase 4.

---

## 4. Computed metrics and statements

All in `apps/api/src/reporting/` as pure functions with table-driven tests
(exact cents).

**Per booking:**
`ownerGross = payoutCents − guestCleaningFeeCents` (GUEST bookings only. A
null in either field makes the booking _incomplete_). Owners absorb Airbnb's
fee on the cleaning fee: the full cleaning fee is subtracted.

**Cancelled bookings that still pay out** count as revenue: all of their
`ownerGross` goes to the **check-in month**, with **zero nights booked**.
They are not split per night and don't affect avg. nightly earnings'
denominator.

**Allocation to months (Q7: split per night):** a booking's `ownerGross` is
split across its nights. Each night gets `floor(ownerGross / nights)`, and
the remainder cents go one each to the earliest nights, so the parts always
sum exactly to the whole. A month's share is the sum of its nights. The
cleaning fee (TruHost revenue) is attributed to the checkout date.

For a property and month `M` (property-local):

| Metric                    | Definition                                                                                                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nights booked**         | Nights `d ∈ M` covered by a CONFIRMED GUEST booking. Owner stays and blocks are reported separately.                                                                                                                 |
| **Gross revenue**         | Σ allocated `ownerGross` for nights in `M`.                                                                                                                                                                          |
| **TruPlan fee**           | `roundHalfUp(gross × managementFeeBps / 10000)`, **rounded once on the month total** with the plan in force on the 1st of `M`.                                                                                       |
| **Owner expenses**        | Σ `amountCents` of non-voided `bearer = OWNER` expenses with `incurredOn` (purchase date) `∈ M`, including owner-stay cleaning charges.                                                                              |
| **Adjustments**           | Σ unvoided adjustments landing on this statement. REVENUE adjustments add to the fee base.                                                                                                                           |
| **Net revenue**           | Gross + REVENUE adj − fee(gross + REVENUE adj) − expenses + EXPENSE adj + OTHER adj.                                                                                                                                 |
| **Avg. nightly earnings** | Gross from CONFIRMED stays in `M` ÷ nights booked, to the nearest cent. Labelled "Avg. nightly earnings", never "ADR": it is net of Airbnb's fee and the cleaning fee, so it is lower than the listed nightly price. |
| **Occupancy**             | Nights booked ÷ (days in `M` − owner-stay nights − block nights).                                                                                                                                                    |

Reports for arbitrary ranges use the same per-night allocation. The fee for a
range is the sum of each month's fee, so ranges always agree with
statements.

**Statement lifecycle:**

- **DRAFT**: created on demand (or by a monthly job) for `periodMonth`. Every
  read recomputes lines live. Flags problems that block finalizing:
  incomplete bookings (null money), MANUAL owner-borne expenses with no
  receipt, and an earlier month for the property that is not finalized yet.
- **Finalize** (admin) runs in one serializable transaction: it locks the
  statement row, re-checks the blockers (422 with a list), copies the lines
  into `OwnerStatementLine`, writes the totals and `managementFeeBps`, stamps
  pending adjustments with `appliedStatementId`, and writes the audit log.
- **Lock**: from then on, any create, update, cancel or void of a Booking
  with a night in a finalized month, or of an Expense with `incurredOn` in
  one, returns `409 PERIOD_LOCKED`. The check runs in the service, inside
  the mutation's transaction, with `FOR SHARE` on the statement row, so it
  can't race a concurrent finalize. A booking that straddles an open and a
  finalized month is locked as a whole. Corrections become a
  `StatementAdjustment`, which lands on the earliest non-finalized statement.
- **Release** (admin): FINALIZED → RELEASED with `releasedOn` and
  `paymentReference`. Audited. Refused when `netCents < 0` until the
  owner-owes flow exists (§10 "Later").
- **Owners** see FINALIZED and RELEASED statements, plus a live
  "current month (estimate)" built from the same functions.

**Owner-stay cleaning charge:** when a turnover clean for an OWNER_STAY
booking reaches COMPLETE, the same transaction creates an Expense: `source =
OWNER_STAY_CLEAN`, `bearer = OWNER`, `category = CLEANING`, `cleanId` set,
`incurredOn` = the clean's scheduled date, and `amountCents` = the property's
`standardCleaningFeeCents` at that moment. If that month is already finalized,
the charge becomes an EXPENSE adjustment on the next statement instead.

**TruHost revenue report (admin):** guest cleaning fees (by checkout date) +
owner-stay cleaning charges + TruPlan fees − cleaner pay (completed cleans by
completion date, excluding voided payments) − TRUHOST-borne expenses.

---

## 5. Cross-cutting API design

- **Base path** `/v1`. JSON. OpenAPI generated from the zod schemas in
  `@truhost/shared` (via `z.toJSONSchema` and `@nestjs/swagger`), served at
  `/v1/docs` outside production. Web (and later mobile) use
  `packages/api-client` (`openapi-fetch` + `openapi-typescript`).
- **Errors**: RFC 9457 `application/problem+json` with a stable `code`
  (`CLEAN_MISSING_PHOTOS`, `PERIOD_LOCKED`, `BOOKING_OVERLAP`, ...).
- **Pagination**: cursor-based (`?cursor=&limit=`, max 100).
- **CORS**: allow-list from `CORS_ORIGINS` (the Cloudflare Pages domain and
  `http://localhost:3001`). There are no cookies: auth is a bearer token, so
  no CSRF surface.
- **Authentication**: the SPA gets a Clerk session token with
  `useAuth().getToken()` and sends `Authorization: Bearer <jwt>` on every
  call. The API verifies it with `@clerk/backend` `verifyToken` (JWKS,
  networkless, checks `azp` against `CORS_ORIGINS`). Then:
  - **Known `clerkUserId`** → load the User. DEACTIVATED returns 401.
  - **Unknown `clerkUserId`** → first sign-in. Fetch the Clerk user, take its
    _verified_ primary email, find a User in status INVITED with that email,
    link `clerkUserId`, set ACTIVE, and mark the invite ACCEPTED. No match
    returns 403 `NOT_INVITED`. This runs on the `auth` rate-limit tier.
  - This avoids depending on a public webhook URL, so it works locally. A
    Clerk webhook (`user.deleted` → deactivate) can come later.
  - Clerk runs in Restricted sign-up mode, so only invited emails can create
    accounts.
- **Invite emails are sent by us through Resend, not by Clerk.** `POST
/invites` creates the Clerk invitation with `notify: false` (Clerk sends
  nothing but returns a sign-up ticket URL). It then sends our own email
  through Resend containing that URL, and stores the Resend message id. Resend
  replaces the provider invitation and emails the new URL. Email lives behind
  an `EmailSender` interface (fake in tests) so templates and provider stay in
  one place.
- **Authorization**: `AccessService` (`src/access/`) owns one policy table,
  `(role, resource, action) → scope`. Services call
  `access.assert(actor, action, { propertyId })` for one target, and
  `access.propertyScope(actor, action)` to get a Prisma `where` fragment for
  lists. Admin access is a superset, and an admin with an OWNER membership
  gets nothing extra from it. Out-of-scope access returns **404**.
- **Authz test matrix**: `test/authz/` seeds two properties, each with an
  owner and a cleaner, plus an admin who also owns property A. Every route
  is called as every role against both properties. A meta-test enumerates
  the router and fails if any route lacks an entry.
- **Idempotency**: `Idempotency-Key` is accepted on all POSTs and required on
  cleaner-facing POSTs.
- **Concurrency**: `version` on mutable money rows and cleans. A mismatch
  returns 409.
- **Rate limiting** (`@nestjs/throttler`, keyed by user id, or by IP when
  unauthenticated). Storage is in-memory while there is one Railway replica,
  and Redis once it scales out.

  | Tier      | Limit           | Applies to                                      |
  | --------- | --------------- | ----------------------------------------------- |
  | `default` | 120 / min       | All authenticated routes                        |
  | `write`   | 30 / min        | Mutating routes                                 |
  | `upload`  | 60 / 10 min     | `POST /uploads`                                 |
  | `auth`    | 10 / min per IP | First-sign-in linking, `/invites*`, `PATCH /me` |
  | `public`  | 30 / min per IP | `/health`                                       |

- **Uploads**: the client declares `{purpose, propertyId, contentType,
sizeBytes, sha256}` and gets back a 10-minute presigned PUT URL that signs
  type, length and `x-amz-checksum-sha256`. After uploading, the client calls
  the domain attach route. The API `HEAD`s the object, marks the file
  VERIFIED and creates the immutable row in one transaction. Viewing goes
  through `GET /files/:id/url` (5-minute signed GET, authorised via the
  attached row).
- **Audit**: `AuditService.record(tx, …)` requires the transaction client.
  Every admin mutation of money (bookings, expenses, plans, statements,
  adjustments, cleaner pay), documents (receipts), access (memberships,
  users, invites) and damage status is recorded.
- **Settings**: env-driven (`TAX_FIELDS_ENABLED`), exposed read-only at
  `GET /config` so the UI can hide fields.
- **URLs and email are environment variables** (domains aren't chosen yet).
  Placeholders until then:

  | Variable         | Where | Placeholder                                                         |
  | ---------------- | ----- | ------------------------------------------------------------------- |
  | `WEB_URL`        | api   | `https://app.truhost.example` (used to build invite redirect links) |
  | `CORS_ORIGINS`   | api   | `https://app.truhost.example`                                       |
  | `RESEND_API_KEY` | api   | empty (emails are logged, not sent, when unset outside production)  |
  | `EMAIL_FROM`     | api   | `TruHost <no-reply@truhost.example>`                                |
  | `VITE_API_URL`   | web   | `https://api.truhost.example`                                       |

  `INVITE_REDIRECT_URL` (Phase 1) is replaced by `${WEB_URL}/sign-up`.

- **Hosting**: API on Railway (US West). Neon Postgres in the same region
  (AWS us-west-2). Web on Cloudflare Pages (static, SPA fallback). R2
  bucket for files. US data storage is disclosed in the privacy policy.

---

## 6. REST API surface

Roles: **A** = admin, **O** = owner (own properties), **C** = cleaner
(assigned properties). All paths are under `/v1`. _Phase_ in brackets.

### Health & config

| Method | Path      | Roles  | Notes                                   |
| ------ | --------- | ------ | --------------------------------------- |
| GET    | `/health` | public | Already built. [0]                      |
| GET    | `/config` | A O C  | Feature flags (`taxFieldsEnabled`). [1] |

### Me

| Method | Path           | Roles | Notes                                                                                               |
| ------ | -------------- | ----- | --------------------------------------------------------------------------------------------------- |
| GET    | `/me`          | A O C | Profile, staffRole, active memberships with property names. Drives navigation. [1]                  |
| PATCH  | `/me`          | A O C | Name and phone. [1]                                                                                 |
| GET    | `/me/earnings` | C     | Completed cleans with pay and paid/unpaid status (voided payments show as unpaid), plus totals. [3] |

### Users & invites

| Method | Path                    | Roles | Notes                                                                                                                                                                                                    |
| ------ | ----------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/users`                | A     | [1]                                                                                                                                                                                                      |
| GET    | `/users/:id`            | A     | [1]                                                                                                                                                                                                      |
| PATCH  | `/users/:id`            | A     | Name, phone, staffRole. Audited. [1]                                                                                                                                                                     |
| POST   | `/users/:id/deactivate` | A     | Not self. Audited. Revokes Clerk sessions. [1]                                                                                                                                                           |
| POST   | `/invites`              | A     | `{ email, firstName, lastName, staffRole?, memberships[] }`. Creates the INVITED User, memberships and a Clerk invitation (`notify: false`), then emails its link via Resend. Audited. [1, Resend in 2a] |
| GET    | `/invites`              | A     | [1]                                                                                                                                                                                                      |
| POST   | `/invites/:id/resend`   | A     | Replaces the Clerk invitation and re-sends our email. [1]                                                                                                                                                |
| POST   | `/invites/:id/revoke`   | A     | Audited. [1]                                                                                                                                                                                             |

### Properties, memberships, rooms

| Method | Path                          | Roles | Notes                                                                                                                 |
| ------ | ----------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------- |
| GET    | `/properties`                 | A O C | Scoped. Field set depends on role. [1]                                                                                |
| POST   | `/properties`                 | A     | Audited. [1]                                                                                                          |
| GET    | `/properties/:id`             | A O C | `defaultCleanerId`, `defaultCleanerPayCents` and `standardCleaningFeeCents` for A only. [1]                           |
| PATCH  | `/properties/:id`             | A     | Audited. `defaultCleanerId` must hold an active CLEANER membership on the property (422 otherwise). [1, fields in 2a] |
| POST   | `/properties/:id/archive`     | A     | Audited. [1]                                                                                                          |
| GET    | `/properties/:id/memberships` | A     | [1]                                                                                                                   |
| POST   | `/properties/:id/memberships` | A     | `{ userId, role }`. Audited. [1]                                                                                      |
| POST   | `/memberships/:id/revoke`     | A     | Audited. [1]                                                                                                          |
| GET    | `/properties/:id/rooms`       | A O C | [1]                                                                                                                   |
| POST   | `/properties/:id/rooms`       | A     | [1]                                                                                                                   |
| PATCH  | `/rooms/:id`                  | A     | [1]                                                                                                                   |
| POST   | `/rooms/:id/archive`          | A     | [1]                                                                                                                   |
| PUT    | `/properties/:id/rooms/order` | A     | [1]                                                                                                                   |

### Plans

| Method | Path                   | Roles | Notes                                                      |
| ------ | ---------------------- | ----- | ---------------------------------------------------------- |
| GET    | `/plans`               | A     | [1]                                                        |
| POST   | `/plans`               | A     | Audited. [1]                                               |
| PATCH  | `/plans/:id`           | A     | Name and description. Rate only if unused. Audited. [1]    |
| GET    | `/properties/:id/plan` | A O   | Current plan plus history. [1]                             |
| POST   | `/properties/:id/plan` | A     | `{ planId, effectiveFrom }` (1st of a month). Audited. [1] |

### Bookings & calendar [2]

| Method | Path                       | Roles | Notes                                                     |
| ------ | -------------------------- | ----- | --------------------------------------------------------- |
| GET    | `/bookings`                | A     | Cross-property, filters.                                  |
| GET    | `/properties/:id/bookings` | A O   | O: no guest PII, and money shown as ownerGross only.      |
| GET    | `/bookings/:id`            | A O   | Same redaction.                                           |
| POST   | `/properties/:id/bookings` | A     | MANUAL. 409 `BOOKING_OVERLAP` / `PERIOD_LOCKED`. Audited. |
| PATCH  | `/bookings/:id`            | A     | Requires `version`. Audited.                              |
| POST   | `/bookings/:id/cancel`     | A     | Audited.                                                  |
| GET    | `/properties/:id/calendar` | A O   | Bookings, blocks and cleans, minimal fields.              |

### Expenses & receipts [2]

| Method | Path                       | Roles | Notes                                                         |
| ------ | -------------------------- | ----- | ------------------------------------------------------------- |
| GET    | `/expenses`                | A     | Cross-property.                                               |
| GET    | `/properties/:id/expenses` | A O   | O: `bearer = OWNER` only.                                     |
| POST   | `/properties/:id/expenses` | A     | Audited.                                                      |
| PATCH  | `/expenses/:id`            | A     | Requires `version`. Audited.                                  |
| POST   | `/expenses/:id/void`       | A     | Audited.                                                      |
| GET    | `/properties/:id/receipts` | A O   | O: receipts on OWNER-borne expenses.                          |
| POST   | `/properties/:id/receipts` | A     | `{ fileId, expenseId?, receiptDate, description? }`. Audited. |
| POST   | `/receipts/:id/void`       | A     | Audited.                                                      |

### Files [2]

| Method | Path             | Roles | Notes                                                    |
| ------ | ---------------- | ----- | -------------------------------------------------------- |
| POST   | `/uploads`       | A C   | Presigned PUT. C: photo purposes on own properties only. |
| GET    | `/files/:id/url` | A O C | Signed GET (5 min), authorised via the attached row.     |

### Statements, adjustments, reports [2b]

| Method | Path                              | Roles | Notes                                                                                                  |
| ------ | --------------------------------- | ----- | ------------------------------------------------------------------------------------------------------ |
| GET    | `/properties/:id/statements`      | A O   | O: FINALIZED and RELEASED only.                                                                        |
| POST   | `/properties/:id/statements`      | A     | `{ periodMonth }`. Creates the DRAFT (idempotent).                                                     |
| GET    | `/statements/:id`                 | A O   | DRAFT: live lines plus blockers. Otherwise the stored copy.                                            |
| POST   | `/statements/:id/finalize`        | A     | 422 with a list of blockers. Audited.                                                                  |
| POST   | `/statements/:id/release`         | A     | `{ releasedOn, paymentReference }`. Audited.                                                           |
| GET    | `/properties/:id/adjustments`     | A     |                                                                                                        |
| POST   | `/properties/:id/adjustments`     | A     | Audited.                                                                                               |
| POST   | `/adjustments/:id/void`           | A     | Only before it is applied. Audited.                                                                    |
| GET    | `/properties/:id/summary`         | A O   | `?from&to`. Nights, gross, fee, expenses, net, avg. nightly earnings, occupancy, `incompleteBookings`. |
| GET    | `/properties/:id/summary/monthly` | A O   | `?year`                                                                                                |
| GET    | `/reports/portfolio`              | A     |                                                                                                        |
| GET    | `/reports/truhost`                | A     | TruHost revenue: cleaning fees, plan fees, cleaner pay.                                                |

### Cleans & cleaner pay [3]

| Method | Path                         | Roles           | Notes                                                                                                                                                |
| ------ | ---------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/cleans`                    | A O C           | `?propertyId&from&to&status&assignee=me`. O: no pay fields. C: pay only on own cleans.                                                               |
| GET    | `/cleans/:id`                | A O C           | Includes the room checklist.                                                                                                                         |
| POST   | `/properties/:id/cleans`     | A               | ADHOC.                                                                                                                                               |
| PATCH  | `/cleans/:id`                | A               | Override the assigned cleaner, reschedule, notes (SCHEDULED only). `cleanerPayCents` (until paid). Audited.                                          |
| POST   | `/cleans/:id/start`          | A, C (assignee) | SCHEDULED → IN_PROGRESS. A cleaner may start only on `scheduledDate` in the property's time zone (422 `CLEAN_NOT_TODAY`). Admins may start any time. |
| POST   | `/cleans/:id/photos`         | A, C (assignee) | IN_PROGRESS only.                                                                                                                                    |
| GET    | `/cleans/:id/photos`         | A O C           |                                                                                                                                                      |
| POST   | `/cleans/:id/complete`       | A, C (assignee) | 422 `CLEAN_MISSING_PHOTOS` with the missing rooms and phases.                                                                                        |
| POST   | `/cleans/:id/cancel`         | A               | Audited.                                                                                                                                             |
| GET    | `/cleaner-pay`               | A               | `?cleanerId&status=unpaid\|paid&from&to`. Totals per cleaner.                                                                                        |
| POST   | `/cleaner-payments`          | A               | `{ cleanerId, cleanIds[], paidOn, reference? }`. All cleans must be COMPLETE, unpaid and assigned to that cleaner. Audited.                          |
| GET    | `/cleaner-payments`          | A               | Includes voided payments, flagged.                                                                                                                   |
| POST   | `/cleaner-payments/:id/void` | A               | `{ reason }` (required). Returns its cleans to unpaid. Never deletes. Audited.                                                                       |

### Supplies [3]

| Method | Path                              | Roles | Notes                          |
| ------ | --------------------------------- | ----- | ------------------------------ |
| GET    | `/properties/:id/supplies`        | A O C | Items with latest level.       |
| POST   | `/properties/:id/supplies`        | A     |                                |
| PATCH  | `/supply-items/:id`               | A     |                                |
| POST   | `/supply-items/:id/archive`       | A     |                                |
| POST   | `/properties/:id/supply-statuses` | A C   | Batch readings. Append-only.   |
| GET    | `/supply-items/:id/history`       | A O   |                                |
| GET    | `/supplies/restock`               | A     | LOW and OUT across properties. |

### Damage reports [4]

| Method | Path                             | Roles           | Notes                                                                 |
| ------ | -------------------------------- | --------------- | --------------------------------------------------------------------- |
| GET    | `/damage-reports`                | A O C           | O: no DRAFTs. C: submitted reports on own properties plus own drafts. |
| GET    | `/damage-reports/:id`            | A O C           | Same rules.                                                           |
| POST   | `/properties/:id/damage-reports` | A C             | DRAFT.                                                                |
| PATCH  | `/damage-reports/:id`            | A, C (reporter) | DRAFT only.                                                           |
| POST   | `/damage-reports/:id/photos`     | A, C (reporter) | Append-only.                                                          |
| POST   | `/damage-reports/:id/submit`     | A, C (reporter) | 422 `DAMAGE_REPORT_NO_PHOTOS`.                                        |
| POST   | `/damage-reports/:id/status`     | A               | Forward-only. Audited.                                                |

### iCal [6]

| Method     | Path                         | Roles | Notes                                                     |
| ---------- | ---------------------------- | ----- | --------------------------------------------------------- |
| GET / POST | `/properties/:id/ical-feeds` | A     | URL is write-only (never returned).                       |
| PATCH      | `/ical-feeds/:id`            | A     |                                                           |
| POST       | `/ical-feeds/:id/sync`       | A     | Manual trigger.                                           |
| GET        | `/ical-imports`              | A     | `?state=CONFLICT`                                         |
| POST       | `/ical-imports/:id/resolve`  | A     | `{ action: LINK\|REPLACE\|IGNORE, bookingId? }`. Audited. |

### Audit

| Method | Path          | Roles | Notes                  |
| ------ | ------------- | ----- | ---------------------- |
| GET    | `/audit-logs` | A     | Filters. [1 API, 4 UI] |

---

## 7. Permissions matrix

**all** = any property · **own** = properties where the caller has an active
membership in that role · **self** = caller's own records · **assigned** =
cleans with `assignedCleanerId = caller` · — = denied (404).

| Resource                                                                    | Action                          | Admin | Owner                               | Cleaner                       |
| --------------------------------------------------------------------------- | ------------------------------- | ----- | ----------------------------------- | ----------------------------- |
| Me                                                                          | read / update                   | self  | self                                | self                          |
| Cleaner earnings                                                            | read                            | —     | —                                   | self                          |
| Config                                                                      | read                            | ✓     | ✓                                   | ✓                             |
| User, Invite                                                                | any                             | all   | —                                   | —                             |
| Property                                                                    | list / read                     | all   | own                                 | own (no money or plan fields) |
| Property                                                                    | create / update / archive       | all   | —                                   | —                             |
| Property admin fields (default cleaner, cleaner pay, standard cleaning fee) | read                            | all   | —                                   | —                             |
| Membership                                                                  | list / create / revoke          | all   | —                                   | —                             |
| Room                                                                        | list / read                     | all   | own                                 | own                           |
| Room                                                                        | write                           | all   | —                                   | —                             |
| Plan                                                                        | any                             | all   | —                                   | —                             |
| Property plan                                                               | read                            | all   | own                                 | —                             |
| Property plan                                                               | assign                          | all   | —                                   | —                             |
| Booking                                                                     | list / read                     | all   | own (no guest PII; ownerGross only) | —                             |
| Booking                                                                     | create / update / cancel        | all   | —                                   | —                             |
| Calendar                                                                    | read                            | all   | own                                 | —                             |
| Expense                                                                     | list / read                     | all   | own, `bearer = OWNER`               | —                             |
| Expense                                                                     | write / void                    | all   | —                                   | —                             |
| Receipt                                                                     | list / read file                | all   | own, OWNER-borne                    | —                             |
| Receipt                                                                     | create / void                   | all   | —                                   | —                             |
| Upload URL                                                                  | create                          | all   | —                                   | own (photo purposes)          |
| Statement                                                                   | list / read                     | all   | own, FINALIZED or RELEASED          | —                             |
| Statement                                                                   | create / finalize / release     | all   | —                                   | —                             |
| Adjustment                                                                  | any                             | all   | — (seen as statement lines)         | —                             |
| Property summary                                                            | read                            | all   | own                                 | —                             |
| Portfolio and TruHost reports                                               | read                            | all   | —                                   | —                             |
| Clean                                                                       | list / read                     | all   | own (no pay fields)                 | own                           |
| Clean                                                                       | create / update / cancel        | all   | —                                   | —                             |
| Clean                                                                       | start / complete / add photo    | all   | —                                   | own + assigned                |
| Clean pay fields                                                            | read                            | all   | —                                   | assigned (self)               |
| Cleaner payment                                                             | create / list / void            | all   | —                                   | —                             |
| Clean photo                                                                 | read file                       | all   | own                                 | own                           |
| Clean photo, damage photo                                                   | update / delete                 | —     | —                                   | —                             |
| Supply item                                                                 | list / read                     | all   | own                                 | own                           |
| Supply item                                                                 | write                           | all   | —                                   | —                             |
| Supply status                                                               | create                          | all   | —                                   | own                           |
| Supply status                                                               | history                         | all   | own                                 | —                             |
| Damage report                                                               | list / read                     | all   | own, not DRAFT                      | own submitted + self drafts   |
| Damage report                                                               | create                          | all   | —                                   | own                           |
| Damage report                                                               | edit draft / submit / add photo | all   | —                                   | self                          |
| Damage report                                                               | change status                   | all   | —                                   | —                             |
| iCal feeds and imports                                                      | any                             | all   | —                                   | —                             |
| Audit log                                                                   | read                            | all   | —                                   | —                             |

**Required negative tests** (built in Phase 1 and extended each phase):

- Owner A gets nothing from property B: bookings, expenses, receipts,
  statements, summaries, cleans, photos, damage reports, supplies or file
  URLs.
- Cleaner A gets nothing from property B either.
- A cleaner can't act on someone else's clean, or see another cleaner's pay.
- A revoked membership loses access immediately. A deactivated user gets 401. An uninvited Clerk user gets 403.
- An admin who owns property A gets the same admin access everywhere, and
  the owner view of A shows exactly what any other owner would see.

---

## 8. Assumptions

- **A1** Single company: no `Organization`.
- **A2** One staff role (ADMIN).
- **A3** CAD only.
- **A4** Users are created at invite time (INVITED) and linked on first sign-in
  by verified email. The first admin comes from a bootstrap CLI, since there
  is no admin yet to invite them.
- **A5** Every non-archived room needs BEFORE and AFTER photos, evaluated at
  completion.
- **A6** Photos are uploaded only while a clean is IN_PROGRESS.
- **A7** GUEST and OWNER_STAY checkouts each create one turnover clean.
  BLOCKs don't.
- **A8** Cleaners see cleans and windows, not bookings or guest names. Owners
  never see guest PII.
- **A9** Photo originals (with EXIF) are kept as evidence.
- **A10** R2 enforces `x-amz-checksum-sha256` on presigned PUTs (verified in
  Phase 2; the fallback is server-side hashing on attach).
- **A11** The monthly fee is rounded once, half-up, on the month total, not
  per booking.
- **A12** Plan changes start on the 1st of a month.
- **A13** _(Decided 2026-10-06.)_ A cancelled stay that still pays out
  counts as revenue in its check-in month, with zero nights booked.
- **A14** Statements are finalized in month order per property.
- **A15** The cleaner owed for a clean is the assignee at completion. Admins
  can complete on a cleaner's behalf, but the pay still goes to the
  assignee.
- **A16** _(Decided 2026-10-06.)_ OWNER_STAY cleans pay the cleaner as
  usual, and the owner is charged the property's standard cleaning fee as an
  owner-borne expense ([§4](#4-computed-metrics-and-statements)).
- **A17** The web app is a static SPA: no SSR or SEO, and only signed-in
  users use it.

---

## 9. Open questions (non-blocking)

Still open:

- **N5 Negative months:** when expenses exceed revenue, release is blocked.
  The owner-owes flow (carry forward vs. request payment) is in "Later".
- **N12b Low supplies:** should LOW/OUT readings notify someone, and who?
  (Notifications are in "Later".)
- **N14 Owner-stay charge timing:** the charge is created when the clean
  completes. If an owner stay is cancelled after its clean was done, the
  charge stands unless an admin voids it. Is that right?

Resolved 2026-10-06 (kept for traceability):

| #   | Question                                    | Decision                                                                                                   |
| --- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Q1  | Several owners per property?                | Yes, as built.                                                                                             |
| N1  | Who pays for the clean after an owner stay? | The owner: an owner-borne CLEANING expense at the property's standard cleaning fee.                        |
| N2  | "ADR" label                                 | Show "Avg. nightly earnings", not ADR.                                                                     |
| N3  | Cancelled stay that still pays out          | Revenue in its check-in month, zero nights.                                                                |
| N4  | Airbnb's fee on the cleaning fee            | Owners absorb it; gross = payout − full cleaning fee.                                                      |
| N6  | Expense month                               | Purchase date (the date on the receipt).                                                                   |
| N7  | Lockbox codes                               | Not stored in the app. Revisit with proper secret handling ("Later").                                      |
| N8  | Clean assignment and timing                 | Default cleaner per property, admin override per clean; a cleaner may start any time on the scheduled day. |
| N9  | Mistaken cleaner payment                    | Voidable with a required reason; never deleted; audited.                                                   |
| N10 | Bad photos                                  | Later: a separate flag record; photos stay immutable.                                                      |
| N11 | Damage cost recovery                        | Later: claim status and amount recovered on damage reports.                                                |
| N12 | Supplies                                    | TruHost restocks and records an owner-borne SUPPLIES expense with a receipt.                               |
| N13 | Domains and invite email                    | Not chosen: env vars with placeholders. Invite emails sent by us through Resend, not Clerk.                |

---

## 10. Build order

Each phase ends with something you can run. Tests are written in each phase,
never deferred.

### Phase 0: Scaffold ✅

pnpm + Turborepo, `apps/api` (Nest 12), `apps/web` (Vite + React + TanStack
Router/Query + Tailwind 4 + Clerk), `packages/shared`. `GET /health`.

### Phase 1: Identity, access and properties ✅

Built:

- Prisma 7 schema and initial migration: User, Invite, Membership, Property,
  Room, Plan, PropertyPlan, AuditLog, IdempotencyKey, plus raw SQL for
  `btree_gist`, the partial membership unique index, plan-period CHECK and
  EXCLUDE constraints, the plan-rate immutability trigger, the append-only
  audit trigger, and the lower-case email CHECK.
- `AuthGuard` (Clerk token → our User + memberships on every request, with
  first-sign-in linking), `AccessService` + `policy.ts`, `AuditService`,
  three-guard rate limiting (per-IP before auth, per-user after), RFC 9457
  errors, zod request validation, and response schemas that strip undeclared
  fields.
- Routes: `/health`, `/me`, `/config`, users, invites, properties,
  memberships, rooms, plans, property plan, audit logs.
- Tests:
  - an authz matrix covering every route × 6 actors + anonymous, with a
    route-coverage meta-test;
  - e2e tests for linking, redaction, invites, last-admin protection, plan
    locking, DB constraints and rate limits;
  - unit tests for access, audit diffs and dates, and a compile-time
    shared-enum drift check.
- `packages/api-client`: OpenAPI → `openapi-fetch` types. CI fails on drift.
- Bootstrap CLI: TruPlan 22%, first admin, optional first property with the
  admin as owner.
- Web:
  - Clerk sign-in/up and a role-aware shell.
  - Admin screens: properties (create, edit, archive), rooms (add,
    reorder, archive), members, plan assignment, team (invite, resend,
    revoke, deactivate) and plans.
  - Owner and cleaner screens: My properties and the property view.
  - Account page.
- CI: GitHub Actions with Postgres 17: prettier, lint, typecheck, unit,
  e2e, build, OpenAPI drift.

Deferred, by design:

- The idempotency-key interceptor (the table exists) ships with the first
  cleaner POSTs in Phase 3.
- Audit-log viewer UI ships in Phase 4. The API is already there.
- Plan assignment can't yet check for finalized statement months. It gets
  that check in Phase 2b (marked `TODO(phase 2b)`).

**Run:** `pnpm --filter @truhost/api bootstrap -- --admin-email … --property-name …`,
then `pnpm dev`. Sign in with that email (Clerk dev instance), edit the
property and rooms, invite a test cleaner, sign in as them and see only that
property.

### Phase 2a: Bookings, expenses, receipts, owner dashboard + first deploy

First, Phase 1 follow-ups from the 2026-10-06 answers:

- Migration to drop `Property.accessInstructions`, and its removal from the
  API, policy (`property:readAccessInstructions`), web forms, fixtures and
  tests (N7).
- Add `Property.defaultCleanerId` and `standardCleaningFeeCents`, with
  validation (the default cleaner must be an active cleaner of the
  property). Revoking that cleaner's membership clears the default (N8).
- Invites through Resend: an `EmailSender` interface with a Resend
  implementation and a fake for tests; Clerk invitations with
  `notify: false`; `WEB_URL`, `EMAIL_FROM` and `RESEND_API_KEY` env vars with
  placeholders (N13).

Then: Booking (with the overlap constraint and its tests), Expense
(including `source`/`cleanId`), Receipt, StoredFile and R2. The reporting
functions, including cancelled-with-payout handling. Owner dashboard (nights,
gross, fee, expenses, net, avg. nightly earnings, calendar, receipts). Deploy: Railway (API),
Neon (prod), Cloudflare Pages (web), R2 bucket.
**Run:** on the deployed site, enter last month's real bookings for your
property and see the owner dashboard.

### Phase 2b: Owner statements

OwnerStatement, lines, adjustments, finalize/lock/release, the TruHost
revenue report, and statement screens for admin and owner.
**Run:** finalize and release last month's statement, then try to edit a
locked booking (409) and add an adjustment that lands on the next month.

### Phase 3: Cleaning and cleaner pay

Clean (auto from bookings, assigned to the property's default cleaner),
CleanPhoto, the state machine and its guard (including the scheduled-day
start rule), supplies, cleaner pay, payments with void, and the owner-stay
cleaning charge. Mobile-first cleaner screens: schedule,
room checklist with camera upload, supplies, earnings. Admin schedule
board, assignment and pay run.
**Run:** a booking creates a clean, a cleaner completes it on a phone
(completion is refused while a photo is missing), and the admin records the
payment.

### Phase 4: Damage reports and audit viewer

**Run:** file a report from a phone, triage it as admin and see it as the
owner.

### Phase 5: Hardening

Sentry, backups and PITR drill, R2 bucket lock for evidence prefixes,
security review, rate-limit tuning, Redis if scaled out, privacy policy page.

### Phase 6: iCal sync

IcalFeed, IcalImport staging, scheduled sync (Railway cron), conflict review
UI, and a "needs financials" queue.

### Later

- **Owner owes TruHost:** a month where expenses exceed revenue (net < 0).
  Options: carry the balance forward as an automatic adjustment on the next
  statement, or issue a payment request. Decide before the first negative
  month.
- Expo app (`apps/mobile`) on the same API.
- PMS integration (`source = PMS`).
- Notifications (including LOW/OUT supplies, N12b).
- Clerk webhook for `user.deleted`.
- **Access codes** (lockbox and door) with proper secret handling: encrypted
  at rest, revealed per request to the assigned cleaner on the clean's day,
  and every reveal audited (N7).
- **Photo flags:** an admin can flag a clean or damage photo as invalid
  with a reason. The flag is a separate record (`PhotoFlag`), so photos stay
  immutable (N10).
- **Damage claims:** claim status and `amountRecoveredCents` on damage reports
  (e.g. AirCover), possibly flowing into a statement adjustment (N11).

---

## 11. Decision log

| Date       | Decision                                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-05 | Web is a Vite + React SPA (TanStack Router/Query, Tailwind 4) on Cloudflare Pages, replacing Next.js. Clerk React SDK in the browser, bearer token to the API. |
| 2026-10-05 | TruHost keeps the guest cleaning fee and pays cleaners per clean. Owner gross = payout − cleaning fee.                                                         |
| 2026-10-05 | One plan, TruPlan, at 22% of the month's owner gross. Net = gross − fee − owner-borne expenses ± adjustments.                                                  |
| 2026-10-05 | Monthly owner statements (DRAFT → FINALIZED → RELEASED) replace invoicing. Stripe Invoicing dropped.                                                           |
| 2026-10-05 | Per-night revenue split across month boundaries.                                                                                                               |
| 2026-10-05 | Not GST-registered. Tax fields kept but disabled by `TAX_FIELDS_ENABLED`.                                                                                      |
| 2026-10-05 | API on Railway US West. Neon in the same region. No Canadian residency requirement.                                                                            |
| 2026-10-05 | Tests on local Postgres (WSL), Neon branch for dev, Postgres service in CI.                                                                                    |
| 2026-10-05 | iCal imports go through an `IcalImport` staging table. Conflicts are resolved by an admin and never hit the overlap constraint.                                |
| 2026-10-05 | Invited users are linked on first authenticated request (no webhook dependency).                                                                               |
| 2026-10-05 | Prisma 7.10 (stable). Prisma 8 is still a release candidate; revisit when it is GA.                                                                            |
| 2026-10-05 | No `nestjs-zod` (it doesn't support Nest 12). zod 4's `z.toJSONSchema` feeds `@nestjs/swagger`, with a small `ZodPipe` and `@ZodResponse`.                     |
| 2026-10-05 | The typed client lives in `packages/api-client` (generated from OpenAPI, committed, drift-checked in CI) so web and mobile share it.                           |
| 2026-10-05 | Rate limiting uses two throttler guards around auth: `ip-*` tiers before it and `user-*` tiers after it.                                                       |
| 2026-10-06 | Several owners per property (Q1).                                                                                                                              |
| 2026-10-06 | Owner stays: owner is charged the property's standard cleaning fee as an owner-borne expense (N1).                                                             |
| 2026-10-06 | "Avg. nightly earnings" replaces "ADR" in all UI and API naming (N2).                                                                                          |
| 2026-10-06 | Cancelled stays that still pay out: revenue in the check-in month, zero nights (N3).                                                                           |
| 2026-10-06 | Owners absorb Airbnb's fee on the cleaning fee (N4).                                                                                                           |
| 2026-10-06 | Expenses dated by purchase date (N6).                                                                                                                          |
| 2026-10-06 | No lockbox/door codes in the app until proper secret handling exists; `accessInstructions` is removed (N7).                                                    |
| 2026-10-06 | Default cleaner per property with per-clean override; cleaners start on the scheduled day (N8).                                                                |
| 2026-10-06 | Cleaner payments are voidable with a required reason; payment lines are immutable history (N9).                                                                |
| 2026-10-06 | TruHost restocks supplies as owner-borne receipted expenses (N12).                                                                                             |
| 2026-10-06 | Invite emails sent by us via Resend (Clerk invitations with `notify: false`); URLs and sender are env vars with placeholders until domains are chosen (N13).   |
