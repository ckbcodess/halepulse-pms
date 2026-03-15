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
    /*
      Figma: Sidebar sits directly on the #f7f7f7 background — no background color of its own.
      Width: 284px. Uses full height with py-4 vertical padding.
    */
    <aside
      className={`
        fixed inset-y-0 left-0 z-40 w-[284px]
        flex flex-col py-4
        transition-transform duration-300 ease-in-out
        lg:relative lg:z-20 lg:w-[284px] lg:translate-x-0
        ${isOpen ? 'translate-x-0 bg-[#f7f7f7] dark:bg-[#0c0c0e]' : '-translate-x-full'}
      `}
    >
      {/*
        Figma: Company Name section — px-[16px], logo 32×32 rounded-[4px],
        name: text-[15px] font-semibold text-[#0f172a] tracking-[0.02px]
      */}
      <div className="flex items-center justify-between px-4 mb-8 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Figma: 32×32 rounded-[4px] logo */}
          <div
            className="w-8 h-8 rounded-[4px] flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--primary-color, #6366f1)' }}
          >
            <span className="text-white font-bold text-sm leading-none">✦</span>
          </div>
          {/* Figma: Project Name — text-[15px] font-semibold text-[#0f172a] tracking-[0.02px] */}
          <span className="text-[15px] font-semibold text-[#0f172a] dark:text-white tracking-[0.02px] leading-none">
            Haletop Pharmacy
          </span>
        </div>

        {/* Close on mobile / collapse hint on desktop */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors lg:hidden"
          aria-label="Close menu"
        >
          <X size={18} className="text-slate-500 dark:text-slate-400" />
        </button>
        <button
          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors hidden lg:flex text-slate-400"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      {/*
        Figma: Navigation Links — px-[16px], gap-[8px] between items
        Active: bg-[#efdefa] rounded-[8px] px-[12px] py-[8px]
        Active text: text-[#0f172a]/60 font-medium
        Inactive text: text-[#64748b] font-medium
      */}
      <nav className="flex-1 overflow-y-auto px-4">
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const Icon = ICON_MAP[item.key] ?? Package;
            const isActive =
              pathname === item.path ||
              (item.path !== '/' && pathname.startsWith(item.path));

            return (
              <Link
                key={item.key}
                href={item.path}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2 text-[14px] font-medium
                  rounded-[8px] transition-all duration-150
                  ${isActive
                    ? 'bg-[#efdefa] text-[#0f172a]/60 dark:bg-primary/20 dark:text-primary'
                    : 'text-[#64748b] dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#0f172a] dark:hover:text-slate-200'
                  }
                `}
              >
                <Icon size={20} strokeWidth={1.8} />
                <span className="leading-5">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/*
        Figma: Footer Container — px-[16px]
        Sign out (not in Figma design but kept for functionality)
        HalePulse branding: 32×32 icon + "HalePulse" text-[15px] font-semibold
      */}
      <div className="flex-shrink-0 px-4 pt-4">
        {/* Sign out — subtle, not in Figma but needed for functionality */}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-[#64748b] dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-[8px] transition-colors mb-3"
        >
          <LogOut size={18} strokeWidth={1.8} />
          <span>Sign Out</span>
        </button>

        {/* Figma: HalePulse footer — icon 32×32 + "HalePulse" text */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div
            className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--primary-color, #6366f1)' }}
          >
            <span className="text-white text-xs font-bold leading-none">✦</span>
          </div>
          <span className="text-[15px] font-semibold text-[#0f172a] dark:text-white tracking-[0.02px] leading-none">
            HalePulse
          </span>
        </div>
      </div>
    </aside>
  );
}
