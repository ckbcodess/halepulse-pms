# HalePulse — Multi-Tenant Pharmacy Management SaaS

A multi-tenant, cloud-native pharmacy management system (PMS) built on **Next.js 16**, **React 19**, **Prisma**, and **NextAuth**. Multiple independent pharmacies (tenants) run on a single shared deployment with complete row-level data isolation.

> See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the authoritative technical reference.

---

## Features

- **Multi-tenancy** — shared-database/shared-schema isolation; every query is scoped to a `tenantId` taken from the verified JWT.
- **Point of Sale** — client-side cart, atomic sale processing with idempotency, void sales, end-of-day (EOD) reporting.
- **Inventory** — products, categories, suppliers, restock, stock transfers, stock-take, manual adjustments, low-stock/expiry alerts, and a revertible audit log.
- **Prescriptions & refills** — prescription records, interaction/eligibility checks, and refill management.
- **Customers** — records, purchase history, and loyalty points.
- **Reporting** — daily/periodic reports plus an optional AI-generated report summary.
- **CSV import** — bulk import with background **import job tracking** and history.
- **Notifications** — in-app notification center.
- **Dynamic RBAC** — tenant-specific roles, per-role permission overrides, and custom sidebar menus, layered over the default role hierarchy.
- **Super Admin portal** — cross-tenant management, branding, feature flags, and user impersonation with full audit trail.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, TailwindCSS v4 |
| Language | TypeScript (strict) |
| ORM | Prisma 6 |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Auth | NextAuth v4 |
| Client state | Zustand |
| Validation | Zod |
| AI layer | Provider-agnostic (any OpenAI-compatible API) |

---

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file (see "Environment Variables" below)
#    There is no .env.example — create .env with at least DATABASE_URL and NEXTAUTH_SECRET.

# 3. Push the schema to your database (this project uses db push, not migrations)
npm run db:push

# 4. Seed the database (creates super admin, demo tenant, default roles & users)
npm run db:seed

# 5. Start the development server
npm run dev
```

App runs at http://localhost:3000.

---

## Environment Variables

Create a `.env` file in the project root:

```bash
# --- Required ---
DATABASE_URL="file:./dev.db"          # SQLite for dev; postgresql://... for prod
NEXTAUTH_SECRET="<random-string>"     # e.g. `openssl rand -base64 32`

# --- Optional ---
SUPER_ADMIN_PASSWORD="<strong-password>"   # Overrides the default super admin password in production
SEED_DEMO_DATA="true"                       # Seed demo data when set

# --- AI layer (optional, provider-agnostic / OpenAI-compatible) ---
AI_PROVIDER="anthropic"               # or any OpenAI-compatible provider
AI_BASE_URL="https://api.anthropic.com"
AI_API_KEY="<your-api-key>"
AI_MODEL="<model-id>"
# Legacy Anthropic-specific fallbacks (still honored):
# ANTHROPIC_API_KEY, ANTHROPIC_MODEL

# --- Google OAuth (optional) ---
# GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
```

---

## Logging In

There are **two login portals**:

### Client staff — `/login`
Three fields: **Business ID** + **Username** + **Password**.

### Super Admin — `/sp-login`
Two fields: **Email** + **Password**.

---

## Default Development Credentials

The demo tenant seeds with **Business ID `0721`**.

**Super Admin** — log in at `/sp-login`:

| Email | Password |
|---|---|
| superadmin@system.com | Admin@1234 |

**Client staff** — log in at `/login` with Business ID `0721`:

| Username | Password | Role |
|---|---|---|
| manager | Manager@1234 | MANAGER |
| pharmacist | Mca@1234 | MCA |
| viewer | Nes@1234 | NES |

> The username field also accepts the user's email as a fallback. Change all default passwords before going live — set `SUPER_ADMIN_PASSWORD` in production.

---

## Role Hierarchy

```
SUPER_ADMIN  — Full platform access. Manages all tenants, users, branding, permissions.
    └── MANAGER  — Full access within their tenant. Manages users, branches, reports.
          ├── MCA  — Inventory and order management. Operational tasks.
          └── NES  — Read-only access. Views inventory, reports, and patients.
```

Roles can be customized per tenant via the dynamic role system (permission overrides + custom menus).

---

## Creating a New Tenant

1. Log in to the Super Admin portal at `/sp-login`.
2. Navigate to **Super Admin → Tenants → New Tenant**.
3. Fill in company name, Business ID / subdomain, and brand colors.
4. On submit, a default Manager account is created and a temporary password is shown **once**.
5. Share the Business ID and credentials with the tenant manager.

---

## Database Commands

```bash
# Push the Prisma schema to the database (no migration files)
npm run db:push

# Seed / re-seed (idempotent upserts — safe to re-run)
npm run db:seed

# Visual database browser
npx prisma studio
```

> This project uses **`prisma db push`** rather than `prisma migrate`. Schema changes follow an **additive-only** policy (new columns are nullable) to preserve existing data.

---

## Switching to PostgreSQL

1. Install PostgreSQL and create a database.
2. Update `.env`: `DATABASE_URL="postgresql://user:password@localhost:5432/pharmacy_db"`.
3. In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`.
4. Run: `npm run db:push` then `npm run db:seed`.

---

## Project Structure

```
prisma/
  schema.prisma          — Database schema (single source of truth)
  seed.ts                — Idempotent seeder (upserts)
src/
  proxy.ts               — Next.js 16 route protection (JWT, role guard, tenant scoping, impersonation)
  app/
    actions.ts           — Core server actions
    login/               — Client staff login (Business ID + username + password)
    sp-login/            — Super admin login (email + password)
    change-password/     — Forced password change flow
    dashboard/           — Role dashboards (manager, mca, nes)
    pos/                 — Point of sale (Zustand cart)
    inventory/           — Inventory management + CSV import
    prescriptions/       — Prescription records & checks
    refills/             — Refill management
    customers/           — Customer records
    reports/             — Reporting (incl. AI summary)
    settings/            — Tenant settings
    users/               — User management
    super-admin/         — Platform admin portal
    api/                 — REST API route handlers
  lib/
    auth/                — NextAuth config, session & tenant-context helpers
    permissions/         — Dynamic permission resolution
    menus/               — Role-aware menu resolution
  components/
    layout/              — AppShell, Sidebar, TopHeader
```

---

## Build & Deploy

```bash
npm run build    # runs `prisma generate && next build`
npm start        # production server
```

Configured for Next.js **standalone** output for minimal production bundles (Vercel, AWS, GCP, Docker).
