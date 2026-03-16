'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard, ShoppingCart, Package, Users,
  Settings, LogOut, FileText, UserCog, X, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { useEffect, useRef } from 'react';

const ICON_MAP: Record<string, React.ElementType> = {
  dashboard:  LayoutDashboard,
  pos:        ShoppingCart,
  inventory:  Package,
  customers:  Users,
  reports:    FileText,
  settings:   Settings,
  users:      UserCog,
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

const DEFAULT_ITEMS: MenuItem[] = [
  { key: 'dashboard', label: 'Dashboard',     path: '/',          visible: true },
  { key: 'pos',       label: 'Point of Sale',  path: '/pos',       visible: true },
  { key: 'customers', label: 'Customers',      path: '/customers', visible: true },
  { key: 'inventory', label: 'Inventory',      path: '/inventory', visible: true },
];

export default function Sidebar({
  user, menuItems, isOpen = false, onClose,
  collapsed = false, onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const items = (menuItems ?? DEFAULT_ITEMS).filter(i => i.visible);
  const tooltipRef = useRef<HTMLDivElement>(null);

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
        border-r border-border bg-[var(--surface)]
        transition-all duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]
        lg:relative lg:z-20 lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:${sidebarWidth}
      `}
      style={{ width: collapsed ? 68 : 260 }}
    >
      {/* ── Header: Logo + collapse toggle ── */}
      <div className={`flex items-center h-14 flex-shrink-0 border-b border-border ${collapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--primary-color, #6366f1)' }}
            >
              <span className="text-white text-xs font-medium leading-none">H</span>
            </div>
            <span className="text-[13px] font-medium text-foreground/90 tracking-tight truncate">
              HalePulse
            </span>
          </div>
        )}

        {collapsed && (
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--primary-color, #6366f1)' }}
          >
            <span className="text-white text-xs font-medium leading-none">H</span>
          </div>
        )}

        {/* Mobile close */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-md surface-interactive lg:hidden text-muted-foreground"
          aria-label="Close menu"
        >
          <X size={16} />
        </button>

        {/* Desktop collapse toggle */}
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md surface-interactive hidden lg:flex text-muted-foreground"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {/* ── Expand button when collapsed (desktop) ── */}
      {collapsed && (
        <div className="hidden lg:flex justify-center pt-3 pb-1">
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md surface-interactive text-muted-foreground"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen size={16} />
          </button>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-3 ${collapsed ? 'px-2' : 'px-3'}`}>
        <div className="flex flex-col gap-0.5">
          {!collapsed && (
            <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider px-2.5 mb-2">
              Menu
            </span>
          )}
          {items.map((item) => {
            const Icon = ICON_MAP[item.key] ?? Package;
            const isActive =
              pathname === item.path ||
              (item.path !== '/' && pathname.startsWith(item.path));

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
                  relative flex items-center gap-2.5 px-2.5 h-9 text-[13px] font-medium
                  rounded-md transition-all duration-120
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
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Footer: Sign out + branding ── */}
      <div className={`flex-shrink-0 border-t border-border ${collapsed ? 'px-2 py-3' : 'px-3 py-3'}`}>
        {collapsed ? (
          <div className="relative group">
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center justify-center w-full h-9 rounded-md text-muted-foreground surface-interactive hover:text-rose-600 dark:hover:text-rose-400"
            >
              <LogOut size={16} strokeWidth={1.7} />
            </button>
            <div className="
              absolute left-full top-1/2 -translate-y-1/2 ml-2
              px-2.5 py-1.5 rounded-md
              bg-foreground text-background text-[12px] font-medium
              opacity-0 pointer-events-none group-hover:opacity-100
              transition-opacity duration-150 whitespace-nowrap z-50
              shadow-sm
            ">
              Sign Out
            </div>
          </div>
        ) : (
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-2.5 px-2.5 h-9 text-[13px] font-medium text-muted-foreground rounded-md surface-interactive hover:text-rose-600 dark:hover:text-rose-400"
          >
            <LogOut size={16} strokeWidth={1.7} />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </aside>
  );
}
