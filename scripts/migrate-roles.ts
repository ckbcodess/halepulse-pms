/**
 * Phase 1A — Role hierarchy migration (Blueprint v1.1 §4–§5).
 *
 * Brings every tenant onto the canonical 5-tier hierarchy:
 *   super_admin (L1) → tenant_admin (L2) → branch_manager (L3) →
 *   pharmacist (L4) → cashier (L5)
 *
 * What it does (idempotent — safe to re-run):
 *   1. Snapshots current users + dynamic roles to scripts/backups/.
 *   2. Upserts the canonical Permission rows (blueprint §5.2 matrix).
 *   3. Per tenant: upserts the 4 tenant-level canonical system roles, syncs
 *      their permission grants from the matrix, and gives each a default menu.
 *   4. Reassigns every user to the right canonical role:
 *        - by existing system-role slug (business_admin→tenant_admin,
 *          manager→branch_manager, pharmacist→pharmacist, viewer→cashier)
 *        - users on a CUSTOM (non-system) role are left untouched
 *        - users with no dynamic role fall back to legacy saasRole, with
 *          MANAGER promoted to tenant_admin when they have no branch (HQ proxy)
 *          and branch_manager otherwise.
 *   5. Deactivates the obsolete system roles (business_admin, manager, viewer).
 *
 * Legacy `saasRole` is intentionally left intact so existing role-string checks
 * and the legacy menu fallback keep working during the transition.
 *
 * Run:  npx tsx scripts/migrate-roles.ts
 */
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROLES,
  permissionsForRole,
  PERMISSIONS,
  LEGACY_ROLE_TO_SLUG,
  type RoleSlug,
} from '../src/lib/auth/roleHierarchy';

const prisma = new PrismaClient();

/**
 * Sidebar items — kept in sync with MASTER_MENU in src/lib/menus/getMenuForUser.ts.
 * Inlined here so this script has no app-internal (path-aliased) imports.
 */
const MASTER_MENU = [
  { key: 'dashboard', label: 'Dashboard',     path: '/' },
  { key: 'pos',       label: 'Point of Sale', path: '/pos' },
  { key: 'inventory', label: 'Inventory',     path: '/inventory' },
  { key: 'customers', label: 'Customers',     path: '/customers' },
  { key: 'reports',   label: 'Reports',       path: '/reports' },
  { key: 'audit-log', label: 'Audit Log',     path: '/inventory/audit-log' },
  { key: 'settings',  label: 'Settings',      path: '/settings' },
  { key: 'users',     label: 'Team',          path: '/users' },
];

/** Old system-role slug → canonical slug. */
const SLUG_REMAP: Record<string, RoleSlug> = {
  super_admin: 'super_admin',
  business_admin: 'tenant_admin',
  manager: 'branch_manager',
  pharmacist: 'pharmacist',
  viewer: 'cashier',
};

/** System roles that are superseded and should be deactivated after reassignment. */
const OBSOLETE_SLUGS = ['business_admin', 'manager', 'viewer'];

const DOMAIN_CATEGORY: Record<string, string> = {
  TENANT_MGMT: 'Platform',
  USER_MGMT: 'User Management',
  BRANCH_MGMT: 'Branch Management',
  INVENTORY: 'Inventory',
  POS: 'Sales & Dispensing',
  PRESCRIPTIONS: 'Prescriptions',
  PATIENTS: 'Patients',
  SUPPLIERS: 'Suppliers',
  BILLING: 'Billing',
  REPORTS: 'Reporting',
  AUDIT_LOG: 'Audit',
  AI_TOOLS: 'AI Tools',
  SETTINGS: 'Configuration',
};

/** Default sidebar visibility per canonical role (keys from MASTER_MENU). */
const MENU_VISIBILITY: Record<RoleSlug, string[]> = {
  super_admin: MASTER_MENU.map((m) => m.key),
  tenant_admin: MASTER_MENU.map((m) => m.key),
  branch_manager: MASTER_MENU.map((m) => m.key),
  pharmacist: ['dashboard', 'pos', 'inventory', 'customers', 'reports'],
  cashier: ['dashboard', 'pos', 'customers'],
};

async function main() {
  console.log('🔁 Phase 1A — Role hierarchy migration\n');

  // ── 1. Snapshot ────────────────────────────────────────────────────────────
  const usersBefore = await prisma.user.findMany({
    select: { id: true, email: true, saasRole: true, tenantId: true, branchId: true, dynamicRoleId: true },
  });
  const rolesBefore = await prisma.dynamicRole.findMany();
  const backupDir = join(process.cwd(), 'scripts', 'backups');
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(backupDir, `roles-migration-${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify({ usersBefore, rolesBefore }, null, 2));
  console.log(`  📦 Backup written: ${backupPath}`);
  console.log(`     (${usersBefore.length} users, ${rolesBefore.length} dynamic roles)\n`);

  // ── 2. Canonical permissions ────────────────────────────────────────────────
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { label: p.label, category: DOMAIN_CATEGORY[p.domain] ?? p.domain },
      create: { key: p.key, label: p.label, category: DOMAIN_CATEGORY[p.domain] ?? p.domain },
    });
  }
  console.log(`  ✓ ${PERMISSIONS.length} canonical permissions upserted`);

  // ── Ensure the global super_admin role exists (level 0, tenantId null) ───────
  let superAdmin = await prisma.dynamicRole.findFirst({ where: { slug: 'super_admin', tenantId: null } });
  if (!superAdmin) {
    superAdmin = await prisma.dynamicRole.create({
      data: { slug: 'super_admin', name: 'Super Admin', description: ROLES[0].description, level: 0, isSystem: true },
    });
    console.log('  ✓ Created global super_admin role');
  }

  // ── 3. Per-tenant canonical roles ───────────────────────────────────────────
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  const tenantRoleId = new Map<string, Map<RoleSlug, string>>(); // tenantId → slug → roleId

  const tenantLevelRoles = ROLES.filter((r) => r.slug !== 'super_admin');

  for (const tenant of tenants) {
    const slugToId = new Map<RoleSlug, string>();
    for (const def of tenantLevelRoles) {
      const role = await prisma.dynamicRole.upsert({
        where: { tenantId_slug: { tenantId: tenant.id, slug: def.slug } },
        update: { name: def.name, description: def.description, level: def.level, isSystem: true, isActive: true },
        create: {
          tenantId: tenant.id,
          slug: def.slug,
          name: def.name,
          description: def.description,
          level: def.level,
          isSystem: true,
        },
      });
      slugToId.set(def.slug, role.id);

      // Sync permission grants exactly to the matrix for these system roles.
      const keys = permissionsForRole(def.slug);
      await prisma.dynamicRolePermission.deleteMany({ where: { dynamicRoleId: role.id } });
      if (keys.length) {
        await prisma.dynamicRolePermission.createMany({
          data: keys.map((permissionKey) => ({ dynamicRoleId: role.id, permissionKey, tenantId: tenant.id })),
          skipDuplicates: true,
        });
      }

      // Default menu for the role.
      const visible = new Set(MENU_VISIBILITY[def.slug]);
      const menuItems = MASTER_MENU.map((m) => ({
        key: m.key, label: m.label, path: m.path, visible: visible.has(m.key),
      }));
      await prisma.dynamicMenuConfig.upsert({
        where: { dynamicRoleId_tenantId: { dynamicRoleId: role.id, tenantId: tenant.id } },
        update: { menuItems: JSON.stringify(menuItems) },
        create: { dynamicRoleId: role.id, tenantId: tenant.id, menuItems: JSON.stringify(menuItems) },
      });
    }
    tenantRoleId.set(tenant.id, slugToId);
    console.log(`  ✓ Tenant "${tenant.name}": canonical roles + permissions + menus synced`);
  }

  // ── 4. Reassign users ───────────────────────────────────────────────────────
  const roleById = new Map(rolesBefore.map((r) => [r.id, r]));
  let reassigned = 0, skippedCustom = 0, unchanged = 0;

  for (const u of usersBefore) {
    // Global super admins: ensure they point at the global super_admin role.
    if (u.saasRole === 'SUPER_ADMIN' || (!u.tenantId && roleById.get(u.dynamicRoleId ?? '')?.slug === 'super_admin')) {
      if (u.dynamicRoleId !== superAdmin.id) {
        await prisma.user.update({ where: { id: u.id }, data: { dynamicRoleId: superAdmin.id } });
        reassigned++;
      } else unchanged++;
      continue;
    }

    if (!u.tenantId) { unchanged++; continue; }
    const slugMap = tenantRoleId.get(u.tenantId);
    if (!slugMap) { unchanged++; continue; }

    let targetSlug: RoleSlug | null = null;

    const currentRole = u.dynamicRoleId ? roleById.get(u.dynamicRoleId) : null;
    if (currentRole) {
      if (currentRole.isSystem && SLUG_REMAP[currentRole.slug]) {
        targetSlug = SLUG_REMAP[currentRole.slug];
      } else {
        // Custom (non-system) role — respect tenant customization, leave as-is.
        skippedCustom++;
        continue;
      }
    } else {
      // No dynamic role — fall back to legacy saasRole.
      const legacy = u.saasRole ?? 'NES';
      targetSlug = LEGACY_ROLE_TO_SLUG[legacy] ?? 'cashier';
      // MANAGER HQ promotion: no branch → tenant_admin (HQ proxy), else branch_manager.
      if (legacy === 'MANAGER') targetSlug = u.branchId ? 'branch_manager' : 'tenant_admin';
    }

    const targetId = targetSlug ? slugMap.get(targetSlug) : undefined;
    if (targetId && targetId !== u.dynamicRoleId) {
      await prisma.user.update({ where: { id: u.id }, data: { dynamicRoleId: targetId } });
      console.log(`     • ${u.email}: → ${targetSlug}`);
      reassigned++;
    } else {
      unchanged++;
    }
  }
  console.log(`  ✓ Users: ${reassigned} reassigned, ${unchanged} unchanged, ${skippedCustom} on custom roles (left as-is)`);

  // ── 5. Deactivate obsolete system roles ─────────────────────────────────────
  const deact = await prisma.dynamicRole.updateMany({
    where: { slug: { in: OBSOLETE_SLUGS }, isSystem: true, tenantId: { not: null } },
    data: { isActive: false },
  });
  console.log(`  ✓ Deactivated ${deact.count} obsolete system role(s): ${OBSOLETE_SLUGS.join(', ')}`);

  console.log('\n✅ Role hierarchy migration complete.\n');
}

main().catch((e) => { console.error('❌ Migration failed:', e); process.exit(1); }).finally(() => prisma.$disconnect());
