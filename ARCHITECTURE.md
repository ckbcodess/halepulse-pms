# HalePulse PMS — System Architecture Document

> **Version:** 1.1 | **Date:** March 2026 | **Status:** MVP Live (v1.1)
>
> This document is the authoritative technical reference for the HalePulse Pharmacy Management System. It reflects the updated Next.js 16.2 and React 19 architecture, including the dynamic role-based access control (RBAC) system.

---

## Table of Contents

1. [Executive Technical Overview](#1-executive-technical-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Data Model & Schema](#3-data-model--schema)
4. [Component & Logic Patterns](#4-component--logic-patterns)
5. [Infrastructure & Deployment](#5-infrastructure--deployment)
6. [System Constraints & Decisions](#6-system-constraints--decisions)

---

## 1. Executive Technical Overview

### 1.1 Core Purpose

HalePulse is a **multi-tenant, cloud-native SaaS pharmacy management system (PMS)**. It is designed to allow multiple independent pharmacy businesses (tenants) to operate on a single shared deployment, with complete data isolation between them.

The system covers the full operational lifecycle of a retail pharmacy:
- Product catalogue and inventory management with expiry tracking
- Point-of-sale (POS) transactions with receipt generation
- Customer records and purchase history
- Daily and periodic reporting
- Flexible role-based staff access control (RBAC) with dynamic permission overrides
- Tenant configuration, branding, and system settings
- Super Admin portal for platform-level management across all tenants

### 1.2 Primary Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.0 |
| UI Library | React | 19.2.3 |
| Language | TypeScript (strict mode) | ^5 |
| Styling | TailwindCSS | v4 |
| Icons | lucide-react | ^0.577.0 |
| ORM | Prisma | ^6.19.2 |
| Database (prod) | PostgreSQL | 16 |
| Database (dev) | SQLite | — |
| Authentication | NextAuth | v4.24.13 |
| Client State | Zustand | ^5.0.11 |
| Validation | Zod | ^4.3.6 |
| Notifications | Sonner | ^2.0.7 |
| Dark Mode | next-themes | ^0.4.6 |
| Password Hashing | bcryptjs | ^3.0.3 |
| Utilities | clsx, tailwind-merge, date-fns | latest |

### 1.3 Mental Model

**Think of the system as three concentric rings:**

```
┌─────────────────────────────────────────────────┐
│   SUPER ADMIN RING  (/super-admin/**)           │
│   Cross-tenant management, audit, impersonation │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │  TENANT RING  (all other routes)          │  │
│  │  Everything scoped to one pharmacy        │  │
│  │                                           │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │  POS RING  (/pos)                   │  │  │
│  │  │  Client-side cart + atomic sale     │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**The golden rule:** Every database query, server action, and API route is passed a `tenantId` extracted from the verified JWT — never from URL parameters or request body. This is the single most important architectural invariant.

---

## 2. High-Level Architecture

### 2.1 System Diagram

```
Browser / Client
       │
       │  HTTPS
       ▼
┌──────────────────────────────────────────────┐
│              Vercel Edge Network             │
│  (CDN for static assets, global routing)     │
└──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│        src/proxy.ts  (Next.js 16 Proxy)      │
│  • JWT validation (getToken)                 │
│  • Route-based role guard                    │
│  • Tenant scoping enforcement                │
│  • forcePasswordChange redirect              │
│  • Impersonation cookie verification         │
└──────────────────────────────────────────────┘
       │
       ├──── Static routes → Next.js Edge Cache
       │
       ▼
┌──────────────────────────────────────────────┐
│        Next.js App Router (Serverless)       │
│                                              │
│  ┌──────────────┐   ┌────────────────────┐   │
│  │  RSC Pages   │   │  API Route Handler │   │
│  │  (server     │   │  (/api/**)         │   │
│  │   rendered)  │   │                    │   │
│  └──────┬───────┘   └────────┬───────────┘   │
│         │                    │               │
│  ┌──────▼────────────────────▼───────────┐   │
│  │        Server Actions (actions.ts)    │   │
│  │  + Helper functions (auth/helpers)    │   │
│  └──────────────────┬────────────────────┘   │
│                     │                        │
│  ┌──────────────────▼────────────────────┐   │
│  │         Prisma ORM Client             │   │
│  └──────────────────┬────────────────────┘   │
└─────────────────────┼────────────────────────┘
                      │  TCP / SSL
                      ▼
┌──────────────────────────────────────────────┐
│     PostgreSQL  (Vercel Postgres / Neon)     │
│     Single database, shared schema          │
│     Row-level isolation via tenantId         │
└──────────────────────────────────────────────┘
```

### 2.2 Request Lifecycle

Every authenticated page request follows this path:

1.  Browser sends request + session cookie
2.  `src/proxy.ts` intercepts:
      • Validates JWT (`getToken`)
      • Checks role against route pattern
      • Checks `mustChangePassword` flag
      • Checks `sa_impersonate` cookie for super admin
3.  Next.js routes to Server Component (RSC)
4.  RSC calls server actions / Prisma directly
      • `getTenantContext()` extracts `tenantId` from JWT/Impersonation
      • All Prisma queries include `{ where: { tenantId } }`
5.  RSC returns rendered HTML to browser
6.  Client components hydrate (Zustand, event handlers)
7.  Subsequent mutations: client calls Server Action → Zod validates → Prisma writes → response

### 2.3 Authentication Flow

#### Client Staff Login (/login)
- 3-field login: `businessId` + `username` + `password`
- Managed by `client-credentials` provider in `authOptions.ts`
- Verifies `Tenant.isActive` and `User.isActive`
- JWT issued with: `userId`, `email`, `role`, `tenantId`, `dynamicRoleId`, `mustChangePassword`, etc.

#### Super Admin Login (/sp-login)
- 2-field login: `email` + `password`
- Managed by `sp-credentials` provider
- Verifies `saasRole === 'SUPER_ADMIN'`
- JWT issued with `role: 'SUPER_ADMIN'`, `roleLevel: 0`, `tenantId: null`

### 2.4 Directory Structure

```
pharmacy-nextjs/
├── prisma/
│   ├── schema.prisma          ← Single source of truth for data model
│   └── seed.ts                ← Idempotent seeder (upserts)
├── src/
│   ├── proxy.ts               ← Next.js 16 route protection pattern
│   ├── app/
│   │   ├── layout.tsx         ← Root server component (session + branding + menu)
│   │   ├── actions.ts         ← Core server actions (8 exported functions)
│   │   ├── dashboard-manager-design.tsx ← Figma design reference component
│   │   ├── api/               ← REST API route handlers
│   │   ├── login/             ← Client staff login
│   │   ├── sp-login/          ← Super admin login
│   │   ├── dashboard/         ← Role-specific dashboards (manager/mca/nes)
│   │   ├── inventory/         ← Inventory management (CRUD + Import)
│   │   ├── pos/               ← Point-of-sale page (Zustand-powered)
│   │   └── super-admin/       ← Platform admin portal
│   ├── lib/
│   │   ├── auth/              ← NextAuth config, session & tenant context helpers
│   │   ├── permissions/       ← Dynamic permission resolution logic
│   │   └── menus/              ← Role-aware menu resolution (mergeWithMaster)
│   └── components/
│       └── layout/            ← AppShell, Sidebar, TopHeader
```

---

## 3. Data Model & Schema

### 3.1 Multi-Tenancy Pattern (Critical)

HalePulse uses a **shared-database, shared-schema** multi-tenancy model. Every business entity includes a `tenantId` (FK → Tenant).

The isolation guarantee is enforced at the **application layer**:
- `getTenantContext()` extracts the verified `tenantId` from the JWT or impersonation cookie.
- Every Prisma query *must* include the `tenantId` in the `where` clause.

### 3.2 Model Reference

#### Tenant
Root entity. Every piece of business data is a child of a Tenant.
- `id`: CUID (PK)
- `businessId`: 4-digit numeric identifier (unique across platform)
- `subdomain`: Unique subdomain for the tenant
- `primaryColor`, `secondaryColor`: Branding variables

#### User
Staff member with `saasRole` (enum) and optional `dynamicRoleId`.
- `id`: Int (Auto-increment PK)
- `passwordHash`: bcryptjs hash
- `dynamicRoleId`: FK → `DynamicRole` (preferred over `saasRole`)
- `mustChangePassword`: Forces redirect to `/change-password`

#### Product
Inventory item.
- `stockQty`: Atomicly updated on sale or stock add.
- `expiryDate`: Past-dated products are blocked from POS.

#### Sale & SaleItem
Transaction records.
- `clientToken`: Idempotency key (UUID) to prevent duplicate submissions.
- `totalAmount`: Authoritative server-calculated total (includes discount).

#### Dynamic Role System
- `DynamicRole`: Tenant-specific role definition.
- `DynamicRolePermission`: Overrides/extends default role permissions.
- `DynamicMenuConfig`: Custom sidebar configuration per role.

---

## 4. Component & Logic Patterns

### 4.1 Server Actions Pattern

All mutations go through `src/app/actions.ts`. The pattern is strictly enforced:
1.  **Context**: `getTenantContext()` fetches verified identity.
2.  **Validation**: Zod schemas (`src/lib/validation/schemas.ts`) validate inputs.
3.  **Business Logic**: Condition checks (e.g., expiry, stock availability).
4.  **Database**: Prisma operation scoped by `tenantId`.
5.  **Audit**: `logAction()` records the event.

### 4.2 Sale Processing (Atomic Transaction)

The `processSale()` action is the system's most critical logic:
- **Idempotency**: Checks `clientToken` before processing.
- **Transaction**: Wraps stock decrement, sale creation, and customer points update in a Prisma `$transaction`.
- **Validation**: Re-verifies price, stock, and expiry on the server to prevent client-side price/stock tampering.

### 4.3 Permission Resolution

`checkPermission("inventory.stock.view")` follows a tiered lookup:
1.  **Super Admin**: Always returns `true`.
2.  **Dynamic Role**: Checks `DynamicRolePermission` for the user's role.
3.  **Legacy Role**: Fallback to `RolePermission` for the user's hardcoded `saasRole`.

Accepts both legacy flat keys (`view_inventory`) and new dot-notation keys (`inventory.stock.view`).

### 4.4 Menu Resolution

Sidebar navigation is built in `getMenuForUser()`:
1.  **Dynamic Menu**: Fetches JSON config from `DynamicMenuConfig`.
2.  **Merge with Master**: Merges stored items with `MASTER_MENU` from `src/lib/menus/getMenuForUser.ts` to ensure newly added features automatically appear.
3.  **Defaults**: Fallback to role-based hardcoded defaults if no DB config exists.

---

## 5. Infrastructure & Deployment

### 5.1 Next.js 16 Proxy (`src/proxy.ts`)

HalePulse uses the Next.js 16 `proxy` convention (formerly `middleware.ts`). It handles:
- Session verification via `getToken`.
- Forced password change redirection.
- Super Admin route protection.
- Impersonation cookie verification for Super Admin → Tenant bridging.

### 5.2 Build Script

The build process is automated in `package.json`:
```bash
prisma generate && next build
```
- **Prisma Client**: Regenerated on every build.
- **Standalone**: `output: 'standalone'` in `next.config.ts` produces a minimal production bundle.

### 5.3 Impersonation Pattern

Super Admins can impersonate a tenant user by setting a signed `sa_impersonate` cookie.
- `src/proxy.ts` verifies the signature.
- `getTenantContext()` prioritizes the cookie over the JWT's `tenantId`.
- Audit logs record both the actor (SA) and the target user.

---

## 6. System Constraints & Decisions

### 6.1 Additive-Only Schema Policy

To preserve integrity across 2,000+ legacy data rows, all database migrations are **additive-only**. Nullable columns are used for new features, ensuring existing rows are never dropped or corrupted.

### 6.2 Server-Side Branding Injection

Tenant colors are injected as CSS variables in `src/app/layout.tsx`. Tailwind CSS (v4) classes reference these variables (e.g., `--primary-color`), allowing for instant, dynamic branding without rebuilding the application.

### 6.3 Next.js 16 Standalone Output

The project is configured for `standalone` output, reducing Docker image size and simplifying deployment to cloud providers that support the standalone server (e.g., AWS, GCP, Vercel).

---

*End of System Architecture Document — HalePulse PMS v1.1*
