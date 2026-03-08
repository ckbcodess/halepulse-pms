import prisma from '@/lib/prisma';

export interface MenuItem {
  key:     string;
  label:   string;
  path:    string;
  visible: boolean;
}

/** Default menu used when no MenuConfig is found in the database. */
const DEFAULT_MENU: MenuItem[] = [
  { key: 'dashboard', label: 'Dashboard',    path: '/',          visible: true  },
  { key: 'pos',       label: 'Point of Sale', path: '/pos',       visible: true  },
  { key: 'inventory', label: 'Inventory',    path: '/inventory', visible: true  },
  { key: 'customers', label: 'Customers',    path: '/customers', visible: true  },
  { key: 'settings',  label: 'Settings',     path: '/settings',  visible: true  },
];

/**
 * Returns the visible menu items for a user's role + tenant combination.
 * Always filters by tenantId to prevent cross-tenant menu leakage.
 */
export async function getMenuForUser(
  role: string,
  tenantId: string | null,
): Promise<MenuItem[]> {
  if (!tenantId) return [];

  const config = await prisma.menuConfig.findUnique({
    where: { tenantId_role: { tenantId, role: role as any } },
  });

  if (!config) return DEFAULT_MENU.filter(i => i.visible);

  const items: MenuItem[] = JSON.parse(config.menuItems);
  return items.filter(i => i.visible);
}
