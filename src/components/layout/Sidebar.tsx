'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, Package, Users,
  Settings, X, PanelLeftClose, PanelLeftOpen,
  ClipboardList, Activity, Receipt, Coins, Wallet,
  BarChart3, UserCog,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import BranchSwitcher from './BranchSwitcher';

// Keys must match MASTER_MENU in src/lib/menus/getMenuForUser.ts.
const ICON_MAP: Record<string, React.ElementType> = {
  dashboard:     LayoutDashboard, // overview
  pos:           ShoppingCart,    // point of sale
  stock:         Package,         // inventory / stock
  'stock-value': Coins,           // monetary value of stock
  sales:         Receipt,         // sales transactions
  customers:     Users,           // customer list
  purchases:     Wallet,          // expenses / purchases
  reports:       BarChart3,       // analytics & reports
  team:          UserCog,         // staff management
  settings:      Settings,        // settings
  // legacy keys (older configs)
  inventory:     Package,
  'audit-log':   ClipboardList,
  users:         UserCog,
};

interface MenuItem {
  key:     string;
  label:   string;
  path:    string;
  visible: boolean;
}

interface SidebarProps {
  user: {
    email:    string;
    role:     string;
    tenantId: string | null;
  };
  menuItems?:  MenuItem[];
  isOpen?:     boolean;
  onClose?:    () => void;
  collapsed?:  boolean;
  onToggleCollapse?: () => void;
}

const ROLE_DASHBOARD: Record<string, string> = {
  MANAGER:    '/dashboard/manager',
  PHARMACIST: '/dashboard/pharmacist',
  MCA:        '/dashboard/mca',
  AUDIT:      '/dashboard/audit',
  NES:        '/dashboard/audit',
};

function getDefaultItems(role: string): MenuItem[] {
  const dashPath = ROLE_DASHBOARD[role] ?? '/dashboard/manager';
  return [
    { key: 'dashboard', label: 'Dashboard',     path: dashPath,     visible: true },
    { key: 'pos',       label: 'Point of Sale',  path: '/pos',       visible: true },
    { key: 'customers', label: 'Customers',      path: '/customers', visible: true },
    { key: 'inventory', label: 'Inventory',      path: '/inventory', visible: true },
  ];
}

// Active pill — vertical brand gradient that adopts the selected theme.
// Stops + foreground come from the generated accent tokens (see lib/theme/accent.ts).
const ACTIVE_GRADIENT =
  'bg-[var(--primary)] [background-image:linear-gradient(in_oklch_to_bottom,var(--primary-gradient-from),var(--primary-gradient-to))] text-[var(--sidebar-primary-foreground)] shadow-sm shadow-primary/25';

export default function Sidebar({
  user, menuItems, isOpen = false, onClose,
  collapsed = false, onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const items = (menuItems ?? getDefaultItems(user.role)).filter(i => i.visible);
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);

  useEffect(() => {
    if (!user.tenantId) return;
    fetch('/api/tenant/branding')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setTenantLogoUrl(data?.logoUrl ?? null);
        setTenantName(data?.name ?? null);
      })
      .catch(() => {});
  }, [user.tenantId]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-40
        flex flex-col
        bg-[var(--surface)]
        transition-all duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]
        lg:relative lg:z-20 lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
      style={{ width: collapsed ? 68 : 260 }}
    >
      {/* ── Brand header ── */}
      <div className={`flex items-center h-12 flex-shrink-0 ${collapsed ? 'justify-center px-0' : 'justify-between px-3.5'}`}>
        {collapsed ? (
          <button
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            className="hidden lg:flex w-8 h-8 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
          >
            <PanelLeftOpen size={16} strokeWidth={1.8} />
          </button>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <Activity size={14} strokeWidth={2.25} className="text-foreground flex-shrink-0" />
            <span className="text-[14px] font-semibold text-foreground tracking-[-0.35px] truncate">
              HalePulse
            </span>
          </div>
        )}

        {!collapsed && (
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleCollapse}
              className="hidden lg:flex"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={14} strokeWidth={2} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className="lg:hidden"
              aria-label="Close menu"
            >
              <X size={16} />
            </Button>
          </div>
        )}
      </div>

      {/* ── Branch switcher ── */}
      <div className={`flex-shrink-0 pb-2 pt-0.5 ${collapsed ? 'px-2' : 'px-3.5'}`}>
        <BranchSwitcher
          variant="sidebar"
          tenantName={tenantName}
          tenantLogoUrl={tenantLogoUrl}
          collapsed={collapsed}
        />
      </div>

      {/* ── Navigation ── */}
      <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-2 ${collapsed ? 'px-2' : 'px-2.5'}`}>
        <div className="flex flex-col gap-0.5">
          {items.map((item) => {
            const Icon = ICON_MAP[item.key] ?? Package;
            const isActive =
              pathname === item.path ||
              (item.key === 'dashboard' && pathname.startsWith('/dashboard')) ||
              (item.key === 'inventory' && pathname.startsWith(item.path) && !pathname.startsWith('/inventory/audit-log')) ||
              (item.key !== 'dashboard' && item.key !== 'inventory' && pathname.startsWith(item.path));

            if (collapsed) {
              return (
                <div key={item.key} className="relative group">
                  <Link
                    href={item.path}
                    onClick={onClose}
                    className={`
                      flex items-center justify-center w-full h-9 rounded-xl
                      transition-all duration-150
                      ${isActive
                        ? ACTIVE_GRADIENT
                        : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                      }
                    `}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                  </Link>
                  {/* Tooltip */}
                  <div
                    className="
                      absolute left-full top-1/2 -translate-y-1/2 ml-2
                      px-2.5 py-1.5 rounded-md
                      bg-foreground text-background text-[12px] font-medium
                      opacity-0 pointer-events-none group-hover:opacity-100
                      transition-opacity duration-150 whitespace-nowrap z-50
                      shadow-sm
                    "
                  >
                    {item.label}
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={item.key}
                href={item.path}
                onClick={onClose}
                className={`
                  relative flex items-center gap-2.5 px-2.5 h-9 text-[13px] font-medium
                  rounded-xl transition-all duration-150
                  ${isActive
                    ? ACTIVE_GRADIENT
                    : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                  }
                `}
              >
                <Icon size={18} strokeWidth={isActive ? 2 : 1.8} />
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
