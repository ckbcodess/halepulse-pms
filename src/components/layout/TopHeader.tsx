'use client';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { Bell, Menu, ChevronDown } from 'lucide-react';

interface TopHeaderProps {
  user: {
    email:    string;
    role:     string;
    tenantId: string | null;
  };
  onMenuToggle?: () => void;
}

const ROUTE_TITLES: Record<string, string> = {
  '/':               'Dashboard',
  '/pos':            'Point of Sale',
  '/inventory':      'Inventory',
  '/inventory/new':  'Add Product',
  '/inventory/import': 'Import Products',
  '/customers':      'Customers',
  '/customers/new':  'Add Customer',
  '/reports':        'Reports',
  '/settings':       'Settings',
  '/users':          'Team',
  '/change-password': 'Change Password',
};

function getPageTitle(pathname: string): string {
  // Exact match first
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  // Dashboard role routes
  if (pathname.startsWith('/dashboard/')) return 'Dashboard';
  // Customer detail
  if (pathname.startsWith('/customers/')) return 'Customer Details';
  return 'Dashboard';
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  MANAGER:     'Manager',
  MCA:         'MCA',
  NES:         'NES',
};

export default function TopHeader({ user, onMenuToggle }: TopHeaderProps) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);
  const firstName = user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const roleLabel = ROLE_LABEL[user.role] ?? user.role;

  return (
    <header className="h-16 bg-white dark:bg-[#111113] flex items-center justify-between px-4 sm:px-6 lg:px-8 flex-shrink-0 z-10 transition-colors border-b border-slate-200/60 dark:border-slate-800/50">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuToggle}
          className="p-2 -ml-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu size={20} className="text-slate-600 dark:text-slate-300" />
        </button>

        <h1 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notification bell */}
        <button className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <Bell size={20} className="text-slate-500 dark:text-slate-400" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-[#111113]" />
        </button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Separator */}
        <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* User profile */}
        <button className="hidden sm:flex items-center gap-3 pl-1 pr-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
            {firstName[0]?.toUpperCase() || 'U'}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
              {firstName}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              {roleLabel}
            </p>
          </div>
          <ChevronDown size={14} className="text-slate-400 ml-1" />
        </button>
      </div>
    </header>
  );
}
