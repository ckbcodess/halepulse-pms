'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard, ShoppingCart, Package, Users,
  Settings, LogOut, FileText, UserCog, X, PanelLeftClose,
} from 'lucide-react';

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
  menuItems?: MenuItem[];
  isOpen?:    boolean;
  onClose?:   () => void;
}

const DEFAULT_ITEMS: MenuItem[] = [
  { key: 'dashboard', label: 'Dashboard',     path: '/',          visible: true },
  { key: 'pos',       label: 'Point of Sale',  path: '/pos',       visible: true },
  { key: 'customers', label: 'Customers',      path: '/customers', visible: true },
  { key: 'inventory', label: 'Inventory',      path: '/inventory', visible: true },
];

export default function Sidebar({ user, menuItems, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const items = (menuItems ?? DEFAULT_ITEMS).filter(i => i.visible);

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-40 w-[260px] bg-white dark:bg-[#111113] border-r border-slate-200/60 dark:border-slate-800/50
        flex flex-col transition-transform duration-300 ease-in-out
        lg:relative lg:z-20 lg:w-[250px] lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
    >
      {/* ── Brand header ── */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200/60 dark:border-slate-800/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--primary-color, #6366f1)' }}
          >
            <span className="text-white font-bold text-base leading-none">✦</span>
          </div>
          <span className="text-[15px] font-bold text-slate-900 dark:text-white tracking-tight">
            Haletop Pharmacy
          </span>
        </div>

        {/* Close (mobile) / Collapse hint (desktop) */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors lg:hidden"
          aria-label="Close menu"
        >
          <X size={18} className="text-slate-500 dark:text-slate-400" />
        </button>
        <button
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden lg:flex text-slate-400 dark:text-slate-500"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {items.map((item) => {
            const Icon = ICON_MAP[item.key] ?? Package;
            const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
            return (
              <Link
                key={item.key}
                href={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 text-[14px] font-medium transition-all duration-150 rounded-lg ${
                  isActive
                    ? 'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Footer: sign out + branding ── */}
      <div className="px-3 pb-3">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
        >
          <LogOut size={18} strokeWidth={1.8} />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="px-5 py-4 border-t border-slate-200/60 dark:border-slate-800/50 flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: 'var(--primary-color, #6366f1)' }}
        >
          <span className="text-white text-xs font-bold">✦</span>
        </div>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">HalePulse</span>
      </div>
    </aside>
  );
}
