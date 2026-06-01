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

### Phase 2 — Inventory & batches (GRN)  ← current
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
- [ ] 2D. Stock-take sessions (count → discrepancies → adjust).
- [ ] 2E. Inter-branch transfers (request → dispatch → receive).
- [ ] 2F. Wire reads (inventory views, dashboards, alerts) to batch data;
  expiry/low-stock from `stock_items`.

### Phase 3 — POS upgrade
- `sale_payments` (split tender), sale items referencing the batch sold (FIFO
  deduction → `stock_movements`), manager-only void workflow (cashier "request
  correction"), EOD reconciliation + cash register variance.

### Phase 4 — Clinical: patients + prescriptions + refills
- Upgrade `Customer → Patient` (DOB, gender, allergies, chronic conditions),
  drug purchase history view, prescriptions module (issue/verify/dispense,
  controlled-substance logging), refill reminder engine + notifications.

### Phase 5 — Reporting & intelligence
- Monthly statistical summary, payment-method breakdown, purchase-frequency
  analytics, inventory valuation/movement, exports (PDF/Excel).

### Phase 6 — AI layer
- `/lib/ai` Anthropic wrapper + `/lib/ai/prompts`, drug interaction checker,
  monthly summary narrative, refill prediction, reorder recommendation,
  prescription parser. Server-side key only, AI-call logging, feature-flag gated.

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
