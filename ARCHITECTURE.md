# HalePulse PMS — System Architecture Document

> **Version:** 1.0 | **Date:** March 2026 | **Status:** MVP Live
>
> This document is the authoritative technical reference for the HalePulse Pharmacy Management System. Its purpose is to enable a senior engineer to fully understand, maintain, or reconstruct the system from scratch without access to any other documentation.

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
- Role-based staff access control (RBAC)
- Tenant configuration, branding, and system settings
- Super Admin portal for platform-level management across all tenants

### 1.2 Primary Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.6 |
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
│         src/proxy.ts  (Middleware)           │
│  • JWT validation (getToken)                 │
│  • Route-based role guard                    │
│  • Tenant scoping enforcement                │
│  • forcePasswordChange redirect              │
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

```
1.  Browser sends request + session cookie
2.  proxy.ts intercepts:
      • Validates JWT (getToken)
      • Checks role against route pattern
      • Checks mustChangePassword flag
      • Checks impersonation cookie for super admin
3.  Next.js routes to Server Component (RSC)
4.  RSC calls server actions / Prisma directly
      • getTenantContext() extracts tenantId from JWT
      • All Prisma queries include { where: { tenantId } }
5.  RSC returns rendered HTML to browser
6.  Client components hydrate (Zustand, event handlers)
7.  Subsequent mutations: client calls Server Action → Zod validates → Prisma writes → response
```

### 2.3 Authentication Flow

```
/login (3-field: businessId + username + password)
  │
  ▼ NextAuth "client-credentials" provider
  1. Find Tenant by businessId (must be isActive)
  2. Find User by businessUsername OR email (within tenant)
  3. checkLockout() → throw if locked (5 attempts / 30-min window)
  4. bcrypt.compare(password, user.passwordHash)
  5. recordFailedAttempt() if wrong
  6. logLoginAttempt() always
  7. JWT issued: { userId, email, role, tenantId, branchId,
                   dynamicRoleId, dynamicRoleSlug, roleLevel,
                   mustChangePassword, businessId }

/sp-login (email + password)
  │
  ▼ NextAuth "sp-credentials" provider
  1. Find User by email
  2. Verify isActive + passwordHash exists
  3. Verify saasRole === 'SUPER_ADMIN' OR dynamicRole.level === 0
  4. checkLockout() + verify password
  5. JWT issued with role: 'SUPER_ADMIN', roleLevel: 0, tenantId: null
```

### 2.4 Directory Structure

```
pharmacy-nextjs/
├── prisma/
│   ├── schema.prisma          ← Single source of truth for data model
│   └── seed.ts                ← Idempotent seeder (upserts)
├── public/
│   └── import-template.csv   ← 1,896 pre-cleaned products from legacy system
├── scripts/
│   └── setup-production.sh   ← Production setup helper
├── src/
│   ├── proxy.ts               ← Route protection (Next.js 16 proxy convention)
│   ├── app/
│   │   ├── layout.tsx         ← Root server component (session + branding + menu)
│   │   ├── actions.ts         ← All server actions (8 exported functions)
│   │   ├── api/               ← REST API route handlers
│   │   │   ├── auth/          ← NextAuth + change-password + heartbeat + impersonation
│   │   │   ├── inventory/     ← CRUD for products (Zod-validated)
│   │   │   ├── settings/      ← Tenant settings (Zod-validated)
│   │   │   └── super-admin/   ← Platform management endpoints
│   │   ├── login/             ← Client staff login
│   │   ├── sp-login/          ← Super admin login
│   │   ├── change-password/   ← Forced + voluntary password change
│   │   ├── dashboard/         ← Role-specific dashboards (manager/mca/nes)
│   │   ├── inventory/         ← List, new, import pages + InventoryView.tsx
│   │   ├── pos/               ← Point-of-sale page
│   │   ├── customers/         ← List, detail [id], new
│   │   ├── reports/           ← Reports page
│   │   ├── settings/          ← Tenant settings + SettingsView.tsx
│   │   ├── users/             ← Staff user management
│   │   └── super-admin/       ← Platform admin portal
│   ├── components/
│   │   └── layout/
│   │       ├── AppShell.tsx   ← Root layout shell (session + mobile state)
│   │       ├── Sidebar.tsx    ← Role-aware nav (mobile slide-in)
│   │       ├── TopHeader.tsx  ← Header with hamburger + theme toggle
│   │       └── SuperAdminSidebar.tsx
│   └── lib/
│       ├── auth/
│       │   └── authOptions.ts ← All 3 NextAuth providers + JWT/session callbacks
│       ├── store.ts           ← Zustand cart store
│       ├── prisma.ts          ← Prisma client singleton
│       └── validation/
│           └── schemas.ts     ← All Zod schemas
├── next.config.ts             ← output: 'standalone'
├── Dockerfile                 ← Multi-stage (deps → builder → runner)
├── docker-compose.yml         ← app + postgres services
├── .env.production.example    ← Required env vars template
└── package.json               ← build: prisma generate && prisma db push && prisma db seed && next build
```

---

## 3. Data Model & Schema

### 3.1 Entity Relationship Overview

```
Tenant ──── Branch (1:many)
  │
  ├── User (many, each has saasRole + optional dynamicRoleId)
  │     └── Branch (optional assignment)
  │
  ├── Product ──── Category (many:1)
  │
  ├── Customer
  │
  ├── Sale ──── SaleItem[] ──── Product
  │       └── Customer (optional)
  │
  ├── DynamicRole ──── DynamicRolePermission[]
  │                 └── DynamicMenuConfig
  │
  ├── RolePermission (legacy, keyed by enum Role)
  ├── MenuConfig (legacy, keyed by enum Role)
  ├── FeatureFlag ──── TenantFeatureFlag[]
  ├── AuditLog
  └── LoginAttempt
```

### 3.2 Model Reference

#### Tenant
The root entity. Every piece of business data is a child of a Tenant.

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | Primary key |
| name | String | Display name |
| subdomain | String (unique) | e.g. `citycare` → `citycare.halepulse.app` |
| businessId | String (unique) | 4-digit numeric string e.g. `"0721"` |
| primaryColor | String | HEX (default `#1B4F72`) |
| secondaryColor | String | HEX (default `#2E86C1`) |
| logoUrl | String? | Optional |
| isActive | Boolean | Soft-disable tenant |
| subscriptionTier | String | `"basic"` / `"standard"` / `"premium"` |
| legalName, address, licenceNumber, taxVatNumber | String? | Business registration fields |
| primaryContact, primaryPhone, primaryEmail | String? | Contact info (used on receipts) |
| createdAt | DateTime | Auto |

#### User
Staff member. Can be legacy (password/username) or SaaS (passwordHash/email/saasRole).

| Field | Type | Notes |
|---|---|---|
| id | Int | Auto-increment PK |
| username | String? | Legacy login field |
| password | String? | Legacy MD5 hash |
| email | String? | SaaS login field |
| passwordHash | String? | bcryptjs hash |
| saasRole | String? | `SUPER_ADMIN` / `MANAGER` / `MCA` / `NES` |
| businessUsername | String? | Used in 3-field client login |
| tenantId | String? | FK → Tenant |
| branchId | String? | FK → Branch |
| dynamicRoleId | String? | FK → DynamicRole (preferred over saasRole) |
| mustChangePassword | Boolean | Forces /change-password redirect |
| failedLoginCount | Int | Resets on successful login |
| lockedUntil | DateTime? | Set after 5 failed attempts (30-min window) |
| isActive | Boolean | Soft-disable user |
| lastActiveAt | DateTime? | Heartbeat-updated |

#### Product

| Field | Type | Notes |
|---|---|---|
| id | Int | Auto-increment PK |
| name | String | Required, unique per tenant |
| price | Decimal | Selling price |
| costPrice | Decimal? | Purchase price |
| stockQty | Int | Current stock (decremented on sale) |
| unit | String? | `PCS`, `BOTTLE`, `STRIP`, etc. |
| category | String? | Category name (denormalised) |
| barcode | String? | Optional scan code |
| expiryDate | DateTime? | If set, blocked from POS when past |
| reorderLevel | Int? | Low-stock threshold |
| tenantId | String? | FK → Tenant |

#### Sale

| Field | Type | Notes |
|---|---|---|
| id | Int | Auto-increment PK |
| totalAmount | Decimal | Sum of all SaleItems |
| discount | Decimal? | Applied discount |
| paymentType | String? | `CASH`, `CARD`, `MOMO`, etc. |
| status | String? | `COMPLETED`, `VOIDED`, etc. |
| customerId | Int? | FK → Customer (nullable for walk-in) |
| sellerId | Int? | FK → User (non-relational Int) |
| tenantId | String? | FK → Tenant |
| createdAt | DateTime | Transaction timestamp |

#### SaleItem

| Field | Type | Notes |
|---|---|---|
| id | Int | Auto-increment PK |
| saleId | Int | FK → Sale |
| productId | Int | FK → Product |
| quantity | Int | Units sold |
| price | Decimal | Unit price at time of sale |

#### AuditLog

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | PK |
| userId | String | String cast of Int userId |
| tenantId | String? | FK → Tenant (nullable for super admin actions) |
| action | String | e.g. `LOGIN`, `SALE_PROCESSED`, `PRODUCT_UPDATED` |
| metadata | Json? | Context: before/after values, item counts, etc. |
| ipAddress | String? | Request IP |
| createdAt | DateTime | Auto |

> **Note:** AuditLog.userId is stored as String (not FK) to avoid Prisma type mismatch between User.id (Int) and AuditLog.userId. Cast at write time: `String(userId)`.

#### DynamicRole
Flexible permission system that can override the hardcoded `saasRole` enum.

| Field | Type | Notes |
|---|---|---|
| id | String (CUID) | PK |
| tenantId | String? | Null for system-wide roles |
| name | String | Display name |
| slug | String | Unique identifier per tenant (e.g. `pharmacist`) |
| level | Int | `0`=SuperAdmin, `1`=BusinessAdmin, `2`=Manager, `3`=Viewer |
| isSystem | Boolean | System roles cannot be deleted |
| isActive | Boolean | |

### 3.3 Key Database Constraints

- `Tenant.businessId` — globally unique across all tenants
- `Tenant.subdomain` — globally unique
- `User.email` — no unique constraint at DB level (checked in logic)
- `Customer.phone` — unique constraint (legacy; enforced per-tenant in code)
- `RolePermission.[tenantId, role, permissionKey]` — composite unique
- `MenuConfig.[tenantId, role]` — composite unique
- `DynamicRolePermission.[dynamicRoleId, permissionKey]` — composite unique
- `DynamicMenuConfig.[dynamicRoleId, tenantId]` — composite unique
- `TenantFeatureFlag.[tenantId, featureFlagId]` — composite unique

### 3.4 Multi-Tenancy Pattern (Critical)

**The schema is additive.** All legacy tables (`User`, `Product`, `Customer`, `Sale`, `SaleItem`, `Category`) were extended with a nullable `tenantId` column. No existing rows were deleted or modified. New rows always include `tenantId`.

The isolation guarantee is at the **application layer**:

```typescript
// EVERY server action / API route starts with this:
async function getTenantContext(): Promise<TenantContext> {
  const token = await getToken({ req });

  // Check impersonation cookie (super admin only)
  const impersonation = await getImpersonation();

  const tenantId = impersonation?.tenantId ?? token.tenantId;

  if (!tenantId) throw new Error('No tenant context');

  return { tenantId, userId: token.userId, role: token.role };
}

// Usage in every query:
const products = await prisma.product.findMany({
  where: { tenantId }  // ← NEVER omit this
});
```

---

## 4. Component & Logic Patterns

### 4.1 Server / Client Component Split

HalePulse uses the Next.js App Router RSC model:

| Component Type | Used For | Examples |
|---|---|---|
| **Server Components** (default) | Data fetching, initial render, auth checks | `app/layout.tsx`, `app/inventory/page.tsx` |
| **Client Components** (`'use client'`) | Interactivity, state, event handlers | `InventoryView.tsx`, `AppShell.tsx`, `Sidebar.tsx` |
| **Server Actions** | Mutations (form submits, data writes) | All exports in `actions.ts` |

**Pattern:** Pages are server components that fetch data, then pass it as props to client components that handle interactivity.

```typescript
// app/inventory/page.tsx (Server Component)
export default async function InventoryPage() {
  const products = await getProducts();  // server action, no useEffect
  return <InventoryView initialProducts={products} />;
}

// app/inventory/InventoryView.tsx (Client Component)
'use client';
export function InventoryView({ initialProducts }) {
  const [products, setProducts] = useState(initialProducts);
  // event handlers, mutations via server actions...
}
```

### 4.2 Server Actions Pattern

All mutations go through `src/app/actions.ts`. The pattern is consistent:

```typescript
export async function someAction(input: unknown) {
  // 1. Get tenant context (validates JWT, extracts tenantId)
  const { tenantId, userId, role } = await getTenantContext();

  // 2. Validate input with Zod
  const validated = someSchema.parse(input);  // throws ZodError if invalid

  // 3. Business rule checks
  if (someCondition) throw new Error('Descriptive user-facing message');

  // 4. Database operation (always includes tenantId)
  const result = await prisma.model.create({
    data: { ...validated, tenantId }
  });

  // 5. Optional: log audit event
  await logAction(userId, tenantId, 'ACTION_NAME', { ...metadata });

  return result;
}
```

### 4.3 API Route Pattern

Routes in `src/app/api/` follow a consistent guard pattern:

```typescript
// src/app/api/inventory/route.ts
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { tenantId } = await getTenantContext();
    const data = await prisma.product.findMany({ where: { tenantId } });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 4.4 Zustand Cart Store

The POS cart is entirely client-side — no server round-trips until checkout.

```typescript
// src/lib/store.ts
interface CartItem { id: number; name: string; price: number; quantity: number; }

interface CartStore {
  items: CartItem[];
  total: number;
  addItem:        (item: CartItem) => void;     // append or increment qty
  removeItem:     (id: number) => void;          // filter out
  updateQuantity: (id: number, delta: number) => void;  // +/- delta, floor at 1
  clearCart:      () => void;
}
```

`total` is recalculated as `items.reduce((sum, i) => sum + i.price * i.quantity, 0)` on every mutation — no derived state selector needed.

### 4.5 Zod Validation Schemas

All schemas live in `src/lib/validation/schemas.ts` and are consumed by both server actions and API routes:

```typescript
export const createProductSchema = z.object({
  name:        z.string().trim().toUpperCase(),
  category:    z.string(),
  price:       z.number().positive(),
  costPrice:   z.number().positive().nullable().optional(),
  stockQty:    z.number().int().nonnegative(),
  expiryDate:  z.string().nullable().optional(),
  description: z.string().trim().nullable().optional(),
});

export const processSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
  total: z.number().positive(),
  customerId: z.number().int().positive().optional(),
});

export const updateSettingsSchema = z.object({
  name:            z.string().optional(),
  legalName:       z.string().nullable().optional(),
  primaryPhone:    z.string().nullable().optional(),
  primaryEmail:    z.string().email().nullable().optional(),
  // ...etc
});
```

### 4.6 Permission Resolution Logic

Permission checks use a two-tier strategy (new dynamic system preferred, legacy fallback):

```
checkPermission("inventory.stock.view")
  │
  ├── If SUPER_ADMIN → return true (always)
  │
  ├── If dynamicRoleId exists:
  │     Query DynamicRolePermission WHERE dynamicRoleId + permissionKey
  │     (also checks flat variant: "inventory_stock_view")
  │
  └── Fallback: Query RolePermission WHERE tenantId + role(enum) + permissionKey
```

### 4.7 Menu Resolution Logic

Sidebar navigation is built server-side in `getMenuForUser()`:

```
Priority 1: DynamicMenuConfig (if user has dynamicRoleId)
    └── Returns JSON array [{key, label, path, icon, visible}]

Priority 2: Legacy MenuConfig merged with MASTER_MENU
    └── Stored per [tenantId, role] pair

Priority 3: Role defaults from MASTER_MENU
    └── MASTER_MENU items filtered by default role visibility
```

### 4.8 Impersonation Pattern

Super Admin can impersonate a tenant user for support purposes:

```
POST /super-admin/impersonate
  → Sets httpOnly cookie: sa_impersonate = JSON.stringify({tenantId, role})

proxy.ts reads this cookie:
  → If SA + sa_impersonate cookie → allow access to tenant routes
  → getTenantContext() prefers impersonation cookie over JWT tenantId

POST /super-admin/stop-impersonate
  → Clears sa_impersonate cookie
  → All audit logs during impersonation record BOTH actor and impersonated user
```

### 4.9 Layout Shell Pattern

```
layout.tsx (Server)
  └── AppShell.tsx (Client, 'use client')
        ├── State: sidebarOpen (boolean)
        ├── Effect: close sidebar on route change (usePathname)
        ├── If NO_SHELL_PREFIXES route → render {children} naked
        └── Else:
              ├── backdrop div (mobile, onClick=closeSidebar)
              ├── Sidebar (isOpen, onClose)
              └── main
                    ├── TopHeader (onMenuToggle)
                    └── {children}
```

**NO_SHELL_PREFIXES:** `['/login', '/super-admin']` — these routes skip the pharmacy shell entirely. The Super Admin portal has its own `SuperAdminSidebar`.

### 4.10 Branding Injection

Tenant branding is applied as CSS custom properties from the server:

```typescript
// app/layout.tsx (Server Component)
const branding = await getTenantBranding(effectiveTenantId);

return (
  <html>
    <head>
      <style>{`
        :root {
          --primary-color: ${branding?.primaryColor ?? '#1B4F72'};
          --secondary-color: ${branding?.secondaryColor ?? '#2E86C1'};
        }
      `}</style>
    </head>
    ...
  </html>
);
```

TailwindCSS classes reference these variables where tenant colours are needed.

### 4.11 Sale Processing (Atomic Transaction)

The `processSale()` server action wraps the entire transaction in a Prisma `$transaction`:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Pre-flight: verify each product exists, not expired, has stock
  for (const item of items) {
    const product = await tx.product.findFirst({
      where: { id: item.id, tenantId }
    });
    if (!product) throw new Error(`Product not found`);
    if (product.expiryDate && product.expiryDate < new Date())
      throw new Error(`${product.name} is expired`);
    if (product.stockQty < item.quantity)
      throw new Error(`Insufficient stock for ${product.name}`);
  }

  // 2. Create Sale + nested SaleItems
  const sale = await tx.sale.create({
    data: {
      totalAmount, tenantId, customerId,
      items: { create: items.map(i => ({ productId: i.id, quantity: i.quantity, price: i.price })) }
    }
  });

  // 3. Decrement stock for each product
  for (const item of items) {
    await tx.product.update({
      where: { id: item.id },
      data: { stockQty: { decrement: item.quantity } }
    });
  }

  // 4. Award loyalty points if customer attached
  if (customerId) {
    await tx.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: { increment: Math.floor(totalAmount / 10) } }
    });
  }

  return sale;
});
```

If any step throws, the entire transaction rolls back — no partial stock decrements.

---

## 5. Infrastructure & Deployment

### 5.1 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. Format: `postgresql://user:pass@host:5432/dbname?schema=public` |
| `NEXTAUTH_SECRET` | ✅ | Min 32-char random string. Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | Full URL of the deployment, e.g. `https://yourapp.vercel.app` |
| `NODE_ENV` | ✅ | `production` |

**No other env vars are required.** Database URL and auth secret are the only runtime secrets.

### 5.2 Build Pipeline

The `build` script in `package.json` runs four commands in sequence:

```bash
prisma generate       # Regenerates Prisma client from schema (must run before next build)
  &&
prisma db push        # Applies schema changes to the database (no migration files needed)
  &&
prisma db seed        # Seeds permissions, demo tenant, 4 SaaS users (idempotent — safe to re-run)
  &&
next build            # Compiles Next.js to .next/standalone
```

> **Why `db push` not `migrate deploy`?** HalePulse uses `db push` for rapid iteration without managing migration files. For a production system with strict rollback requirements, migrating to `migrate deploy` is recommended.

### 5.3 Vercel Deployment

```
GitHub (mvp branch)
    │  push
    ▼
Vercel (auto-deploy triggered)
    │  runs: prisma generate && prisma db push && prisma db seed && next build
    ▼
Vercel Serverless Functions (Next.js App Router)
    │  connects to
    ▼
Vercel Postgres (Neon-backed PostgreSQL)
```

**Required Vercel config:**
1. Connect GitHub repo → select `mvp` branch as production
2. Add three environment variables: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
3. `DATABASE_URL` must point to Vercel Postgres (provisioned via Dashboard → Storage → Postgres)

### 5.4 Docker / Self-Hosted Deployment

Multi-stage Dockerfile:

```dockerfile
# Stage 1: deps — install node_modules only
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: builder — compile the app
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# Stage 3: runner — minimal production image
FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

**docker-compose.yml** runs two services:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: halepulse
      POSTGRES_PASSWORD: ${DB_PASSWORD:-halepulse_secret}
      POSTGRES_DB: halepulse
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    build: .
    depends_on: [db]
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://halepulse:${DB_PASSWORD:-halepulse_secret}@db:5432/halepulse
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
      NODE_ENV: production
```

### 5.5 Seeded Default Accounts

The seed (`prisma/seed.ts`) creates these accounts on every deploy (via upsert, idempotent):

| Role | Login Portal | Email | Business ID | Username | Password |
|---|---|---|---|---|---|
| SUPER_ADMIN | /sp-login | superadmin@system.com | N/A | N/A | Admin@1234 |
| MANAGER | /login | manager@demo.com | 0721 | manager | Manager@1234 |
| MCA | /login | mca@demo.com | 0721 | pharmacist | Mca@1234 |
| NES | /login | nes@demo.com | 0721 | viewer | Nes@1234 |

> ⚠️ **Change all passwords before going live with real pharmacy data.**

### 5.6 Database Schema Strategy

- All schema changes must be **additive** (new nullable columns only — no dropping or renaming)
- This preserves all existing legacy data rows permanently
- New optional columns default to `null` for existing rows
- Enforced by convention — there is no automated guard, only team discipline

---

## 6. System Constraints & Decisions

### 6.1 Why Next.js App Router (Not Pages Router)

The App Router enables React Server Components, which allows data fetching directly in page components without `useEffect` + client-side API calls. This eliminates an entire class of loading-state complexity, particularly important for the inventory and report pages which need server-rendered data.

### 6.2 Why NextAuth v4 (Not v5/Auth.js)

NextAuth v5 (Auth.js) had breaking API changes at the time of development and limited documentation for the App Router. v4 has a stable, well-documented Credentials provider pattern. Migration to v5 is a planned future task.

### 6.3 Why Three Separate Auth Providers

Three `CredentialsProvider` instances exist because the login flows have fundamentally different field shapes:
- `client-credentials`: `{ businessId, username, password }` — 3-field tenant-scoped login
- `sp-credentials`: `{ email, password }` — 2-field platform admin login
- `credentials`: `{ email, password }` — legacy backward compatibility

NextAuth does not support conditional field schemas within a single provider, so separate providers were the only clean solution.

### 6.4 Why Zustand (Not Redux or Context) for Cart

The POS cart has highly localised state — it only matters for the duration of a single sale transaction and does not need to be persisted across page refreshes. Zustand provides the minimal API needed (add, remove, update, clear, total) with zero boilerplate. Redux would add unjustified complexity. React Context would cause full-tree re-renders on every cart change.

### 6.5 Why Sonner (Not react-hot-toast or Native alerts)

`alert()` and `confirm()` are synchronous browser dialogs that block the JS thread and cannot be styled. Sonner provides a headless, accessible toast API with first-class dark mode and rich colour support, and its API is nearly identical to a simple `toast('message')` call — no provider wrapper needed in newer versions.

### 6.6 Why `prisma db push` (Not `migrate`)

During MVP iteration, the schema changes frequently. `db push` applies schema diffs directly without generating migration files, enabling faster iteration. The downside is no rollback history. The schema's additive-only constraint (see §5.6) mitigates data loss risk significantly. When the schema stabilises post-MVP, migrating to `prisma migrate deploy` is recommended for production.

### 6.7 Why Shared-Database Multi-Tenancy

Three multi-tenancy models exist: separate databases, separate schemas, shared schema. HalePulse uses shared schema for two reasons:
1. **Cost**: A separate database per tenant is prohibitively expensive for a small pharmacy SaaS.
2. **Simplicity**: Schema migrations, backups, and infrastructure management are all single-target operations.

The tradeoff is that a bug in the `tenantId` filter could expose cross-tenant data. This is mitigated by the `getTenantContext()` pattern described in §3.4 — always extracting `tenantId` from the JWT, never from user input.

### 6.8 Why `src/proxy.ts` (Not `src/middleware.ts`)

Next.js 16 deprecated the `middleware.ts` filename convention and introduced `proxy.ts`. Using the old name triggers a build warning; using both files simultaneously causes a build error. The exported function was renamed from `middleware` to `proxy` to match the new convention.

### 6.9 Why SQLite for Dev, PostgreSQL for Prod

SQLite requires zero infrastructure for local development. Vercel's serverless runtime has no persistent filesystem, so SQLite cannot be used in production — a managed PostgreSQL (Neon via Vercel Postgres) is required. The Prisma provider is set to `postgresql` in the committed schema. Local dev overrides this via `DATABASE_URL=file:./dev.db` in `.env`.

### 6.10 Why `output: 'standalone'` in next.config.ts

Next.js standalone mode produces a self-contained server bundle in `.next/standalone/` that includes only the files needed to run the server, without `node_modules`. This reduces Docker image size from ~400MB to ~80MB and is required for the multi-stage Dockerfile pattern used in self-hosted deployments.

### 6.11 AuditLog userId as String (Not FK)

`AuditLog.userId` is a `String` field, not a Prisma relation to `User.id` (which is `Int`). This avoids a type mismatch that would require either changing `User.id` to `String` (breaking the legacy schema) or using a raw SQL cast in every audit log write. The tradeoff is no referential integrity on audit logs — acceptable because audit logs are append-only and users are never deleted.

### 6.12 CSV Import Batch Size

The bulk import processes rows in batches of 50 (`prisma.product.createMany` per batch) with a hard cap of 5,000 rows per import. The batch size balances throughput against Vercel's serverless function timeout limit (10 seconds on free tier, 60 seconds on Pro). Attempting to `createMany` all 1,896 rows in one call would likely exceed the timeout on large imports.

### 6.13 Password Complexity Policy

Passwords must satisfy all of:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 digit
- At least 1 special character

This is enforced server-side via `validatePasswordComplexity()` in `authOptions.ts`. The Business ID `0721` was chosen as the demo tenant ID specifically because it avoids repeating digits (e.g., `1234`) while being memorable and representative of the 4-digit numeric format.

---

*End of System Architecture Document — HalePulse PMS v1.0*
