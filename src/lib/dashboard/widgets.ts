import prisma from '@/lib/prisma';
import type { Role } from '@prisma/client';

/**
 * Canonical catalogue of dashboard widgets that a Super Admin can show/hide
 * per role. `sensitive: true` marks financial widgets typically hidden from
 * non-management roles (used only to pre-tick defaults in the UI).
 */
export const DASHBOARD_WIDGETS: { key: string; label: string; sensitive?: boolean }[] = [
  { key: 'kpi_total_inventory',  label: 'Total Inventory (KPI)' },
  { key: 'kpi_low_stock',        label: 'Low Stock Alerts (KPI)' },
  { key: 'kpi_expiring',         label: 'Expiring Soon (KPI)' },
  { key: 'kpi_sales_today',      label: 'Sales Today (KPI)', sensitive: true },
  { key: 'monthly_revenue',      label: 'Monthly Revenue chart', sensitive: true },
  { key: 'todays_report',        label: "Today's Report (payment breakdown)", sensitive: true },
  { key: 'recent_transactions',  label: 'Recent Transactions' },
  { key: 'inventory_alerts',     label: 'Inventory Alerts' },
];

export const DASHBOARD_WIDGET_KEYS = DASHBOARD_WIDGETS.map((w) => w.key);

/**
 * Returns the set of widget keys that should be HIDDEN for a given tenant+role.
 * Default is visible — only keys explicitly stored with visible=false are hidden.
 * Never throws (returns empty set on any error) so the dashboard always renders.
 */
export async function getHiddenWidgets(tenantId: string | null | undefined, role: string): Promise<Set<string>> {
  if (!tenantId) return new Set();
  try {
    const rows = await prisma.dashboardVisibility.findMany({
      where: { tenantId, role: role as Role, visible: false },
      select: { widgetKey: true },
    });
    return new Set(rows.map((r) => r.widgetKey));
  } catch {
    return new Set();
  }
}
