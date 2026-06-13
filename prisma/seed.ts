/**
 * Seed script — creates SaaS infrastructure alongside existing data.
 * Safe to re-run (all upserts). Does NOT touch existing Users/Products/Sales.
 *
 * Phase 1: Adds DynamicRoles, expanded permissions, FeatureFlags,
 *          DynamicRolePermissions, DynamicMenuConfigs, and links users.
 */
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ROLES, PERMISSIONS, permissionsForRole, type RoleSlug } from '../src/lib/auth/roleHierarchy';

const prisma = new PrismaClient();

const DOMAIN_CATEGORY: Record<string, string> = {
  TENANT_MGMT: 'Platform', USER_MGMT: 'User Management', BRANCH_MGMT: 'Branch Management',
  INVENTORY: 'Inventory', POS: 'Sales & Dispensing', PRESCRIPTIONS: 'Prescriptions',
  PATIENTS: 'Patients', SUPPLIERS: 'Suppliers', BILLING: 'Billing', REPORTS: 'Reporting',
  AUDIT_LOG: 'Audit', AI_TOOLS: 'AI Tools', SETTINGS: 'Configuration',
};

async function main() {
  console.log('🌱 Seeding SaaS infrastructure...\n');

  // ── Production credential guard ────────────────────────────────────────────
  // In production, demo users are only seeded when SEED_DEMO_DATA=true.
  // Set SEED_DEMO_DATA=false in Vercel when onboarding real pharmacies.
  const isProduction   = process.env.NODE_ENV === 'production';
  const seedDemoData   = process.env.SEED_DEMO_DATA !== 'false'; // default: true (safe for dev + staging)

  if (isProduction && !seedDemoData) {
    console.log('  ⚠ Production mode with SEED_DEMO_DATA=false — skipping demo tenant and demo users.');
    console.log('    Only permissions and feature flags will be seeded.\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. PERMISSIONS — Legacy flat keys + new dot-notation keys
  // ═══════════════════════════════════════════════════════════════════════════

  const permissions = [
    // Legacy permissions (kept for backward compatibility)
    { key: 'view_inventory',  label: 'View Inventory',   category: 'Inventory' },
    { key: 'edit_inventory',  label: 'Edit Inventory',   category: 'Inventory' },
    { key: 'view_patients',   label: 'View Patients',    category: 'Patients'  },
    { key: 'edit_patients',   label: 'Edit Patients',    category: 'Patients'  },
    { key: 'approve_orders',  label: 'Approve Orders',   category: 'Orders'    },
    { key: 'view_orders',     label: 'View Orders',      category: 'Orders'    },
    { key: 'create_orders',   label: 'Create Orders',    category: 'Orders'    },
    { key: 'view_reports',    label: 'View Reports',     category: 'Reports'   },
    { key: 'manage_users',    label: 'Manage Users',     category: 'Admin'     },
    { key: 'manage_branches', label: 'Manage Branches',  category: 'Admin'     },

    // New dot-notation permissions (Phase 1 — from spec)
    // User Management
    { key: 'user_management.view_users',    label: 'View Users',         category: 'User Management' },
    { key: 'user_management.create_users',  label: 'Create Users',       category: 'User Management' },
    { key: 'user_management.edit_users',    label: 'Edit Users',         category: 'User Management' },
    { key: 'user_management.delete_users',  label: 'Delete Users',       category: 'User Management' },
    { key: 'user_management.assign_roles',  label: 'Assign Roles',       category: 'User Management' },

    // Inventory
    { key: 'inventory.stock.view',     label: 'View Stock',         category: 'Inventory' },
    { key: 'inventory.stock.add',      label: 'Add Stock',          category: 'Inventory' },
    { key: 'inventory.stock.edit',     label: 'Edit Stock',         category: 'Inventory' },
    { key: 'inventory.stock.delete',   label: 'Delete Stock',       category: 'Inventory' },
    { key: 'inventory.stock.transfer', label: 'Transfer Stock',     category: 'Inventory' },
    { key: 'inventory.expiry.view',    label: 'View Expiry',        category: 'Inventory' },
    { key: 'inventory.expiry.manage',  label: 'Manage Expiry',      category: 'Inventory' },

    // Sales & Dispensing
    { key: 'sales.pos.access',      label: 'Access POS',          category: 'Sales & Dispensing' },
    { key: 'sales.create_sale',     label: 'Create Sale',         category: 'Sales & Dispensing' },
    { key: 'sales.void_sale',       label: 'Void Sale',           category: 'Sales & Dispensing' },
    { key: 'sales.apply_discount',  label: 'Apply Discount',      category: 'Sales & Dispensing' },
    { key: 'sales.view_history',    label: 'View Sales History',  category: 'Sales & Dispensing' },
    { key: 'dispensing.dispense',   label: 'Dispense Medicine',   category: 'Sales & Dispensing' },
    { key: 'dispensing.verify',     label: 'Verify Dispensing',   category: 'Sales & Dispensing' },

    // Reporting
    { key: 'reports.view',       label: 'View Reports',       category: 'Reporting' },
    { key: 'reports.export',     label: 'Export Reports',      category: 'Reporting' },
    { key: 'reports.financial',  label: 'Financial Reports',   category: 'Reporting' },
    { key: 'reports.inventory',  label: 'Inventory Reports',   category: 'Reporting' },

    // Configuration
    { key: 'config.business_settings',    label: 'Business Settings',    category: 'Configuration' },
    { key: 'config.branch_management',    label: 'Branch Management',    category: 'Configuration' },
    { key: 'config.role_management',      label: 'Role Management',      category: 'Configuration' },
    { key: 'config.integration_settings', label: 'Integration Settings', category: 'Configuration' },

    // Audit
    { key: 'audit.view_logs',   label: 'View Audit Logs',   category: 'Audit' },
    { key: 'audit.export_logs', label: 'Export Audit Logs',  category: 'Audit' },

    // Feature Access
    { key: 'feature.mca_compliance',     label: 'MCA Compliance',     category: 'Feature Access' },
    { key: 'feature.insurance_billing',  label: 'Insurance Billing',  category: 'Feature Access' },
    { key: 'feature.advanced_analytics', label: 'Advanced Analytics', category: 'Feature Access' },
  ];

  for (const p of permissions) {
    await prisma.permission.upsert({ where: { key: p.key }, update: {}, create: p });
  }
  console.log(`  ✓ ${permissions.length} permissions (legacy + dot-notation)`);

  // Canonical permissions from the blueprint §5.2 matrix (single source of truth)
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { label: p.label, category: DOMAIN_CATEGORY[p.domain] ?? p.domain },
      create: { key: p.key, label: p.label, category: DOMAIN_CATEGORY[p.domain] ?? p.domain },
    });
  }
  console.log(`  ✓ ${PERMISSIONS.length} canonical permissions (blueprint matrix)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. DEMO TENANT — only seeded when demo data is enabled
  // ═══════════════════════════════════════════════════════════════════════════

  if (!seedDemoData) {
    console.log('\n✅ Seed complete (permissions + feature flags only — demo data skipped)\n');
    return;
  }

  const tenant = await prisma.tenant.upsert({
    where:  { subdomain: 'demo' },
    update: {
      businessId:       'DEM000',
      legalName:        'Demo Pharmacy (Pty) Ltd',
      address:          '123 Health Street, Harare, Zimbabwe',
      licenceNumber:    'PHARM-2026-001',
      taxVatNumber:     'VAT-ZW-100001',
      subscriptionTier: 'premium',
      primaryContact:   'Demo Manager',
      primaryPhone:     '+263-771-000-001',
      primaryEmail:     'manager@demo.com',
    },
    create: {
      name:             'Demo Pharmacy',
      subdomain:        'demo',
      primaryColor:     '#6366f1',
      secondaryColor:   '#8b5cf6',
      businessId:       'DEM000',
      legalName:        'Demo Pharmacy (Pty) Ltd',
      address:          '123 Health Street, Harare, Zimbabwe',
      licenceNumber:    'PHARM-2026-001',
      taxVatNumber:     'VAT-ZW-100001',
      subscriptionTier: 'premium',
      primaryContact:   'Demo Manager',
      primaryPhone:     '+263-771-000-001',
      primaryEmail:     'manager@demo.com',
    },
  });
  console.log(`  ✓ Tenant: ${tenant.name} (${tenant.id}) — Business ID: ${tenant.businessId}`);

  // Upsert HQ branch — try old ID first, then new ID
  let hqBranch;
  try {
    hqBranch = await prisma.branch.upsert({
      where:  { businessId: 'DEM000' },
      update: { tenantId: tenant.id, isHeadquarters: true },
      create: {
        name:           'Head Office',
        tenantId:       tenant.id,
        isHeadquarters: true,
        businessId:     'DEM000',
        address:        '123 Health Street, Harare, Zimbabwe',
      },
    });
  } catch {
    // fallback: might have old ID '072101', update it
    hqBranch = await prisma.branch.upsert({
      where:  { businessId: '072101' },
      update: { tenantId: tenant.id, isHeadquarters: true, businessId: 'DEM000' },
      create: {
        name:           'Head Office',
        tenantId:       tenant.id,
        isHeadquarters: true,
        businessId:     'DEM000',
        address:        '123 Health Street, Harare, Zimbabwe',
      },
    });
  }
  console.log(`  ✓ Branch: ${hqBranch.name} (HQ) — Business ID: ${hqBranch.businessId}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. DYNAMIC ROLES — system roles (isSystem: true)
  // ═══════════════════════════════════════════════════════════════════════════

  // System-level Super Admin role (no tenantId — null)
  // Note: Can't use upsert with null in a @@unique compound key, so use findFirst + create
  let superAdminRole = await prisma.dynamicRole.findFirst({
    where: { slug: 'super_admin', tenantId: null },
  });
  if (!superAdminRole) {
    superAdminRole = await prisma.dynamicRole.create({
      data: {
        name:        'Super Admin',
        slug:        'super_admin',
        description: 'System-wide administrator with cross-tenant access',
        level:       0,
        isSystem:    true,
      },
    });
  }
  console.log(`  ✓ DynamicRole: ${superAdminRole.name} (Level 0, system)`);

  // Tenant-level system roles — canonical 5-tier hierarchy (blueprint §4.1)
  const tenantRoleDefs = ROLES.filter((r) => r.slug !== 'super_admin');

  const tenantRoles: Record<string, any> = {};
  for (const def of tenantRoleDefs) {
    const role = await prisma.dynamicRole.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: def.slug } },
      update: {},
      create: {
        tenantId:    tenant.id,
        name:        def.name,
        slug:        def.slug,
        description: def.description,
        level:       def.level,
        isSystem:    true,
      },
    });
    tenantRoles[def.slug] = role;
    console.log(`  ✓ DynamicRole: ${role.name} (Level ${def.level}, tenant)`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. DYNAMIC ROLE PERMISSIONS — map permissions to dynamic roles
  // ═══════════════════════════════════════════════════════════════════════════

  // Grants come straight from the blueprint §5.2 matrix via permissionsForRole().
  const dynamicRolePerms: Record<string, string[]> = Object.fromEntries(
    tenantRoleDefs.map((r) => [r.slug, permissionsForRole(r.slug as RoleSlug)]),
  );

  for (const [roleSlug, permKeys] of Object.entries(dynamicRolePerms)) {
    const role = tenantRoles[roleSlug];
    if (!role) continue;

    for (const permissionKey of permKeys) {
      await prisma.dynamicRolePermission.upsert({
        where: { dynamicRoleId_permissionKey: { dynamicRoleId: role.id, permissionKey } },
        update: {},
        create: {
          dynamicRoleId: role.id,
          permissionKey,
          tenantId:      tenant.id,
        },
      });
    }
  }
  console.log('  ✓ DynamicRolePermissions mapped');

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. DYNAMIC MENU CONFIGS — per dynamic role
  // ═══════════════════════════════════════════════════════════════════════════

  const allMenuItems = [
    { key: 'dashboard',  label: 'Dashboard',      path: '/',           icon: 'LayoutDashboard', visible: true  },
    { key: 'pos',        label: 'Point of Sale',   path: '/pos',        icon: 'ShoppingCart',    visible: true  },
    { key: 'inventory',  label: 'Inventory',       path: '/inventory',  icon: 'Package',         visible: true  },
    { key: 'customers',  label: 'Customers',       path: '/customers',  icon: 'Users',           visible: true  },
    { key: 'reports',    label: 'Reports',         path: '/reports',    icon: 'BarChart3',       visible: false },
    { key: 'users',      label: 'Users',           path: '/users',      icon: 'UserCog',         visible: false },
    { key: 'settings',   label: 'Settings',        path: '/settings',   icon: 'Settings',        visible: true  },
  ];

  const dynamicMenuByRole: Record<string, typeof allMenuItems> = {
    tenant_admin:   allMenuItems.map(i => ({ ...i, visible: true })),
    branch_manager: allMenuItems.map(i => ({ ...i, visible: true })),
    pharmacist:     allMenuItems.map(i => ({
      ...i,
      visible: ['dashboard', 'pos', 'inventory', 'customers', 'reports'].includes(i.key),
    })),
    cashier:        allMenuItems.map(i => ({
      ...i,
      visible: ['dashboard', 'pos', 'customers'].includes(i.key),
    })),
  };

  for (const [roleSlug, items] of Object.entries(dynamicMenuByRole)) {
    const role = tenantRoles[roleSlug];
    if (!role) continue;

    await prisma.dynamicMenuConfig.upsert({
      where: { dynamicRoleId_tenantId: { dynamicRoleId: role.id, tenantId: tenant.id } },
      update: { menuItems: JSON.stringify(items) },
      create: {
        dynamicRoleId: role.id,
        tenantId:      tenant.id,
        menuItems:     JSON.stringify(items),
      },
    });
  }
  console.log('  ✓ DynamicMenuConfigs');

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. FEATURE FLAGS
  // ═══════════════════════════════════════════════════════════════════════════

  const featureFlags = [
    { key: 'module.pos',                label: 'Point of Sale',       description: 'Core POS functionality',                        category: 'module', isGloballyOn: true  },
    { key: 'module.inventory',          label: 'Inventory Management',description: 'Stock tracking and management',                  category: 'module', isGloballyOn: true  },
    { key: 'module.customers',          label: 'Customer Management', description: 'Customer/patient records and loyalty',            category: 'module', isGloballyOn: true  },
    { key: 'module.reports',            label: 'Reports & Analytics', description: 'Business reports and dashboards',                 category: 'module', isGloballyOn: true  },
    { key: 'module.mca_compliance',     label: 'MCA Compliance',      description: 'Controlled substance tracking and MCA reporting', category: 'module', isGloballyOn: false },
    { key: 'module.insurance_billing',  label: 'Insurance Billing',   description: 'Claims processing and third-party billing',       category: 'module', isGloballyOn: false },
    { key: 'module.advanced_analytics', label: 'Advanced Analytics',  description: 'Advanced dashboards, scheduled reports, AI',       category: 'module', isGloballyOn: false },
  ];

  const flagRecords: Record<string, any> = {};
  for (const f of featureFlags) {
    const flag = await prisma.featureFlag.upsert({
      where: { key: f.key },
      update: {},
      create: f,
    });
    flagRecords[f.key] = flag;
  }
  console.log(`  ✓ ${featureFlags.length} feature flags`);

  // Enable non-global features for demo tenant
  const demoEnabledFlags = ['module.mca_compliance']; // Enable MCA for demo
  for (const flagKey of demoEnabledFlags) {
    const flag = flagRecords[flagKey];
    if (!flag) continue;
    await prisma.tenantFeatureFlag.upsert({
      where: { tenantId_featureFlagId: { tenantId: tenant.id, featureFlagId: flag.id } },
      update: { isEnabled: true },
      create: { tenantId: tenant.id, featureFlagId: flag.id, isEnabled: true },
    });
  }
  console.log('  ✓ TenantFeatureFlags for demo');

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. SAAS USERS — with dynamic role linkage
  // ═══════════════════════════════════════════════════════════════════════════

  // In production, SUPER_ADMIN_PASSWORD env var overrides the default.
  // Always set this before going live with real data.
  const superAdminPassword = (isProduction && process.env.SUPER_ADMIN_PASSWORD)
    ? process.env.SUPER_ADMIN_PASSWORD
    : 'Admin@1234'; // Dev/staging default — CHANGE via SUPER_ADMIN_PASSWORD in production

  if (isProduction && !process.env.SUPER_ADMIN_PASSWORD) {
    console.warn('  ⚠ WARNING: SUPER_ADMIN_PASSWORD not set — using default "Admin@1234". Set this env var before going live!');
  }

  const usersToCreate = [
    {
      username:         'superadmin@system.com',
      email:            'superadmin@system.com',
      businessUsername: 'superadmin',
      plainPass:        superAdminPassword,
      saasRole:         Role.SUPER_ADMIN,
      tenantId:         null as string | null,
      dynamicRoleId:    superAdminRole.id,
    },
    {
      username:         'manager@demo.com',
      email:            'manager@demo.com',
      businessUsername: 'manager',
      plainPass:        'Manager@1234',
      saasRole:         Role.MANAGER,
      tenantId:         tenant.id,
      dynamicRoleId:    tenantRoles['tenant_admin'].id, // MANAGER → Tenant Admin (L2)
    },
    {
      username:         'mca@demo.com',
      email:            'mca@demo.com',
      businessUsername: 'pharmacist',
      plainPass:        'Mca@1234',
      saasRole:         Role.MCA,
      tenantId:         tenant.id,
      dynamicRoleId:    tenantRoles['pharmacist'].id, // MCA → Pharmacist (L4)
    },
    {
      username:         'nes@demo.com',
      email:            'nes@demo.com',
      businessUsername: 'viewer',
      plainPass:        'Nes@1234',
      saasRole:         Role.NES,
      tenantId:         tenant.id,
      dynamicRoleId:    tenantRoles['cashier'].id, // NES → Cashier (L5)
    },
  ];

  for (const u of usersToCreate) {
    const passwordHash = await bcrypt.hash(u.plainPass, 12);
    await prisma.user.upsert({
      where:  { email: u.email },
      update: {
        passwordHash,
        saasRole:         u.saasRole,
        isActive:         true,
        dynamicRoleId:    u.dynamicRoleId,
        businessUsername: u.businessUsername,
        ...(u.email === 'manager@demo.com' ? { firstName: 'Demo', lastName: 'Manager' } : {}),
      },
      create: {
        username:         u.username,
        password:         'NEXTAUTH_MANAGED',
        role:             u.saasRole,
        email:            u.email,
        passwordHash,
        saasRole:         u.saasRole,
        tenantId:         u.tenantId ?? undefined,
        isActive:         true,
        dynamicRoleId:    u.dynamicRoleId,
        businessUsername: u.businessUsername,
        ...(u.email === 'manager@demo.com' ? { firstName: 'Demo', lastName: 'Manager' } : {}),
      },
    });
    console.log(`  ✓ User: ${u.email} (${u.saasRole} → ${u.businessUsername})`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. LEGACY ROLE PERMISSIONS — kept for backward compatibility
  // ═══════════════════════════════════════════════════════════════════════════

  const legacyPermKeys = permissions.filter(p => !p.key.includes('.')).map(p => p.key);
  const rolePerms: Record<Role, string[]> = {
    [Role.SUPER_ADMIN]: [],
    [Role.MANAGER]:     legacyPermKeys,
    [Role.MCA]:         ['view_inventory', 'edit_inventory', 'view_orders', 'create_orders'],
    [Role.NES]:         ['view_inventory', 'view_patients', 'view_orders', 'view_reports'],
  };

  for (const [roleStr, permKeys] of Object.entries(rolePerms)) {
    const role = roleStr as Role;
    if (permKeys.length === 0) continue;
    for (const permissionKey of permKeys) {
      await prisma.rolePermission.upsert({
        where:  { tenantId_role_permissionKey: { tenantId: tenant.id, role, permissionKey } },
        update: {},
        create: { tenantId: tenant.id, role, permissionKey },
      });
    }
  }
  console.log('  ✓ Legacy role permissions (backward compat)');

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. LEGACY MENU CONFIGS — kept for backward compatibility
  // ═══════════════════════════════════════════════════════════════════════════

  const legacyMenuItems = [
    { key: 'dashboard',  label: 'Dashboard',      path: '/',           visible: true  },
    { key: 'pos',        label: 'Point of Sale',   path: '/pos',        visible: true  },
    { key: 'inventory',  label: 'Inventory',       path: '/inventory',  visible: true  },
    { key: 'customers',  label: 'Customers',       path: '/customers',  visible: true  },
    { key: 'reports',    label: 'Reports',         path: '/reports',    visible: false },
    { key: 'users',      label: 'Users',           path: '/users',      visible: false },
    { key: 'settings',   label: 'Settings',        path: '/settings',   visible: true  },
  ];

  const menuByRole: Record<string, typeof legacyMenuItems> = {
    [Role.MANAGER]: legacyMenuItems.map(i => ({ ...i, visible: true })),
    [Role.MCA]:     legacyMenuItems.map(i => ({ ...i, visible: ['dashboard','pos','inventory','customers'].includes(i.key) })),
    [Role.NES]:     legacyMenuItems.map(i => ({ ...i, visible: ['dashboard','inventory','reports'].includes(i.key) })),
  };

  for (const [roleStr, items] of Object.entries(menuByRole)) {
    const role = roleStr as Role;
    await prisma.menuConfig.upsert({
      where:  { tenantId_role: { tenantId: tenant.id, role } },
      update: { menuItems: JSON.stringify(items) },
      create: { tenantId: tenant.id, role, menuItems: JSON.stringify(items) },
    });
  }
  console.log('  ✓ Legacy menu configs (backward compat)');

  // ═══════════════════════════════════════════════════════════════════════════
  // DONE
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n✅ Seed complete!\n');
  console.log('Default credentials:');
  console.log('  Business ID: 0721');
  console.log('  ─────────────────────────────────────────────────────────');
  console.log('  superadmin@system.com  /  Admin@1234    (Super Admin)');
  console.log('  manager@demo.com       /  Manager@1234  (Tenant Admin)');
  console.log('  mca@demo.com           /  Mca@1234      (Pharmacist)');
  console.log('  nes@demo.com           /  Nes@1234      (Cashier)');
  console.log('  ─────────────────────────────────────────────────────────');
  console.log('  3-field login: 0721 + businessUsername + password');
}

main().catch(console.error).finally(() => prisma.$disconnect());
