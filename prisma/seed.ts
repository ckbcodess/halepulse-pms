/**
 * Seed script — creates SaaS infrastructure alongside existing data.
 * Safe to re-run (all upserts). Does NOT touch existing Users/Products/Sales.
 */
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding SaaS infrastructure...');

  // ── 1. Permissions ─────────────────────────────────────────────────────────
  const permissions = [
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
  ];
  for (const p of permissions) {
    await prisma.permission.upsert({ where: { key: p.key }, update: {}, create: p });
  }
  console.log(`  ✓ ${permissions.length} permissions`);

  // ── 2. Demo Tenant ──────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where:  { subdomain: 'demo' },
    update: {},
    create: {
      name:           'Demo Pharmacy',
      subdomain:      'demo',
      primaryColor:   '#6366f1',
      secondaryColor: '#8b5cf6',
    },
  });
  console.log(`  ✓ Tenant: ${tenant.name} (${tenant.id})`);

  // ── 3. SaaS Users (added alongside existing legacy users) ──────────────────
  const usersToCreate = [
    {
      username:  'superadmin@system.com',
      email:     'superadmin@system.com',
      plainPass: 'Admin@1234',
      saasRole:  Role.SUPER_ADMIN,
      tenantId:  null,
    },
    {
      username:  'manager@demo.com',
      email:     'manager@demo.com',
      plainPass: 'Manager@1234',
      saasRole:  Role.MANAGER,
      tenantId:  tenant.id,
    },
    {
      username:  'mca@demo.com',
      email:     'mca@demo.com',
      plainPass: 'Mca@1234',
      saasRole:  Role.MCA,
      tenantId:  tenant.id,
    },
    {
      username:  'nes@demo.com',
      email:     'nes@demo.com',
      plainPass: 'Nes@1234',
      saasRole:  Role.NES,
      tenantId:  tenant.id,
    },
  ];

  for (const u of usersToCreate) {
    const passwordHash = await bcrypt.hash(u.plainPass, 12);
    await prisma.user.upsert({
      where:  { email: u.email },
      update: { passwordHash, saasRole: u.saasRole, isActive: true },
      create: {
        username:     u.username,
        password:     'NEXTAUTH_MANAGED', // placeholder — auth uses passwordHash
        role:         u.saasRole,         // mirror saasRole into legacy field
        email:        u.email,
        passwordHash,
        saasRole:     u.saasRole,
        tenantId:     u.tenantId ?? undefined,
        isActive:     true,
      },
    });
    console.log(`  ✓ User: ${u.email} (${u.saasRole})`);
  }

  // ── 4. Default Role Permissions for Demo Tenant ────────────────────────────
  const rolePerms: Record<Role, string[]> = {
    [Role.SUPER_ADMIN]: [], // super admin bypasses role permissions
    [Role.MANAGER]:     permissions.map(p => p.key),
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
  console.log('  ✓ Role permissions');

  // ── 5. Default Menu Configs ─────────────────────────────────────────────────
  const allMenuItems = [
    { key: 'dashboard',  label: 'Dashboard',     path: '/',           visible: true  },
    { key: 'pos',        label: 'Point of Sale',  path: '/pos',        visible: true  },
    { key: 'inventory',  label: 'Inventory',      path: '/inventory',  visible: true  },
    { key: 'customers',  label: 'Customers',      path: '/customers',  visible: true  },
    { key: 'reports',    label: 'Reports',        path: '/reports',    visible: false },
    { key: 'users',      label: 'Users',          path: '/users',      visible: false },
    { key: 'settings',   label: 'Settings',       path: '/settings',   visible: true  },
  ];

  const menuByRole: Record<string, typeof allMenuItems> = {
    [Role.MANAGER]: allMenuItems.map(i => ({ ...i, visible: true })),
    [Role.MCA]:     allMenuItems.map(i => ({ ...i, visible: ['dashboard','pos','inventory','customers'].includes(i.key) })),
    [Role.NES]:     allMenuItems.map(i => ({ ...i, visible: ['dashboard','inventory','reports'].includes(i.key) })),
  };

  for (const [roleStr, items] of Object.entries(menuByRole)) {
    const role = roleStr as Role;
    await prisma.menuConfig.upsert({
      where:  { tenantId_role: { tenantId: tenant.id, role } },
      update: { menuItems: JSON.stringify(items) },
      create: { tenantId: tenant.id, role, menuItems: JSON.stringify(items) },
    });
  }
  console.log('  ✓ Menu configs');

  console.log('\n✅ Seed complete!\n');
  console.log('Default credentials:');
  console.log('  superadmin@system.com  /  Admin@1234    (SUPER_ADMIN)');
  console.log('  manager@demo.com       /  Manager@1234  (MANAGER)');
  console.log('  mca@demo.com           /  Mca@1234      (MCA)');
  console.log('  nes@demo.com           /  Nes@1234      (NES)');
}

main().catch(console.error).finally(() => prisma.$disconnect());
