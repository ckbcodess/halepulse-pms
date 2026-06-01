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

### Phase 1 — Foundation: roles + branch scoping  ← current
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
- [ ] 1B. Branch scoping
  - Surface `branchId` in `getTenantContext` / session-derived context.
  - Add `branchId` to branch-scoped tables (Product/stock, Sale, StockAdjustment,
    Customer) — additive, nullable first, backfilled to each tenant's HQ branch.
  - Scope all list/detail/mutation queries by branch where the blueprint requires
    it; aggregate across branches for tenant_admin/super_admin.
  - Branch switcher in the app shell for roles with multi-branch visibility.
  - Honour the §4.4 multi-branch access matrix (defaults blocked; overrides by
    tenant_admin).

### Phase 2 — Inventory & batches (GRN)
- `stock_items` (per batch, per branch), `goods_received_notes`, immutable
  `stock_movements`, `stock_take_sessions`.
- GRN auto-pricing flow (`selling = cost × (1 + markup/100)`, override logged).
- FIFO selection, inter-branch transfers, expiry/low-stock alerts wired to the
  notification center.

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
