'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, Package, PackagePlus, Users,
  Settings, FileText, UserCog, X, PanelLeftClose, PanelLeftOpen,
  ClipboardList, Truck, ArrowLeftRight, Activity,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import BranchSwitcher from './BranchSwitcher';

const ICON_MAP: Record<string, React.ElementType> = {
  dashboard:    LayoutDashboard,
  pos:          ShoppingCart,
  // 'stock' is the master-menu key for the inventory landing page.
  stock:        Package,
  restock:      PackagePlus,
  suppliers:    Truck,
  transfers:    ArrowLeftRight,
  customers:    Users,
  reports:      FileText,
  settings:     Settings,
  // ── Legacy keys (kept for backward compatibility) ──
  inventory:    Package,
  'audit-log':  ClipboardList,
  users:        UserCog,
};

interface MenuItem {
  key:     string;
  label:   string;
  path:    string;
  visible: boolean;
  // Optional section header bucket. Items without a group still render.
  group?:  string;
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

/**
 * Active-state resolver.
 *
 * Rules:
 *  - Dashboard matches any `/dashboard/*` route.
 *  - Otherwise, the item whose path is the *longest* prefix of the current
 *    pathname wins. This keeps the parent "Stock" (/inventory) from lighting up
 *    on /inventory/suppliers, /inventory/transfers, /inventory/import, etc.,
 *    while each sub-item highlights correctly on its own subtree.
 *  - The /inventory/audit-log subtree is intentionally NOT owned by Stock
 *    (it has no nav entry), so Stock stays inactive there.
 */
function isItemActive(item: MenuItem, pathname: string, allItems: MenuItem[]): boolean {
  if (item.key === 'dashboard') {
    return pathname === item.path || pathname.startsWith('/dashboard');
  }
  if (pathname === item.path) return true;

  // Treat as a subtree match only on a path-segment boundary.
  const isPrefix = (p: string) => pathname === p || pathname.startsWith(p.endsWith('/') ? p : `${p}/`);
  if (!isPrefix(item.path)) return false;

  // Longest matching prefix among all rendered items wins.
  const longestMatch = allItems.reduce((best, candidate) => {
    if (candidate.key === 'dashboard') return best;
    return isPrefix(candidate.path) && candidate.path.length > best.length
      ? candidate.path
      : best;
  }, '');

  return item.path === longestMatch;
}

interface MenuGroup {
  name: string | null;
  items: MenuItem[];
}

/** Buckets items into ordered groups, preserving first-seen order. */
function groupItems(items: MenuItem[]): MenuGroup[] {
  const order: (string | null)[] = [];
  const map = new Map<string | null, MenuItem[]>();
  for (const item of items) {
    const key = item.group ?? null;
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key)!.push(item);
  }
  return order.map((name) => ({ name, items: map.get(name)! }));
}

function getDefaultItems(role: string): MenuItem[] {
  const dashPath = ROLE_DASHBOARD[role] ?? '/dashboard/manager';
  return [
    { key: 'dashboard', label: 'Dashboard',     path: dashPath,     visible: true, group: 'OPERATE' },
    { key: 'pos',       label: 'Point of Sale',  path: '/pos',       visible: true, group: 'OPERATE' },
    { key: 'customers', label: 'Customers',      path: '/customers', visible: true, group: 'OPERATE' },
    { key: 'stock',     label: 'Stock',          path: '/inventory', visible: true, group: 'INVENTORY' },
  ];
}

export default function Sidebar({
  user, menuItems, isOpen = false, onClose,
  collapsed = false, onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const items = (menuItems ?? getDefaultItems(user.role)).filter(i => i.visible);
  const groups = groupItems(items);
  const tooltipRef = useRef<HTMLDivElement>(null);
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

  const sidebarWidth = collapsed ? 'w-[68px]' : 'w-[260px]';

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-40
        flex flex-col
        bg-[var(--surface)]
        transition-all duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]
        lg:relative lg:z-20 lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:${sidebarWidth}
      `}
      style={{ width: collapsed ? 68 : 260 }}
    >
      {/* ── Header ── */}
      <div className={`flex items-center h-14 flex-shrink-0 border-b border-border ${collapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>

        {collapsed ? (
          /* Collapsed: HalePulse mark fades out on hover, bare expand icon fades in */
          <button
            onClick={onToggleCollapse}
            className="group/logo relative w-7 h-7 flex items-center justify-center flex-shrink-0 hidden lg:flex"
            aria-label="Expand sidebar"
          >
            {/* HalePulse brand mark — bare pulse glyph, fades out on hover */}
            <span className="
              absolute inset-0 flex items-center justify-center
              transition-opacity duration-150 group-hover/logo:opacity-0
            ">
              <Activity size={16} strokeWidth={2.25} className="text-foreground" />
            </span>
            {/* Bare expand icon — fades in on hover, no container */}
            <PanelLeftOpen
              size={16}
              strokeWidth={1.7}
              className="relative text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/logo:opacity-100"
            />
          </button>
        ) : (
          /* Expanded: HalePulse brand on left, separate collapse button on right */
          <>
            <div className="flex items-center gap-2 min-w-0 group/brand cursor-default">
              {/* HalePulse brand mark — bare pulse glyph, no container */}
              <Activity size={18} strokeWidth={2.25} className="text-foreground flex-shrink-0" />
              <span className="text-[14px] font-bold text-foreground tracking-tight leading-tight truncate">
                HalePulse
              </span>
            </div>

            {/* Collapse button — far right, desktop only */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleCollapse}
              className="hidden lg:flex"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={16} strokeWidth={2} />
            </Button>
          </>
        )}

        {/* Mobile close */}
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

      {/* ── Branch switcher ── */}
      <div className={`flex-shrink-0 pb-2 pt-2 ${collapsed ? 'px-2' : 'px-3'}`}>
        <BranchSwitcher
          variant="sidebar"
          tenantName={tenantName}
          tenantLogoUrl={tenantLogoUrl}
          collapsed={collapsed}
        />
      </div>

      {/* ── Navigation ── */}
      <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-3 ${collapsed ? 'px-2' : 'px-3'}`}>
        <div className="flex flex-col gap-0.5">
          {groups.map((grp, gi) => (
            <div key={grp.name ?? `__nogroup-${gi}`} className="flex flex-col gap-0.5">
              {/* Group header (expanded) or thin divider (collapsed). The very
                  first group needs no leading divider/spacing. */}
              {collapsed ? (
                gi > 0 && <div className="my-2 mx-2 h-px bg-border" aria-hidden />
              ) : (
                grp.name && (
                  <span className={`text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider px-2.5 mb-2 ${gi > 0 ? 'mt-3' : ''}`}>
                    {grp.name}
                  </span>
                )
              )}

              {grp.items.map((item) => {
                const Icon = ICON_MAP[item.key] ?? Package;
                const isActive = isItemActive(item, pathname, items);

                if (collapsed) {
                  return (
                    <div key={item.key} className="relative group">
                      <Link
                        href={item.path}
                        onClick={onClose}
                        className={`
                          flex items-center justify-center w-full h-9 rounded-md
                          transition-all duration-120
                          ${isActive
                            ? 'bg-[var(--active-bg)] text-[var(--active-border)]'
                            : 'text-muted-foreground surface-interactive hover:text-foreground'
                          }
                        `}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-[var(--active-border)]" />
                        )}
                        <Icon size={18} strokeWidth={1.7} />
                      </Link>
                      {/* Tooltip */}
                      <div
                        ref={tooltipRef}
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
                        relative flex items-center gap-3 px-3 h-10 text-[13px] font-semibold
                        rounded-xl transition-all duration-200
                        ${isActive
                          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        }
                      `}
                    >
                      <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                      <span className="leading-none">{item.label}</span>
                    </Link>
                );
              })}
            </div>
          ))}
        </div>
      </nav>

    </aside>
  );
}
