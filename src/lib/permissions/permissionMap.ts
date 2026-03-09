/**
 * Bidirectional mapping between legacy flat permission keys and
 * new dot-notation permission keys.
 *
 * This bridge allows the system to look up permissions using either format,
 * enabling a smooth transition from the old flat keys (e.g., "view_inventory")
 * to the new dot-notation keys (e.g., "inventory.stock.view").
 *
 * If a key has no mapping, it is returned as-is (pass-through).
 */

/** Legacy flat key → new dot-notation key */
const LEGACY_TO_NEW: Record<string, string> = {
  view_inventory:      'inventory.stock.view',
  edit_inventory:      'inventory.stock.edit',
  manage_customers:    'customers.manage',
  view_reports:        'reports.view',
  manage_settings:     'settings.manage',
  manage_users:        'admin.users.manage',
  view_dashboard:      'dashboard.view',
  process_sales:       'pos.process_sale',
  manage_categories:   'inventory.categories.manage',
  view_audit_log:      'admin.audit.view',
};

/** New dot-notation key → legacy flat key */
const NEW_TO_LEGACY: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_TO_NEW).map(([legacy, dotNotation]) => [dotNotation, legacy]),
);

/**
 * Given a permission key (either format), returns the dot-notation equivalent.
 * Returns the key unchanged if no mapping exists.
 */
export function toNewKey(key: string): string {
  return LEGACY_TO_NEW[key] ?? key;
}

/**
 * Given a permission key (either format), returns the legacy flat equivalent.
 * Returns the key unchanged if no mapping exists.
 */
export function toLegacyKey(key: string): string {
  return NEW_TO_LEGACY[key] ?? key;
}

/**
 * Returns both possible key variants for a given permission key.
 * Useful for checking if either the legacy or new key exists.
 */
export function getBothKeys(key: string): string[] {
  const keys = new Set<string>();
  keys.add(key);
  if (LEGACY_TO_NEW[key]) keys.add(LEGACY_TO_NEW[key]);
  if (NEW_TO_LEGACY[key]) keys.add(NEW_TO_LEGACY[key]);
  return [...keys];
}
