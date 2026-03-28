# PROJECT_CONTEXT — HalePulse Pharmacy Management SaaS

A comprehensive multi-tenant pharmacy management system built with Next.js 16, Prisma, Neon (PostgreSQL), and Tailwind CSS v4. HalePulse provides role-based access control, dynamic theming, inventory management, point-of-sale (POS), prescription handling, and analytics—all isolated per tenant with enterprise-grade security and audit trails.

---

## Project Vision & Purpose

**HalePulse** is a SaaS platform designed to streamline pharmacy operations across multiple locations (branches) and tenants. It democratizes access to professional pharmacy management tools by providing:

1. **Multi-Tenant Isolation** — Each tenant operates in complete isolation with their own database records, branding, permissions, and user hierarchy.
2. **Role-Based Access Control (RBAC)** — Four-tier role system from super-admin down to read-only access, with granular permission management and custom role creation per tenant.
3. **Operational Efficiency** — Unified dashboards, inventory tracking, POS integration, and real-time stock management to minimize stockouts and expired inventory.
4. **Compliance & Auditability** — Full audit trails for inventory movements, pricing changes, user actions, and failed login attempts.
5. **Multi-Location Support** — Branch-level user assignment and permission scoping to support pharmacy chains with distributed operations.

**Target Users:**
- Super Admins: Manage tenants, system configuration, and global settings
- Managers: Full operational control within their tenant; manage users, branches, roles, and reports
- MCA (Merchandise & Customer Acquisition): Inventory and order management, supplier coordination
- NES (Notes/Enquiry/Support): Read-only access for staff who need visibility into stock and reports

---

## Core Feature Map

### 1. **Inventory Management** (`/inventory`)

**Core Capabilities:**
- **Product Catalog** — Create, update, archive (soft-delete) products with name, SKU, category, supplier, unit type, and pricing.
- **Stock Tracking** — Real-time stock quantity tracking per product. Soft-delete via `isActive` flag prevents data loss while removing from views.
- **Pricing Model** — Dual-price system: `costPrice` (wholesale) and `price` (selling). Markups computed per product or category level.
- **Stock Adjustments** — Log manual adjustments with reason (damage, recount, shrinkage, etc.) and perform stock takes. Adjustments create audit entries with old/new quantity snapshots.
- **Low-Stock Alerts** — Configurable thresholds per product. Dashboard and list views highlight items below threshold.
- **Expiry Management** — Track nearest expiry date across batches (derived field). Dashboard alerts for items expiring within 30 days.
- **Suppliers** — Manage supplier contacts, notes, and product associations. Soft-delete and full audit trail.
- **Categories** — Group products with default markup percentages that can be overridden per item.
- **Audit Log** — Complete history of all inventory changes: product creation, price updates, stock adjustments, archival. Includes who, what, when, old/new values.

**API Endpoints:**
- `GET/POST /api/inventory` — List/create products with filters
- `GET/PUT /api/inventory/products/[id]` — Fetch/update single product
- `POST /api/inventory/products/[id]/archive` — Soft-delete product
- `GET/POST /api/inventory/adjustments` — List/log stock adjustments
- `GET/POST /api/inventory/suppliers` — Supplier management
- `GET /api/inventory/alerts` — Low stock and expiry alerts
- `GET /api/inventory/audit-log` — Full audit history
- `GET /api/inventory/summary` — Dashboard KPIs

### 2. **Point of Sale (POS)** (`/pos`)

**Core Capabilities:**
- **Product Search & Cart** — Rapid product lookup with barcode/SKU/name search. Add items to cart, adjust quantity, remove items.
- **Customer Lookup/Creation** — Search existing customers by name/phone; create new customers on-the-fly during checkout.
- **Dynamic Discounts** — Apply percentage or flat-amount discounts with real-time total recalculation.
- **Miscellaneous Items** — Add one-off items (services, fees) with custom names and prices.
- **Cart Hold & Resume** — Pause current sale (hold) to start new transaction. Later resume held carts by token.
- **Multi-Payment Support** — Cash, Mobile Money (MoMo), Split payment (partial cash + partial MoMo). Change calculation for cash.
- **Receipt Printing** — Generate itemized receipt with tenant branding, timestamp, payment method, cashier, customer info.
- **Payment Processing** — POST sale to database, generate unique sale token, and print receipt on demand.

**UI Patterns:**
- Two-column layout: product search (left) and cart summary (right)
- Full-screen modal overlays for checkout dialogs (payment, discount, hold management)
- Real-time cart state via Zustand store (client-side)
- Toast notifications for errors and confirmations

**API Endpoints:**
- `GET /api/customers` — Search/list customers
- `POST /api/customers` — Create new customer
- `POST /api/pos/sales` — Process completed sale (implied; likely in actions)

### 3. **Prescription Management** (Emerging)

**Current State:** Preliminary structure in place; prescriptions tied to Sales model via `miscItems` field for ad-hoc notes.

**Future Vision:**
- Rx intake forms with patient info, prescriber, medications, dosage, quantity
- Prescription validation (duplicate therapy, drug-allergy checks)
- Fulfillment workflow tracking
- Audit trail linking prescription to sale transaction

### 4. **Analytics & Reporting** (`/dashboard/*`)

**Role-Specific Dashboards:**

**Manager Dashboard** (`/dashboard/manager`):
- Greeting, date, tenant branding
- **Key Stats:** Total products, low-stock count, expiring-soon count, today's sales, sales trend vs. yesterday
- **Charts:**
  - Monthly sales revenue (bar chart, Recharts)
  - Payment method breakdown today (pie/donut chart)
- **Recent Sales Table:** Last 10 transactions with customer, item count, amount, timestamp
- **Quick Links:** Stock adjustments, restock orders, audit logs

**MCA Dashboard** (`/dashboard/mca`):
- Focused on inventory and ordering
- Low-stock alerts and restock recommendations
- Supplier order history and status

**NES Dashboard** (`/dashboard/nes`):
- Read-only dashboards
- Visibility into stock levels, sales trends, and alerts

**Metrics:**
- Sales velocity and daily trends
- Payment method distribution
- Stock health (low stock %, expiry %...)
- Top-selling products by revenue/quantity
- Customer analytics (repeat customers, loyalty points)

---

## Tech Stack & Architecture

### **Frontend**

- **Framework:** Next.js 16.2 (App Router, Server Components where applicable)
- **Styling:** Tailwind CSS v4 with PostCSS 4
- **Component Library:** shadcn/ui (BaseUI + custom adaptations)
- **Icons:** Lucide React + HugeIcons
- **Forms & Validation:** Zod for schema validation, class-variance-authority (CVA) for component variants
- **State Management:** Zustand (client-side cart/UI state)
- **Data Fetching:** TanStack React Query v5 (server state, caching)
- **Charts & Data Viz:** Recharts
- **Notifications:** Sonner (toast notifications)
- **Authentication UI:** next-auth + custom SessionProvider
- **Design Tooling:** Agentation (design critique toolbar, integrated for design feedback)
- **Animation:** tw-animate-css (Tailwind animation utilities)
- **Utility:** culori (color space conversions for dynamic theming)

### **Backend**

- **Runtime:** Node.js (Next.js server functions)
- **ORM:** Prisma 6.19 (PostgreSQL driver, auto-generates migrations)
- **Database:** PostgreSQL via Neon (serverless, production-ready)
- **Authentication:** NextAuth 4.24 (session-based, supports impersonation)
- **API Pattern:** RESTful route handlers (`/app/api/**/route.ts`)
- **Server Actions:** Next.js Server Actions for mutations (`/app/actions.ts`)
- **Middleware:** Custom auth/role guards for endpoint protection

### **DevOps & Build**

- **Build Tool:** Next.js built-in (SWC compiler, optimized bundle)
- **Linting:** ESLint 9 + eslint-config-next
- **Package Manager:** npm
- **Environment:** `.env` for secrets (DATABASE_URL, NEXTAUTH_SECRET, etc.)
- **Deployment Ready:** Vercel (native Next.js support) or self-hosted Node environments

### **Architecture Patterns**

**Monolithic SaaS:**
- Single codebase, multi-tenant data model
- Tenant context injected via session/headers
- Database row-level isolation via `tenantId` foreign keys

**Layered Architecture:**
```
UI Layer (Components + Pages)
  ↓
State Layer (Zustand + React Query)
  ↓
Server Actions / API Routes
  ↓
Service Layer (lib/auth, lib/permissions, lib/branding)
  ↓
Prisma ORM
  ↓
PostgreSQL
```

**Authentication Flow:**
1. NextAuth session established on login
2. Session extended with `tenantId`, `role`, `branchId` via `authOptions` callback
3. API routes and server actions check `requireAuth()` and `requireRole()`
4. Impersonation mode allows super-admin to assume tenant user roles (tracked in session)

---

## Design Language & UI Architecture

### **Color System — OKLCH-Based Dynamic Theming**

**Foundation:**
- **Color Space:** OKLCH (Oklab lightness-chroma-hue) for perceptually uniform colors
- **Palette:** Tailwind CSS v4 reference scales (50–950 shades per color)
- **Default Accent:** Indigo (primary brand color), with secondary/destructive variants
- **Neutral Scale:** Zinc (light mode), Slate (dark mode backups)

**Theme Tokens** (CSS variables, defined in `/globals.css`):
```
Light Mode Defaults:
  --primary: oklch(0.511 0.262 276.966)        // Indigo-600
  --secondary: oklch(0.967 0.001 286.375)      // Zinc-50/Slate-100
  --destructive: oklch(0.577 0.245 27.325)     // Red-600
  --background: oklch(1 0 0)                   // Pure white
  --card: oklch(1 0 0)                         // Pure white
  --sidebar: oklch(0.985 0 0)                  // Almost white

Dark Mode Defaults:
  --background: oklch(0.141 0.005 285.823)     // Zinc-950
  --card: oklch(0.21 0.006 285.885)            // Zinc-900
  --sidebar: oklch(0.21 0.006 285.885)         // Zinc-900
  --primary: oklch(0.585 0.233 277.117)        // Indigo-500 (brighter in dark)
```

**Tenant Customization:**
- Each tenant can set `primaryColor` and `secondaryColor` (hex stored in database)
- Dynamic theme generator (`/lib/theme/theme-utils.ts`) converts tenant hex → full OKLCH scale
- Theme injected into DOM as inline `<style>` tag or CSS variables (prevents style conflicts)
- **Glass Morphism:** Semi-transparent overlays with `backdrop-filter: blur(12px)` for dropdowns/modals
- **Surface Elevation:** `--surface` (base), `--surface-raised` (cards), `--glass-bg` (frosted overlays)

### **Component Architecture**

**shadcn/ui Foundation:**
- Unstyled, accessible components from @radix-ui + Headless UI wrapped with Tailwind styles
- Variants managed via CVA for consistent prop-based styling
- Examples: `Button`, `Card`, `Dialog`, `Sheet`, `Dropdown`, `Table`, `Input`, `Label`, `Badge`

**Custom Layouts:**
- **AppShell** — Two-column layout (sidebar + main content)
  - Sidebar: collapsible (desktop), overlay (mobile)
  - Content area: floating card with rounded borders, shadow, inner scrolling
  - Backdrop overlay with `backdrop-blur-[2px]` on mobile menu open
  - Smooth Tailwind animations: `animate-in`, `fade-in`, `duration-150`

- **Sidebar** (`/components/layout/Sidebar.tsx`):
  - Vertical menu with icons + labels
  - Collapse toggle for space efficiency
  - Theme-aware text colors: `text-sidebar-foreground` (dark mode aware)
  - Transition: `transition-all duration-300 ease-in-out`

- **TopHeader** (`/components/layout/TopHeader.tsx`):
  - Breadcrumbs, user profile menu, theme toggle, logout
  - Impersonation banner (if in admin mode)
  - Sticky positioning within card

**Interactions:**
- **Hover States:** `surface-interactive:hover` → `background-color: var(--hover)` (4% overlay)
- **Active States:** `active:scale(0.98)` for tactile feedback
- **Transitions:** 150ms `cubic-bezier(0.4, 0, 0.2, 1)` (standard easing)
- **Ripples:** Subtle shadow-based elevation on premium cards: `box-shadow: 0 0 0 1px var(--border), var(--shadow-premium)`

**Typography:**
- Base font size: 14px (html)
- Font weights capped at 400 (no bold/semibold on body text globally)
- Headings inherit from context; accents use primary color
- Letter spacing: tight for density

**Spacing & Rhythm:**
- Base unit: 0.25rem (4px)
- Border radius default: 0.625rem (10px) with scaled variants (sm, md, lg, xl, 2xl, 3xl, 4xl)
- Padding/margins: Tailwind spacing scale (p-4, gap-3, etc.)
- Sidebar width: 260px (expanded), 68px (collapsed)

**Dark Mode:**
- Automatic via `next-themes` + `prefers-color-scheme` media query
- Manual toggle: Theme switch in TopHeader
- Class-based toggle: `.dark` class added to `<html>`
- All colors have explicit dark variants in `:root` and `.dark` blocks

### **Animation & Micro-interactions**

- **Skeleton Loading:** `animate-pulse` for data placeholders
- **Page Transitions:** Fade-in animations on route changes
- **Modal Dialogs:** `animate-in` + `zoom-in` + `duration-200`
- **Sheet Sidebars:** Slide-in from left/right
- **Toast Notifications:** Sonner default fade + slide animations
- **Dropdown Menus:** CSS animations via `radix-ui` + Tailwind

---

## Data Schema

### **Core Models**

#### **User**
- **PK:** `id` (auto-increment)
- **Fields:**
  - `username` (unique): Login identifier
  - `email` (unique, optional): Email address
  - `password`/`passwordHash`: Bcrypt for login (passwordHash for new flow)
  - `role` (enum: SUPER_ADMIN, MANAGER, MCA, NES): Static role
  - `tenantId` (FK→Tenant): Current tenant assignment (null for super-admin)
  - `branchId` (FK→Branch): Optional branch assignment
  - `dynamicRoleId` (FK→DynamicRole): Custom tenant role override
  - `businessUsername`: Display name for tenant branding
  - `isActive`: Soft-delete flag
  - `lastActiveAt`: Session tracking
  - `failedLoginCount`, `lockedUntil`: Brute-force protection
  - `mustChangePassword`, `lastPasswordChange`: Password policy

**Relations:**
- `branch`: User assigned to specific location
- `tenant`: Workspace tenant
- `dynamicRole`: Custom role permissions
- `createdProducts`: Products created by this user (audit)
- `stockAdjustments`: Stock adjustments performed (audit)
- `inventoryAuditLogs`: All inventory audits performed

---

#### **Product**
- **PK:** `id` (auto-increment)
- **Fields:**
  - `name`: Product name
  - `brand` (optional): Manufacturer
  - `category`: Product category (FK→Category)
  - `sku` (unique per tenant): Stock Keeping Unit
  - `price`: Selling price (derived from costPrice × markupPercent)
  - `costPrice` (optional): Wholesale/procurement cost
  - `markupPercent`: Price multiplier (default 0; % added to cost to get selling price)
  - `stockQty`: Current quantity on hand
  - `lowStockThreshold`: Alert threshold (default 10)
  - `expiryDate` (optional): Nearest batch expiry (derived across all batches in real data)
  - `description`: Long-form notes
  - `isActive`: Soft-delete (prevents data loss; excluded from lists when false)
  - `supplierId` (FK→Supplier): Primary source
  - `createdBy` (FK→User): Creator audit
  - `tenantId` (FK→Tenant): Multi-tenant isolation
  - `createdAt`, `updatedAt`: Timestamps

**Indexes:** `name`, `isActive`, `supplierId` (fast lookups)
**Unique:** `(tenantId, sku)` (prevent SKU collision per tenant)

**Relations:**
- `tenant`: Owning workspace
- `supplier`: Supplier relationship
- `creator`: User who created
- `saleItems`: Transactions involving this product
- `stockAdjustments`: Manual stock changes
- `inventoryAuditLogs`: Full change history

---

#### **Stock Adjustment**
- **PK:** `id` (auto-increment)
- **Fields:**
  - `productId` (FK→Product)
  - `adjustedBy` (FK→User): Who made the change
  - `oldQuantity`, `newQuantity`: Before/after snapshots
  - `delta`: Signed difference (newQuantity - oldQuantity)
  - `reason`: Enum (RECOUNT, DAMAGE, SHRINKAGE, RECEIVED, etc.)
  - `notes` (optional): Free-form explanation
  - `tenantId` (FK→Tenant): Multi-tenant scoping
  - `adjustedAt`: Timestamp

**Relations:** Product, User, Tenant

---

#### **InventoryAuditLog**
- **PK:** `id` (auto-increment)
- **Fields:**
  - `actionType`: Event type (PRODUCT_CREATED, PRICE_UPDATED, PRODUCT_ARCHIVED, etc.)
  - `productId`, `supplierId` (optional): What changed
  - `performedBy` (FK→User): Who
  - `oldValue`, `newValue` (JSON): Before/after snapshots of entire object
  - `notes` (optional): Context
  - `tenantId` (FK→Tenant): Isolation
  - `performedAt`: When

**Index:** `(productId)`, `performedAt DESC` (fast filtering by time)

**Relations:** Product, Supplier, User, Tenant

---

#### **Supplier**
- **PK:** `id` (auto-increment)
- **Fields:**
  - `name`: Supplier name
  - `contactName`, `phone`, `email`, `address`: Contact info
  - `notes`: Additional details
  - `isActive`: Soft-delete
  - `tenantId` (FK→Tenant): Multi-tenant
  - `createdAt`: Timestamp

**Relations:** Products, Audit Logs

---

#### **Sale** (POS Transactions)
- **PK:** `id` (auto-increment)
- **Fields:**
  - `totalAmount`: Final transaction total (after discount)
  - `discount`: Discount applied (numeric)
  - `paymentType`: Cash, MoMo, Split (enum as string)
  - `status`: Pending, Completed, Cancelled (enum as string)
  - `customerId` (FK→Customer, optional): Linked customer or null
  - `sellerId` (FK→User): Cashier/POS operator
  - `clientToken` (unique, optional): Receipt lookup identifier
  - `miscItems` (optional JSON): Ad-hoc items added (Rx notes, services)
  - `tenantId` (FK→Tenant): Workspace
  - `createdAt`: Timestamp

**Relations:** Customer, User, SaleItems, Tenant

---

#### **SaleItem**
- **PK:** `id` (auto-increment)
- **Fields:**
  - `saleId` (FK→Sale): Parent transaction
  - `productId` (FK→Product): What was sold
  - `quantity`: Units sold
  - `price`: Unit price at time of sale (snapshot; decoupled from current product price)

**Relations:** Sale, Product

---

#### **Customer**
- **PK:** `id` (auto-increment)
- **Fields:**
  - `name`: Customer name
  - `phone` (unique per tenant, optional): Contact
  - `loyaltyPoints` (default 0): Rewards accumulation
  - `tenantId` (FK→Tenant): Multi-tenant
  - `createdAt`: Timestamp

**Relations:** Sales, Tenant

---

#### **Tenant** (SaaS Workspace)
- **PK:** `id` (CUID string)
- **Fields:**
  - `name`: Tenant/company name
  - `subdomain` (unique): URL identifier (e.g., acmepharm.halepulse.com)
  - `primaryColor`, `secondaryColor`: Hex brand colors (default indigo & purple)
  - `baseColor`: Fallback for theme generation
  - `contrast`: Opacity/alpha for glass morphism (default 0.7)
  - `customSidebar` (bool): If tenant overrides sidebar color
  - `sidebarColor`: Custom sidebar hex (if enabled)
  - `logoUrl`: Tenant brand logo
  - `isActive`: Soft-delete
  - `businessId`: Unique B2B identifier
  - `legalName`, `address`, `licenceNumber`, `taxVatNumber`: Compliance fields
  - `subscriptionTier`: basic, pro, enterprise (future feature-flagging)
  - `primaryContact`, `primaryPhone`, `primaryEmail`: Support contact
  - `createdAt`: Timestamp

**Relations:** Users, Branches, Products, Suppliers, Sales, Customers, Roles, Permissions, Audit Logs, Feature Flags

---

#### **Branch** (Multi-Location)
- **PK:** `id` (CUID string)
- **Fields:**
  - `name`: Branch/location name
  - `tenantId` (FK→Tenant): Parent organization
  - `address`, `phone`: Location details
  - `isActive`: Soft-delete

**Relations:** Tenant, Users

---

#### **DynamicRole** & **DynamicRolePermission** (Custom RBAC)
- **DynamicRole:**
  - `id` (CUID)
  - `tenantId`, `name`, `slug`, `description`
  - `level` (int): Hierarchy for role comparison
  - `isSystem` (bool): Prevents deletion of system roles
  - `isActive`, `createdAt`, `updatedAt`

- **DynamicRolePermission:**
  - `id`, `dynamicRoleId`, `permissionKey`, `tenantId`
  - Links custom role to permission strings (INVENTORY_EDIT, POS_ACCESS, etc.)

**Relations:** DynamicMenuConfig (role menu), Tenant, User assignments

---

#### **MenuConfig** & **DynamicMenuConfig** (Navigation)
- Static menu items per built-in role
- Dynamic menu items per custom role
- Format: Stringified JSON array of menu definitions

**Example:**
```json
[
  { "key": "inventory", "label": "Inventory", "path": "/inventory", "icon": "package" },
  { "key": "pos", "label": "Point of Sale", "path": "/pos", "icon": "shopping-cart" }
]
```

---

#### **FeatureFlag** & **TenantFeatureFlag**
- Global feature flag definitions (INVENTORY_V2, SMART_REORDER, etc.)
- Per-tenant enablement (allows A/B testing and gradual rollouts)

---

#### **AuditLog** (System-level)
- User actions: login, logout, API calls, configuration changes
- `userId` (string, can be session ID), `tenantId`, `action` (string), `metadata` (JSON)
- `ipAddress`, `createdAt`

---

#### **LoginAttempt** (Security)
- Record of login attempts (success/failure)
- `email`, `username` (optional), `tenantId` (optional for multi-tenant login)
- `success` (bool), `ipAddress`, `userAgent` (device fingerprint)
- Used for: brute-force detection, failed-login lockout, geolocation anomalies (future)

---

### **Relationships Summary**

```
┌─────────────┐
│   Tenant    │  ◄──── (owns everything)
└──────┬──────┘
       │
       ├──► Users (1-to-Many)
       │     └──► DynamicRole (custom RBAC)
       │
       ├──► Branch (1-to-Many)
       │     └──► User (branch assignment)
       │
       ├──► Product (1-to-Many)
       │     ├──► Supplier (Many-to-1)
       │     ├──► SaleItem (1-to-Many)
       │     ├──► StockAdjustment (1-to-Many)
       │     └──► InventoryAuditLog (1-to-Many)
       │
       ├──► Supplier (1-to-Many)
       │     └──► InventoryAuditLog (1-to-Many)
       │
       ├──► Customer (1-to-Many)
       │     └──► Sale (1-to-Many)
       │
       ├──► Sale (1-to-Many)
       │     ├──► SaleItem (1-to-Many)
       │     └──► Customer (Many-to-1, optional)
       │
       ├──► StockAdjustment (1-to-Many)
       │
       ├──► DynamicRole (1-to-Many)
       │     └──► DynamicRolePermission (1-to-Many)
       │     └──► DynamicMenuConfig (1-to-Many)
       │
       ├──► MenuConfig (1-to-Many; by static role)
       │
       ├──► FeatureFlag (Many-to-Many via TenantFeatureFlag)
       │
       ├──► RolePermission (1-to-Many; by static role)
       │
       ├──► AuditLog (1-to-Many)
       │
       └──► LoginAttempt (1-to-Many)
```

---

## Current UI Challenges

### **1. Theme Isolation & Tenant Branding**
**Status:** Recently resolved (commit: `b63df4f`)
**Challenge:** Preventing tenant branding (custom colors) from bleeding into super-admin UI. Super-admin must always see system theme; tenant users see tenant theme.
**Solution:** Theme context scoping + explicit role checks to inject theme only for non-super-admin routes.
**Remaining:** Ensure consistency across all modal/dropdown overlays; test color contrast in dark mode edge cases.

### **2. Complex Form States & Validation**
**Status:** In progress
**Challenge:** Multi-step workflows (new tenant creation, supplier onboarding, bulk stock imports) with nested validation, conditional fields, and error recovery.
**Areas:**
- **Inventory Product Form:** SKU uniqueness validation (tenant-scoped), markup % vs. absolute price reconciliation
- **POS Checkout:** Dynamic discount application, payment reconciliation (cash tending, split payments)
- **Supplier Forms:** Optional contact fields, phone/email format validation

### **3. Data Table Complexity**
**Status:** Ongoing optimization
**Challenge:** Large product lists (100s–1000s of items) with sorting, filtering, pagination, inline editing, and status badges.
**Current:** Basic shadcn table with client-side search
**Needed:**
- Server-side pagination with cursor-based navigation
- Bulk actions (archive multiple, update prices in batch)
- Column visibility toggling
- Inline cell editing (quantity, price) with optimistic updates
- Status indicators (low stock, expiring) with visual hierarchy

### **4. Mobile Responsiveness (POS)**
**Status:** Partial
**Challenge:** POS interface (product search + cart) must be responsive for tablets and phones used at checkout.
**Current:** Single product search bar, cart summary; needs touch-optimized buttons and spacing.
**Needed:**
- Barcode scanner integration
- Touch-friendly tap targets (min 44px)
- Landscape/portrait adaptation
- Reduced-motion preference support

### **5. Real-Time Sync & Conflict Resolution**
**Status:** Not yet implemented
**Challenge:** In a busy pharmacy, multiple users may adjust stock simultaneously. Current model: last-write-wins.
**Needed:**
- Optimistic UI updates with rollback on failure
- Conflict detection: "Product quantity was updated by [User] 2 minutes ago"
- Undo/redo for recent actions
- WebSocket/polling for live inventory broadcast (future)

### **6. High-Fidelity Analytics**
**Status:** Basic dashboard complete; advanced filtering needed
**Challenge:** Managers want drill-down analytics (sales by category, supplier margin analysis, customer retention).
**Current:** Line charts, donut charts; hard-coded time ranges (today, this month)
**Needed:**
- Date range picker with presets (last 7 days, last 30 days, year-to-date)
- Cross-filters: filter by category, supplier, payment method and see chart updates
- Export to CSV/PDF for reports
- Scheduled report delivery (email)

### **7. Audit Log Readability**
**Status:** Data captured; UI crude
**Challenge:** Large audit log entries with JSON diffs are hard to scan. Need human-readable descriptions.
**Current:** Flat list of actionType + raw oldValue/newValue JSON
**Needed:**
- Human descriptions: "Price updated: ₵45.00 → ₵48.50" instead of JSON diffs
- Filter by action type, user, date range
- Timeline view (visual progress bar of changes over time)
- Revert capability (restore product to prior state via audit snapshot)

### **8. Performance & Caching**
**Status:** Basic; optimizations pending
**Challenge:** Frequent dashboard refreshes, repeated supplier/category queries, theme calculations.
**Needed:**
- React Query mutation caching (invalidate on specific updates)
- CSS-in-JS optimization (avoid runtime theme recalculations)
- Image optimization (supplier logos, tenant branding)
- Lazy load chart libraries (recharts on-demand)
- Service Worker for offline POS capability

### **9. Accessibility & Contrast**
**Status:** Recently improved (commit: `ddadd24`)
**Challenge:** WCAG 2.1 AA compliance with dynamic tenant colors. User may choose low-contrast branding.
**Current:** Fixed text-foreground on some elements; some buttons lack sufficient contrast in dark mode
**Needed:**
- Automated contrast checker on tenant color selection (warn if <4.5:1 for text)
- ARIA labels for all interactive elements
- Keyboard navigation testing (Tab, Enter, Escape, Arrow keys)
- Screen reader testing (VoiceOver, NVDA)
- Focus visible styles (no `outline: none` without replacement)

### **10. Dropdown/Modal Animation Jank**
**Status:** Partially resolved (commit: `9231161`)
**Challenge:** Translucent backdrops with blur effect cause performance hiccups on slower devices.
**Solution:** Reduced motion support, CSS `will-change` hints, backdrop-filter applied selectively
**Remaining:** Profile and test on real mobile devices; consider disabling blur on low-end devices

---

## Development Workflow & Standards

### **Code Organization**

```
src/
  app/
    (pages)              — Next.js App Router pages
    api/                 — API route handlers
    actions.ts           — Server Actions for mutations
  components/
    ui/                  — shadcn/ui primitives
    layout/              — AppShell, Sidebar, TopHeader
  lib/
    auth/                — Auth helpers, role guards
    permissions/         — Permission checks
    branding/            — Tenant theming
    menus/               — Dynamic menu loader
    utils.ts             — Misc helpers
    store.ts             — Zustand stores (cart)
  types/
    next-auth.d.ts       — Session type extensions
    culori.d.ts          — Color library types
  prisma/
    schema.prisma        — Database schema
    seed.ts              — Dev seed script
```

### **Naming Conventions**

- **Components:** PascalCase (e.g., `ProductCard.tsx`, `StockAdjustmentForm.tsx`)
- **Utils/Helpers:** camelCase (e.g., `getTenantContext()`, `checkPermission()`)
- **API Routes:** kebab-case in file paths (e.g., `/api/inventory/products/[id]/archive`)
- **Database Models:** PascalCase (Prisma convention)
- **CSS Classes:** kebab-case (Tailwind standard)
- **Types/Interfaces:** PascalCase, suffix with `Props` for component props

### **Testing (Planned)**

- Unit tests: Jest + React Testing Library for components
- Integration tests: API route handlers with test database
- E2E tests: Playwright for critical workflows (login, sale, stock adjustment)
- Audit: Security audit checklist (OWASP Top 10, WCAG 2.1)

### **Performance Targets**

- **Core Web Vitals:**
  - LCP (Largest Contentful Paint): < 2.5s
  - FID (First Input Delay): < 100ms
  - CLS (Cumulative Layout Shift): < 0.1
- **API Response Times:** < 200ms for reads, < 500ms for writes
- **Database Queries:** No N+1 queries; use relations/includes wisely

---

## Deployment & Environment

### **Environment Variables** (`.env`)

```
DATABASE_URL=postgresql://...        # Neon or local PostgreSQL
NEXTAUTH_SECRET=<random-secret>      # JWT signing key
NEXTAUTH_URL=http://localhost:3000   # Callback URL
```

### **Build & Start**

```bash
npm run build          # Compile Next.js + Prisma codegen
npm start              # Production server (port 3000)
npm run dev            # Development mode (hot reload)
```

### **Database Migrations**

```bash
npx prisma db push    # Apply schema changes to dev/test
npx prisma migrate dev --name <name>  # Create timestamped migration
npx prisma studio    # Visual DB browser
```

### **Seed Data**

Default demo tenant and users (defined in `prisma/seed.ts`):
- Super Admin: `superadmin@system.com` / `Admin@1234`
- Manager: `manager@demo.com` / `Manager@1234`
- MCA: `mca@demo.com` / `Mca@1234`
- NES: `nes@demo.com` / `Nes@1234`

---

## Future Roadmap

1. **Prescription Module** — Rx intake, validation, fulfillment tracking
2. **Smart Reordering** — ML-driven stock recommendations based on sales history
3. **Multi-Currency Support** — Handle foreign exchange for regional pharmacies
4. **Mobile App** — React Native companion for POS and inventory scanning
5. **Integration Layer** — APIs for ERP, accounting software, payment gateways
6. **Advanced Analytics** — BI dashboard, KPI benchmarking, predictive alerts
7. **Offline Mode** — PWA with service worker for unreliable networks

---

## Quick Reference: Key Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database schema + relationships |
| `src/app/globals.css` | Global styles, OKLCH theme tokens |
| `src/lib/theme/color-scales.ts` | Tailwind v4 color reference data |
| `src/lib/theme/theme-utils.ts` | Dynamic theme generator from tenant hex |
| `src/components/layout/AppShell.tsx` | Main layout wrapper (sidebar + content) |
| `src/lib/auth/authOptions.ts` | NextAuth session config |
| `src/lib/permissions/permissionMap.ts` | Permission definitions |
| `src/app/dashboard/manager/DashboardView.tsx` | Manager KPI dashboard |
| `src/app/pos/page.tsx` | POS interface (cart + checkout) |
| `src/app/actions.ts` | Server Actions for mutations |
| `src/lib/store.ts` | Zustand cart state |

---

## Conclusion

HalePulse is a production-ready, multi-tenant SaaS platform combining modern web tech (Next.js 16, Tailwind v4, Prisma) with thoughtful UX (glassmorphism, OKLCH theming, responsive design). While the core feature set is functional, ongoing refinement is needed in analytics, performance, and accessibility. The architecture supports rapid tenant onboarding and feature expansion; the codebase is clean and well-organized for team collaboration.

---

**Document Version:** 1.0
**Last Updated:** 2026-03-28
**Maintained By:** Development Team
