'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard, ShoppingCart, Package, Users,
  Settings, LogOut, FileText, Search as SearchIcon,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

const ICON_MAP: Record<string, React.ElementType> = {
  dashboard:  LayoutDashboard,
  pos:        ShoppingCart,
  inventory:  Package,
  customers:  Users,
  reports:    FileText,
  settings:   Settings,
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
}

// Default items shown before MenuConfig loads (or if no config exists)
const DEFAULT_ITEMS: MenuItem[] = [
  { key: 'dashboard', label: 'Dashboard',    path: '/',          visible: true },
  { key: 'pos',       label: 'Point of Sale', path: '/pos',       visible: true },
  { key: 'inventory', label: 'Inventory',    path: '/inventory', visible: true },
  { key: 'customers', label: 'Customers',    path: '/customers', visible: true },
];

export default function Sidebar({ user, menuItems }: SidebarProps) {
  const pathname = usePathname();
  const items    = (menuItems ?? DEFAULT_ITEMS).filter(i => i.visible);

  const roleLabel: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    MANAGER:     'Manager',
    MCA:         'MCA',
    NES:         'NES',
  };

  return (
    <aside className="w-[260px] bg-white dark:bg-[#111113] border-r border-slate-200/60 dark:border-slate-800/50 flex flex-col transition-all duration-300 relative z-20">
      <div className="px-4 py-6">
        {/* Brand */}
        <div className="flex items-center gap-3 p-2 rounded-xl mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--primary-color, #6366f1)' }}
          >
            <span className="text-white font-bold text-lg leading-none">✦</span>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight">PharmNext</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
              {roleLabel[user.role] ?? user.role}
            </p>
          </div>
        </div>

        {/* Search (decorative — can be wired later) */}
        <div className="relative w-full group mb-2">
          <SearchIcon
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 dark:text-slate-500 dark:group-focus-within:text-white transition-colors"
            size={16}
            strokeWidth={2}
          />
          <input
            type="text"
            placeholder="Search"
            className="w-full pl-9 pr-10 py-2 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800/80 rounded-lg text-sm focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-all dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 font-medium"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="px-4 mb-4 flex-1">
        <nav className="space-y-1">
          {items.map((item) => {
            const Icon     = ICON_MAP[item.key] ?? Package;
            const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
            return (
              <Link
                key={item.key}
                href={item.path}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-semibold transition-all duration-200 rounded-lg ${
                  isActive
                    ? 'bg-slate-100 dark:bg-[#1f1f22] text-slate-900 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-50 dark:hover:bg-[#1f1f22]/50 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800/50">
        <div className="px-3 mb-2">
          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{user.email}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors mt-1"
        >
          <LogOut size={18} strokeWidth={2} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
