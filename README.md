# HalePulse — Multi-Tenant Pharmacy Management SaaS

A Next.js 16 + Prisma + NextAuth multi-tenant pharmacy management system.

---

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment config
cp .env.example .env
# Edit .env with your values

# 3. Run database migrations
npx prisma migrate dev

# 4. Seed the database (creates super admin, demo tenant, default users)
npx tsx prisma/seed.ts

# 5. Start development server
npm run dev
```

---

## Role Hierarchy

```
SUPER_ADMIN  — Full system access. Manages all tenants, users, branding, permissions.
    └── MANAGER  — Full access within their tenant. Can manage users, branches, reports.
          ├── MCA  — Inventory and order management. Limited to operational tasks.
          └── NES  — Read-only access. Can view inventory, reports, and patients.
```

---

## Default Development Credentials

| Email | Password | Role |
|---|---|---|
| superadmin@system.com | Admin@1234 | SUPER_ADMIN |
| manager@demo.com | Manager@1234 | MANAGER |
| mca@demo.com | Mca@1234 | MCA |
| nes@demo.com | Nes@1234 | NES |

---

## Creating a New Tenant

1. Log in as superadmin@system.com
2. Navigate to **Super Admin → Tenants → New Tenant**
3. Fill in company name, subdomain, and brand colors
4. On submit, a default Manager account is created and a temporary password is shown **once**
5. Share credentials with the tenant manager

---

## Running Migrations

```bash
# Apply pending migrations
npx prisma migrate dev

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Open Prisma Studio (visual DB browser)
npx prisma studio

# Re-seed after reset
npx tsx prisma/seed.ts
```

## Switching to PostgreSQL

1. Install PostgreSQL and create a database
2. Update .env: DATABASE_URL="postgresql://user:password@localhost:5432/pharmacy_db"
3. In prisma/schema.prisma, change provider = "sqlite" to provider = "postgresql"
4. Run: npx prisma migrate dev --name init

---

## Project Structure

```
src/
  app/
    (main pages: /, /pos, /inventory, /customers)
    dashboard/         — Role dashboards (manager, mca, nes)
    super-admin/       — Super admin control panel
    api/               — API routes
    login/             — Login page
  components/
    layout/            — Sidebar, TopHeader, AppShell, SuperAdminSidebar
  lib/
    auth/              — NextAuth config, session helpers, role guards
    audit/             — Audit log writer
    branding/          — Tenant branding fetcher
    menus/             — Role-based menu loader
    permissions/       — Permission checker
  types/
    next-auth.d.ts     — Session type extensions
prisma/
  schema.prisma        — Database schema
  seed.ts              — Seed script
```
