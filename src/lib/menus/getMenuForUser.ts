import prisma from '@/lib/prisma';

export interface MenuItem {
  key:     string;
  label:   string;
  path:    string;
  visible: boolean;
}

// ── Master list — single source of truth for every possible sidebar item ──────
// Add new pages here. defaultRoles sets visibility when no DB config exists yet.
export const MASTER_MENU: (MenuItem & { defaultRoles: string[] })[] = [
  { key: 'dashboard',   label: 'Dashboard',   path: '/',            visible: true, defaultRoles: ['MANAGER','PHARMACIST','MCA','AUDIT'] },
  { key: 'pos',         label: 'POS',         path: '/pos',         visible: true, defaultRoles: ['PHARMACIST','MCA'] }, // MGR via toggle
  { key: 'stock',       label: 'Stock',       path: '/inventory',   visible: true, defaultRoles: ['MANAGER','PHARMACIST'] },
  { key: 'stock-value', label: 'Stock Value', path: '/stock-value', visible: true, defaultRoles: ['MANAGER','PHARMACIST'] },
  { key: 'sales',       label: 'Sales',       path: '/sales',       visible: true, defaultRoles: ['MANAGER','PHARMACIST','MCA','AUDIT'] },
  { key: 'customers',   label: 'Customers',   path: '/customers',   visible: true, defaultRoles: ['MANAGER','PHARMACIST','MCA'] },
  { key: 'purchases',   label: 'Expenses',    path: '/purchases',   visible: true, defaultRoles: ['MANAGER'] },
  { key: 'reports',     label: 'Reports',     path: '/reports',     visible: true, defaultRoles: ['MANAGER','PHARMACIST','AUDIT'] },
  { key: 'team',        label: 'Team',        path: '/team',        visible: true, defaultRoles: ['MANAGER'] },
  { key: 'settings',    label: 'Settings',    path: '/settings',    visible: true, defaultRoles: ['MANAGER'] },
];

/**
 * Merges stored DB items against MASTER_MENU.
 * - Items already in DB → keep stored visibility
 * - Items new to MASTER_MENU not yet in DB → apply role-based default
 * This means adding a new page to MASTER_MENU is all that's needed — no DB migration.
 */
function mergeWithMaster(stored: MenuItem[], role: string): MenuItem[] {
  const storedMap = new Map(stored.map(i => [i.key, i]));
  return MASTER_MENU.map(master => {
    const path = master.key === 'dashboard' ? dashboardPathForRole(role) : master.path;
    if (storedMap.has(master.key)) {
      const s = storedMap.get(master.key)!;
      return { key: master.key, label: master.label, path, visible: s.visible };
    }
    return { key: master.key, label: master.label, path, visible: master.defaultRoles.includes(role) };
  });
}

function dashboardPathForRole(role: string): string {
  if (role === 'MANAGER')    return '/dashboard/manager';
  if (role === 'PHARMACIST') return '/dashboard/pharmacist';
  if (role === 'MCA')        return '/dashboard/mca';
  if (role === 'AUDIT')      return '/dashboard/audit';
  if (role === 'NES')        return '/dashboard/audit'; // legacy alias
  return '/';
}

function defaultsForRole(role: string): MenuItem[] {
  return MASTER_MENU.map(m => ({
    key:     m.key,
    label:   m.label,
    path:    m.key === 'dashboard' ? dashboardPathForRole(role) : m.path,
    visible: m.defaultRoles.includes(role),
  }));
}

/**
 * Returns visible menu items for a user.
 *
 * Resolution order:
 *   1. DynamicMenuConfig (if dynamicRoleId provided)
 *   2. Legacy MenuConfig merged against MASTER_MENU
 *   3. Role defaults from MASTER_MENU (no DB config at all)
 */
export async function getMenuForUser(
  role: string,
  tenantId: string | null,
  dynamicRoleId?: string | null,
): Promise<MenuItem[]> {
  if (!tenantId) return [];

  try {
    // Strategy 1: Dynamic menu config (preferred path)
    if (dynamicRoleId) {
      const dynamicConfig = await prisma.dynamicMenuConfig.findUnique({
        where: { dynamicRoleId_tenantId: { dynamicRoleId, tenantId } },
      });
      if (dynamicConfig) {
        const items: MenuItem[] = JSON.parse(dynamicConfig.menuItems);
        return mergeWithMaster(items, role).filter(i => i.visible);
      }
    }

    // Strategy 2: Legacy MenuConfig — merge so new pages always appear
    const config = await prisma.menuConfig.findUnique({
      where: { tenantId_role: { tenantId, role: role as any } },
    });

    if (!config) return defaultsForRole(role).filter(i => i.visible);

    const stored: MenuItem[] = JSON.parse(config.menuItems);
    return mergeWithMaster(stored, role).filter(i => i.visible);
  } catch (error) {
    // DB unavailable (e.g. Neon cold start) — fall back to role defaults
    console.error('[getMenuForUser] DB unavailable, using role defaults:', (error as Error).message);
    return defaultsForRole(role).filter(i => i.visible);
  }
}

