/**
 * Canonical role hierarchy + permission matrix.
 *
 * Single source of truth for the HalePulse 5-tier hierarchy described in the
 * Architecture Blueprint v1.1 (§4.1 Hierarchy, §5.1 Permission Domains,
 * §5.2 Permissions Matrix).
 *
 * The existing system already models roles as per-tenant `DynamicRole` rows with
 * a numeric `level` (0 = highest privilege). This module pins the canonical slugs,
 * levels, and default permission grants so that seeding, permission resolution,
 * and the UI all agree. It introduces NO database change on its own — it is
 * consumed by the seed/migration to create the system roles and their grants.
 *
 * Hierarchy rule (blueprint §4.2): "No role can grant access it does not itself
 * possess." A user may only act at their own level or below within their scope.
 */

// ─── Roles (blueprint §4.1) ──────────────────────────────────────────────────

export type RoleSlug =
  | 'super_admin'    // L1 — platform-wide
  | 'tenant_admin'   // L2 — single tenant
  | 'branch_manager' // L3 — single branch
  | 'pharmacist'     // L4 — assigned branch
  | 'cashier';       // L5 — assigned branch

export interface RoleDef {
  slug: RoleSlug;
  /** Blueprint level label (L1–L5). */
  tier: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  /** Numeric privilege level used across the app: 0 = highest. */
  level: number;
  name: string;
  scope: 'platform' | 'tenant' | 'branch';
  description: string;
}

/** Ordered most-privileged → least-privileged. */
export const ROLES: RoleDef[] = [
  {
    slug: 'super_admin',
    tier: 'L1',
    level: 0,
    name: 'Super Admin',
    scope: 'platform',
    description:
      'Platform-wide. Tenant creation/suspension, billing plans, feature flags, platform analytics, AI config.',
  },
  {
    slug: 'tenant_admin',
    tier: 'L2',
    level: 1,
    name: 'Tenant Admin',
    scope: 'tenant',
    description:
      'Single tenant. Branch management, user provisioning, brand config, subscription oversight, tenant reporting.',
  },
  {
    slug: 'branch_manager',
    tier: 'L3',
    level: 2,
    name: 'Branch Manager',
    scope: 'branch',
    description:
      'Single branch. Staff management, branch settings, local inventory, EOD reconciliation, sale void/correction.',
  },
  {
    slug: 'pharmacist',
    tier: 'L4',
    level: 3,
    name: 'Pharmacist',
    scope: 'branch',
    description:
      'Assigned branch. Prescription verification, dispensing, stock adjustments, patient consultations, markup pricing.',
  },
  {
    slug: 'cashier',
    tier: 'L5',
    level: 4,
    name: 'Cashier',
    scope: 'branch',
    description:
      'Assigned branch. POS sales, basic inventory lookup, receipt printing, customer service.',
  },
];

export const ROLE_BY_SLUG: Record<RoleSlug, RoleDef> = Object.fromEntries(
  ROLES.map((r) => [r.slug, r]),
) as Record<RoleSlug, RoleDef>;

export const ROLE_LEVEL: Record<RoleSlug, number> = Object.fromEntries(
  ROLES.map((r) => [r.slug, r.level]),
) as Record<RoleSlug, number>;

/** True if `actor` sits at or above `target` in the hierarchy (lower level = higher). */
export function outranksOrEqual(actor: RoleSlug, target: RoleSlug): boolean {
  return ROLE_LEVEL[actor] <= ROLE_LEVEL[target];
}

/** Roles strictly below the given role — the set a role may create/assign. */
export function subordinateRoles(actor: RoleSlug): RoleSlug[] {
  return ROLES.filter((r) => r.level > ROLE_LEVEL[actor]).map((r) => r.slug);
}

// ─── Legacy role mapping (data migration, blueprint decision: map + migrate) ──

/**
 * Maps the legacy flat enum (`Role`) to a canonical slug. HQ-branch managers are
 * promoted to tenant_admin during migration; non-HQ managers become
 * branch_manager (decided per-user in the migration using `Branch.is_headquarters`).
 */
export const LEGACY_ROLE_TO_SLUG: Record<string, RoleSlug> = {
  SUPER_ADMIN: 'super_admin',
  MANAGER: 'branch_manager', // default; migration may promote HQ managers to tenant_admin
  PHARMACIST: 'pharmacist',
  MCA: 'cashier',
  AUDIT: 'cashier',
  NES: 'cashier',
};

// ─── App-role (branch credential) levels ─────────────────────────────────────
// Used for the 4 branch role-credential accounts. Manager=1 (highest in branch),
// Audit=4 (read-only). Distinct from the slug-based ROLE_LEVEL above.
export const APP_ROLE_LEVEL: Record<string, number> = {
  MANAGER: 1,
  PHARMACIST: 2,
  MCA: 3,
  AUDIT: 4,
  NES: 4, // legacy alias for AUDIT
};

/** Display label for an app role string. */
export function appRoleLabel(role: string): string {
  switch (role) {
    case 'MANAGER':     return 'Manager';
    case 'PHARMACIST':  return 'Pharmacist';
    case 'MCA':         return 'MCA';
    case 'AUDIT':
    case 'NES':         return 'Audit';
    case 'SUPER_ADMIN': return 'Super Admin';
    default: return role;
  }
}

// ─── Permission domains (blueprint §5.1) ─────────────────────────────────────

export type PermissionDomain =
  | 'TENANT_MGMT'
  | 'USER_MGMT'
  | 'BRANCH_MGMT'
  | 'INVENTORY'
  | 'POS'
  | 'PRESCRIPTIONS'
  | 'PATIENTS'
  | 'SUPPLIERS'
  | 'BILLING'
  | 'REPORTS'
  | 'AUDIT_LOG'
  | 'AI_TOOLS'
  | 'SETTINGS';

/**
 * A grant value is either `true` (full grant) or a short constraint tag the
 * service layer enforces later in the relevant phase:
 *   'branch'   — limited to the actor's own branch
 *   'sub'      — only for subordinate roles (L4/L5)
 *   'limit'    — subject to a configured limit (e.g. max discount)
 *   'own'      — only the actor's own records
 */
export type Grant = true | 'branch' | 'sub' | 'limit' | 'own';

export interface PermissionDef {
  key: string;
  label: string;
  domain: PermissionDomain;
  /** Which roles hold this permission, and any constraint. */
  grants: Partial<Record<RoleSlug, Grant>>;
}

// ─── Permission matrix (blueprint §5.2) ──────────────────────────────────────
// super_admin is omitted from grant maps: it bypasses checks (level 0) everywhere.

export const PERMISSIONS: PermissionDef[] = [
  // TENANT_MGMT
  { key: 'tenant.manage',        label: 'Manage tenants',        domain: 'TENANT_MGMT', grants: {} },
  { key: 'billing.plans.manage', label: 'Manage billing plans',  domain: 'BILLING',     grants: {} },
  { key: 'platform.ai.configure',label: 'Configure platform AI', domain: 'AI_TOOLS',    grants: {} },

  // BRANCH_MGMT
  { key: 'branch.manage',   label: 'Create/edit branches', domain: 'BRANCH_MGMT', grants: { tenant_admin: true } },
  { key: 'branch.view_all', label: 'View all branches',    domain: 'BRANCH_MGMT', grants: { tenant_admin: true } },

  // SETTINGS
  { key: 'tenant.settings.manage', label: 'Manage tenant settings', domain: 'SETTINGS', grants: { tenant_admin: true } },

  // USER_MGMT
  { key: 'user.manage',       label: 'Create/manage users', domain: 'USER_MGMT', grants: { tenant_admin: true, branch_manager: 'branch' } },
  { key: 'user.assign_roles', label: 'Assign roles',        domain: 'USER_MGMT', grants: { tenant_admin: true, branch_manager: 'sub' } },

  // AUDIT_LOG
  { key: 'audit.view', label: 'View audit logs', domain: 'AUDIT_LOG', grants: { tenant_admin: true, branch_manager: 'branch' } },

  // INVENTORY
  { key: 'inventory.grn.receive',    label: 'Receive stock (GRN)',     domain: 'INVENTORY', grants: { tenant_admin: true, branch_manager: true, pharmacist: true } },
  { key: 'inventory.pricing.markup', label: 'Set markup & auto-price', domain: 'INVENTORY', grants: { tenant_admin: true, branch_manager: true, pharmacist: true } },
  { key: 'inventory.stock.adjust',   label: 'Adjust stock quantities', domain: 'INVENTORY', grants: { tenant_admin: true, branch_manager: true, pharmacist: true } },
  { key: 'inventory.writeoff.approve', label: 'Approve stock write-off', domain: 'INVENTORY', grants: { tenant_admin: true, branch_manager: true } },
  { key: 'inventory.stocktake.run',   label: 'Run stock take',         domain: 'INVENTORY', grants: { tenant_admin: true, branch_manager: true, pharmacist: true } },
  { key: 'inventory.stocktake.print', label: 'Print stock take list',  domain: 'INVENTORY', grants: { tenant_admin: true, branch_manager: true, pharmacist: true } },
  { key: 'inventory.transfer',        label: 'Transfer stock',         domain: 'INVENTORY', grants: { tenant_admin: true, branch_manager: true } },

  // SUPPLIERS
  { key: 'supplier.manage', label: 'Manage suppliers', domain: 'SUPPLIERS', grants: { tenant_admin: true, branch_manager: true } },

  // POS
  { key: 'pos.sale.process',   label: 'Process POS sale',        domain: 'POS', grants: { tenant_admin: true, branch_manager: true, pharmacist: true, cashier: true } },
  { key: 'pos.discount.apply', label: 'Apply discount',          domain: 'POS', grants: { tenant_admin: true, branch_manager: true, pharmacist: true, cashier: 'limit' } },
  { key: 'pos.return.process', label: 'Process return/refund',   domain: 'POS', grants: { tenant_admin: true, branch_manager: true, pharmacist: true } },
  { key: 'pos.sale.void',      label: 'Void / delete a sale',    domain: 'POS', grants: { tenant_admin: true, branch_manager: true } },
  { key: 'pos.register.manage',label: 'Open/close cash register',domain: 'POS', grants: { tenant_admin: true, branch_manager: true, cashier: true } },
  { key: 'pos.eod.reconcile',  label: 'EOD cash + MoMo reconcile', domain: 'POS', grants: { tenant_admin: true, branch_manager: true } },

  // PRESCRIPTIONS
  { key: 'rx.issue',    label: 'Issue prescription',  domain: 'PRESCRIPTIONS', grants: { tenant_admin: true, pharmacist: true } },
  { key: 'rx.verify',   label: 'Verify prescription', domain: 'PRESCRIPTIONS', grants: { tenant_admin: true, pharmacist: true } },
  { key: 'rx.dispense', label: 'Dispense medication', domain: 'PRESCRIPTIONS', grants: { tenant_admin: true, pharmacist: true } },
  { key: 'rx.void',     label: 'Void prescription',   domain: 'PRESCRIPTIONS', grants: { tenant_admin: true, branch_manager: true } },

  // PATIENTS
  { key: 'patient.create',       label: 'Create patient record',   domain: 'PATIENTS', grants: { tenant_admin: true, branch_manager: true, pharmacist: true } },
  { key: 'patient.history.view', label: 'View patient drug history',domain: 'PATIENTS', grants: { tenant_admin: true, branch_manager: true, pharmacist: true } },
  { key: 'patient.refill.manage',label: 'Manage refill reminders', domain: 'PATIENTS', grants: { tenant_admin: true, branch_manager: true, pharmacist: true } },

  // REPORTS
  { key: 'reports.branch.view',      label: 'View branch reports',     domain: 'REPORTS', grants: { tenant_admin: true, branch_manager: true, pharmacist: 'own' } },
  { key: 'reports.monthly.view',     label: 'View monthly summary',    domain: 'REPORTS', grants: { tenant_admin: true, branch_manager: true } },
  { key: 'reports.all_branches.view',label: 'View all-branch reports', domain: 'REPORTS', grants: { tenant_admin: true } },
  { key: 'reports.export',           label: 'Export reports',          domain: 'REPORTS', grants: { tenant_admin: true, branch_manager: true } },

  // AI_TOOLS
  { key: 'ai.tools.access', label: 'Access AI tools', domain: 'AI_TOOLS', grants: { tenant_admin: true, branch_manager: true, pharmacist: true } },

  // IMPORT (under platform/data management)
  { key: 'import.run', label: 'Run data import', domain: 'TENANT_MGMT', grants: { tenant_admin: true } },
];

export const PERMISSION_BY_KEY: Record<string, PermissionDef> = Object.fromEntries(
  PERMISSIONS.map((p) => [p.key, p]),
);

/** All permission keys granted to a role (super_admin → all). */
export function permissionsForRole(slug: RoleSlug): string[] {
  if (slug === 'super_admin') return PERMISSIONS.map((p) => p.key);
  return PERMISSIONS.filter((p) => p.grants[slug] !== undefined).map((p) => p.key);
}

/** Grant (true / constraint tag) for a role+permission, or undefined if not granted. */
export function grantFor(slug: RoleSlug, key: string): Grant | undefined {
  if (slug === 'super_admin') return true;
  return PERMISSION_BY_KEY[key]?.grants[slug];
}
