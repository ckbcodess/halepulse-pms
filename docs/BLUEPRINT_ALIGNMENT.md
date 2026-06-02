# HalePulse ERP — Blueprint Alignment Roadmap

Tracks the work to bring the codebase in line with the **HalePulse ERP Master
Architecture Blueprint v1.1**. This is a living document — each phase is checked
off as it lands.

## Guiding decisions (agreed)

1. **Stack: adapt, don't re-platform.** The blueprint names Supabase + tRPC +
   Postgres RLS. We keep the existing **Prisma + NextAuth + Neon Postgres** stack
   and implement the blueprint's *domain and architecture intent*. Tenant/branch
   isolation is enforced in the **service/data-access layer** (not Postgres RLS).
   Supabase-specific pieces (Storage, Realtime) may be adopted later only where
   they add clear value.
2. **Start with the foundation:** role hierarchy + branch scoping (Phase 1).
3. **Roles migrate with data:** existing `MANAGER / MCA / NES` users are mapped to
   the new 5-tier hierarchy via a data migration; accounts are preserved.

## Branch

All work lands on `blueprint-alignment` (branched off `audit-log`).

---

## Gap summary (blueprint → current)

| Area | Blueprint | Current | Phase |
|---|---|---|---|
| Roles | 5-tier hierarchy (L1–L5) | 4 flat roles + dynamic roles | 1 |
| Branch scoping | inventory/sales/users scoped per branch | tenant-scoped only | 1 |
| Inventory | batch `stock_items`, GRN auto-pricing, FIFO | single `stockQty` + markup | 2 |
| Stock movements | immutable append-only ledger | `StockAdjustment` + `InventoryAuditLog` | 2 |
| Stock take | dedicated sessions mode | adjustments only | 2 |
| Transfers | inter-branch transfer workflow | none | 2 |
| POS | split payments, FIFO sale, manager void, EOD | single payment type, discount | 3 |
| Patients | clinical registry (DOB, allergies, history) | `Customer` (loyalty) | 4 |
| Prescriptions | issue/verify/dispense + controlled tracking | none | 4 |
| Refill reminders | engine + notifications | none | 4 |
| Suppliers | + purchase orders + GRN | registry only | 2/4 |
| Reporting | monthly summary, frequency, payment breakdown | basic dashboards | 5 |
| AI layer | Anthropic: drug checks, summaries, refill/reorder | none | 6 |
| Import | `import_jobs` + validate/confirm workflow | page + script + template | 7 |
| Audit | unified `audit_logs` w/ before/after JSONB | split across two tables | 8 |
| Middleware | auth, tenant, permission, scope, rate-limit, logging | partial | 8 |

---

## Phases

### Phase 1 — Foundation: roles + branch scoping  ✅ complete
**Goal:** the 5-tier hierarchy and true branch scoping that everything else builds on.

- [x] 1A. Role hierarchy ✅
  - [x] Canonical levels defined: L1 `super_admin` … L5 `cashier`
    → `src/lib/auth/roleHierarchy.ts` (single source of truth + §5.2 matrix).
  - [x] Canonical system `DynamicRole`s created per tenant (slug + level + isSystem)
    with matrix-driven permission grants and default menus.
  - [x] Live data migration run + verified (`scripts/migrate-roles.ts`):
    `business_admin→tenant_admin`, `manager→branch_manager`,
    `pharmacist→pharmacist`, `viewer→cashier`; legacy `MANAGER` with no branch
    → tenant_admin (HQ proxy), else branch_manager. Backup snapshot saved to
    `scripts/backups/`. Obsolete roles deactivated.
  - [x] `prisma/seed.ts` aligned so fresh installs produce the canonical roles.
  - [ ] _Deferred to 1B:_ make `requireRole`/`checkRole` level-aware and surface
    `branchId`/`roleLevel`/`dynamicRoleSlug` in `getTenantContext` (belongs with
    branch scoping). `checkPermission` already resolves dynamic-role grants.
- [~] 1B. Branch scoping (foundation landed; read-side + switcher remain)
  - [x] `Branch.isHeadquarters` + `createdAt`; `branchId` added to `Sale` and
    `StockAdjustment` (nullable, indexed). Schema pushed to DB.
    _Note:_ `Product` stays tenant-wide (catalog); per-branch stock arrives with
    `stock_items` in Phase 2. `Customer`/patients are tenant-wide per blueprint.
  - [x] Backfill run + verified (`scripts/migrate-branch-scoping.ts`): every
    tenant has exactly one HQ branch ("Phamacy 2" got a new HQ; "Awoshie Branch"
    promoted for Haletop); existing sales/adjustments assigned to HQ; branch-less
    operational users (L≥2) assigned to HQ. Snapshot in `scripts/backups/`.
  - [x] `getTenantContext` now returns `branchId` + `roleLevel` +
    `dynamicRoleSlug`; `resolveBranchId()` helper added.
  - [x] `checkRole` is now hierarchy/slug-aware (accepts legacy + canonical slugs,
    level-0 bypass).
  - [x] Write paths set `branchId`: POS sale (`actions.ts`), stock adjustment,
    batch restock.
  - [x] Read-side scoping via `branchScope.ts` (`branchWhere`/`getReadBranchId`):
    manager/mca/nes dashboards, reports, and the adjustments list now scope sales
    by branch. Operational users (L≥2) are locked to their branch (fail-closed);
    tenant-wide actors see all branches or a chosen one.
  - [x] Branch switcher in the app shell (`BranchSwitcher` in `TopHeader`) backed
    by `GET/POST /api/branches`; operational users see a static branch label.
  - [x] §4.4 access matrix enforced: operational reads locked to home branch;
    branch selection validated against the tenant; switching gated to L≤1.

### Phase 2 — Inventory & batches (GRN)  ✅ complete
Done incrementally so the live POS/inventory never breaks. `Product.stockQty`
stays the working source of truth until the cut-over sub-phases land.

- [x] 2A. Data model + backfill. Added `StockItem`, `GoodsReceivedNote`,
  immutable `StockMovement`, `StockTakeSession` (+ back-relations, `SaleItem.stockItemId`).
  Schema pushed; `migrate-stock-items.ts` seeded opening batches + import movements
  from current product stock (snapshot saved). Additive — no read/write path
  changed yet.
- [x] 2B. GRN flow. Restock path now writes (atomically) a `GoodsReceivedNote`,
  a batch `StockItem` per line, an immutable `StockMovement` (type `grn`), plus
  the legacy `StockAdjustment`/audit logs and the `Product.stockQty`/price
  dual-write. Auto-pricing via `lib/inventory/pricing.ts`. Verified end-to-end
  (rollback test).
- [x] 2C. POS FIFO. Sales now deduct batch stock_items oldest-first
  (`lib/inventory/fifo.ts`), write `sale` StockMovements per batch, and stamp
  `SaleItem.stockItemId` with the batch used. `Product.stockQty` stays the
  validated authority (race-safe guard) and is decremented as before; FIFO is
  best-effort so a lagging ledger never blocks a sale. Verified (rollback test).
- [x] 2D. Stock-take sessions. `StockTakeSession` start → count sheet (batch qty
  per product at branch) → complete reconciles discrepancies via `applyStockDelta`
  (`lib/inventory/stock.ts`), writing `stock_take` movements + legacy
  adjustment/audit + Product.stockQty sync. API under `/api/inventory/stock-take`,
  UI at `/inventory/stock-take` (+ sidebar item). Verified (rollback test).
- [x] 2E. Inter-branch transfers (direct). `POST /api/inventory/transfers`
  deducts the source branch and adds the destination via paired
  `transfer_out`/`transfer_in` movements (`applyStockDelta`); Product.stockQty
  (tenant-global) nets to zero. UI at `/inventory/transfers` + sidebar; branch
  picker via `/api/branches?all=1`. Verified (rollback test).
  _Note:_ the blueprint's request→approve→dispatch→receive workflow is deferred;
  this is a single-step transfer for now.
- [x] 2F. Integrity + visibility. Legacy stock-adjustment path now syncs batches
  (writes an `adjustment` StockMovement via `applyStockDelta`) — so every stock
  mutation (GRN, sale, stock-take, transfer, adjustment) keeps the batch ledger
  consistent. Product detail shows a "Batches by Branch" table (qty/cost/selling/
  expiry per batch) from `stock_items`.
  _Deferred refinement:_ a full read cutover (replacing every `Product.stockQty`
  read and the low-stock/expiry alerts with per-branch batch sums) — `stockQty`
  remains the working aggregate for now and is kept in sync by every path.

### Phase 3 — POS upgrade  ✅ complete
- [x] 3A. Schema + backfill. `SalePayment` (immutable split tender), `Sale`
  void fields (`voidReason`/`voidedBy`/`voidedAt`), `EodReport` (one per
  branch/day). Pushed; `migrate-sale-payments.ts` backfilled one payment per
  existing sale from legacy `paymentType`.
- [x] 3B. Split payments. `processSale` accepts a `payments[]` breakdown and
  writes immutable `SalePayment` rows (falls back to a single payment from
  `paymentType` when none supplied). POS now passes the real cash/MoMo split it
  already captured. `paymentType` kept for compatibility.
- [x] 3C. Manager void workflow. `POST /api/pos/sales/[id]/void` (branch_manager+)
  requires a reason, restores stock (batch `return` movements + Product.stockQty),
  marks the sale `voided` (never deleted), and audit-logs it. New `/pos/sales`
  management page (GET `/api/pos/sales`) lists branch sales with a manager-only
  Void action. Verified (rollback test).
  _Deferred:_ cashier "request correction" (needs the notification system).
- [x] 3D. EOD reconciliation. `GET/POST /api/pos/eod` computes the day's totals,
  revenue by payment method, returns/voids, and cash variance (counted vs
  expected); one `EodReport` per branch/day (unique → locked after submit). UI at
  `/pos/eod` with live variance. Verified aggregation (payments sum = sales total).

### Phase 4 — Clinical: patients + prescriptions + refills  ✅ complete
`Customer` doubles as the patient record (extended, not renamed — it's wired
throughout).

- [x] 4A. Schema. `Customer` extended with patient fields (dateOfBirth, gender,
  address, knownAllergies, chronicConditions); `Product` gains
  `requiresPrescription`/`isControlled`; `Sale.prescriptionId`; new `Prescription`
  + `PrescriptionItem` + `RefillReminder` models. Pushed (additive, no backfill).
- [x] 4B. Patient profile. New-customer form captures DOB/gender/address/
  allergies/conditions (`createCustomer` extended; `updateCustomer` action added).
  Customer detail now shows a clinical card (age, allergies highlighted, chronic
  conditions), upcoming refills, prescriptions, and the existing purchase history.
- [x] 4C. Prescriptions module. `POST/GET /api/prescriptions` (issue + list),
  `PATCH /api/prescriptions/[id]` lifecycle (verify/dispense/void with role gating:
  verify/dispense = pharmacist/TA, void = manager). Controlled-substance dispensing
  writes a `CONTROLLED_DISPENSED` audit entry. UI at `/prescriptions` (issue form
  with allergy warning + lifecycle actions) + sidebar. Verified (rollback test).
- [x] 4D. Refill reminder engine. `GET/POST /api/refills` (create + due list,
  `?due=N`), `PATCH /api/refills/[id]` (dismiss / snooze / fulfil — fulfil rolls
  the schedule forward). `nextRefillDate = lastDispensed + interval`. UI at
  `/refills` (create + due list with actions) + sidebar. Verified (rollback test).
  _Deferred:_ automatic SMS/WhatsApp dispatch (needs the notification service).

### Phase 5 — Reporting & intelligence  ✅ complete
Extends the existing `/reports` tabs (branch-scoped, range selector).

- [x] 5A. Payment-method breakdown (from `SalePayment`, incl. share bar) +
  purchase-frequency analytics (products by transaction count). New "Payments"
  and "Frequency" tabs.
- [x] 5B. Monthly statistical summary ("Monthly" tab): revenue this vs last month
  (abs + %), top 10 products, top 10 customers by visits, revenue by method,
  current stock value (cost + selling). AI narrative lands in Phase 6.
- [x] 5C. CSV export. `GET /api/reports/export?type=sales|frequency|inventory&range=N`
  streams a branch-scoped CSV (RFC-style escaping); "Export CSV" button on the
  relevant report tabs. (PDF/Excel deferred.)

### Phase 6 — AI layer  ✅ complete
- [x] AI infrastructure: `lib/ai/client.ts` (server-side Anthropic wrapper —
  key from `ANTHROPIC_API_KEY` only, never client-exposed; `isAiConfigured`
  graceful 503; AI-call logging to AuditLog for cost tracking) + `lib/ai/prompts.ts`
  (templates with tenant context).
- [x] Monthly summary narrative: `POST /api/reports/ai-summary` + "AI Insights"
  panel on the Monthly report tab.
- [x] Drug interaction checker: `POST /api/prescriptions/[id]/check` (loads the
  Rx's drugs + patient allergies/conditions server-side) + a per-prescription
  "Sparkles" check button with a results modal.
- `.env.production.example` documents `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`.
- _Deferred (extensible via the same wrapper):_ refill prediction, reorder
  recommendation, prescription-image parser; per-tenant feature-flag gating
  (currently gated by key presence + role `ai.tools.access`).

### Phase 7 — Import / migration hardening
- `import_jobs` table, validate→preview→confirm workflow, templates, full vs
  partial mode, duplicate handling, audit logging, background processing.

### Phase 8 — Cross-cutting hardening
- Unified `audit_logs` (before/after JSONB) written by every service after state
  changes; middleware stack (rate limiting, request logging, tenant-scope guard);
  consistent API envelope `{ success, data, error, meta }` + pagination;
  notification center.

---

## Status log

- _2026-06-01_ — Roadmap created; branch `blueprint-alignment` cut from `audit-log`.
- _2026-06-01_ — **Phase 1A complete.** Canonical 5-tier role module added; live
  DB migrated (both tenants, 5 users remapped) and verified; seed aligned.
  Permission counts match the §5.2 matrix (tenant_admin 33 / branch_manager 25 /
  pharmacist 16 / cashier 3). Next: Phase 1B branch scoping.
- _2026-06-01_ — **Phase 1B foundation landed.** Schema (Branch HQ flag, branchId
  on Sale/StockAdjustment) pushed; backfill run + verified; tenant context exposes
  branch/level; checkRole hierarchy-aware; write paths set branchId. Typecheck
  clean, dev server serves 200. Remaining: read-side branch scoping + switcher.
- _2026-06-01_ — **Phase 1 complete.** Read-side branch scoping added
  (`branchScope.ts`) across dashboards/reports/adjustments; branch switcher in the
  app shell (`/api/branches`); §4.4 access matrix enforced (operational users
  locked to home branch, switching gated to tenant-wide actors). Typecheck clean;
  routes compile. Next: Phase 2 — inventory batches + GRN.
- _2026-06-01_ — **Phase 2A landed.** Batch-inventory tables added (StockItem,
  GoodsReceivedNote, immutable StockMovement, StockTakeSession) + backfill of
  opening batches from current stock. Additive/non-breaking — app still uses
  Product.stockQty. Typecheck clean, dev server serves 200.
- _2026-06-02_ — **Phase 2 complete.** GRN (2B), POS FIFO (2C), stock-take (2D),
  transfers (2E), and adjustment batch-sync + batch visibility (2F) all landed and
  verified via rollback tests. Every stock mutation now writes the immutable
  StockMovement ledger and keeps Product.stockQty in sync. Deferred: full read
  cutover to per-branch batch sums. Next: Phase 3 (POS upgrade) or per priorities.
- _2026-06-02_ — **Phase 3 complete.** Split-tender SalePayment (3A/3B),
  manager-only void with stock restore (3C), and EOD reconciliation with cash
  variance + day lock (3D). New pages: /pos/sales, /pos/eod. All verified via
  rollback / aggregation checks. Next: Phase 4 (clinical) or per priorities.
- _2026-06-02_ — **Phase 4 complete.** Patient records (4A/4B), prescriptions
  module with controlled-substance logging (4C), and the refill reminder engine
  (4D). New pages: /prescriptions, /refills + clinical fields on customers. All
  verified via rollback tests. Deferred: SMS/WhatsApp refill dispatch (Phase 8
  notifications). Next: Phase 5 (reporting), 6 (AI), 7 (import), 8 (cross-cutting).
- _2026-06-02_ — **Phase 5 complete.** Reports gained Payments + Frequency tabs
  (5A), a month-over-month Monthly summary (5B), and CSV export (5C). All
  branch-scoped, tab-lazy queries. AI narrative for Monthly comes in Phase 6.
  Next: Phase 6 (AI layer), 7 (import), 8 (cross-cutting).
- _2026-06-02_ — **Phase 6 complete.** Server-side Anthropic wrapper + prompts,
  monthly AI narrative, and prescription drug-interaction checker, with AI-call
  logging and graceful 503 when no key. Requires ANTHROPIC_API_KEY to activate.
  Next: Phase 7 (import), 8 (cross-cutting).
