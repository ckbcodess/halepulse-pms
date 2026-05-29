'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, Package, Users,
  Settings, FileText, UserCog, X, PanelLeftClose, PanelLeftOpen,
  ClipboardList,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

const ICON_MAP: Record<string, React.ElementType> = {
  dashboard:    LayoutDashboard,
  pos:          ShoppingCart,
  inventory:    Package,
  customers:    Users,
  reports:      FileText,
  'audit-log':  ClipboardList,
  settings:     Settings,
  users:        UserCog,
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
  MANAGER: '/dashboard/manager',
  MCA:     '/dashboard/mca',
  NES:     '/dashboard/nes',
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

export default function Sidebar({
  user, menuItems, isOpen = false, onClose,
  collapsed = false, onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const items = (menuItems ?? getDefaultItems(user.role)).filter(i => i.visible);
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
          /* Collapsed: purple "H" box fades out on hover, bare expand icon fades in */
          <button
            onClick={onToggleCollapse}
            className="group/logo relative w-7 h-7 flex items-center justify-center flex-shrink-0 hidden lg:flex"
            aria-label="Expand sidebar"
          >
            {/* Purple container — fades out on hover */}
            <span className="
              absolute inset-0 rounded-md flex items-center justify-center
              transition-opacity duration-150 group-hover/logo:opacity-0
            " style={{ background: 'var(--primary)' }}>
              <span className="text-primary-foreground text-xs font-medium leading-none">H</span>
            </span>
            {/* Bare expand icon — fades in on hover, no container */}
            <PanelLeftOpen
              size={16}
              strokeWidth={1.7}
              className="relative text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/logo:opacity-100"
            />
          </button>
        ) : (
          /* Expanded: static logo on left, separate collapse button on right */
          <>
            <div className="flex items-center gap-3 min-w-0 group/brand cursor-default">
              {/* Static purple logo */}
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20 transition-transform group-hover/brand:scale-110"
                style={{ background: 'var(--primary, #6366f1)' }}
              >
                <span className="text-primary-foreground text-[14px] font-black leading-none">H</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] font-bold text-foreground tracking-tight leading-none">
                  HalePulse
                </span>
                <span className="text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-widest mt-0.5">
                  Pharmacy
                </span>
              </div>
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
      </nav>

    </aside>
  );
}
