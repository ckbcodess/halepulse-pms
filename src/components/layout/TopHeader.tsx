'use client';
import { usePathname } from 'next/navigation';
import { Bell, Menu, ChevronDown, Sun, Moon, Search } from 'lucide-react';
import { useTheme } from 'next-themes';

interface TopHeaderProps {
  user: {
    email:    string;
    role:     string;
    tenantId: string | null;
  };
  onMenuToggle?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ROUTE_TITLES: Record<string, string> = {
  '/':                 'Dashboard',
  '/pos':              'Point of Sale',
  '/inventory':        'Inventory',
  '/inventory/new':    'Add Product',
  '/inventory/import': 'Import Products',
  '/customers':        'Customers',
  '/customers/new':    'Add Customer',
  '/reports':          'Reports',
  '/settings':         'Settings',
  '/users':            'Team',
  '/change-password':  'Change Password',
};

function getPageTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  if (pathname.startsWith('/dashboard/')) return 'Dashboard';
  if (pathname.startsWith('/customers/')) return 'Customer Details';
  return 'Dashboard';
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  MANAGER:     'Manager',
  MCA:         'MCA',
  NES:         'NES',
};

function ThemeToggleButton() {
  const { setTheme, theme } = useTheme();
  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="w-8 h-8 flex items-center justify-center rounded-md surface-interactive text-muted-foreground"
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 dark:hidden block" />
      <Moon className="h-4 w-4 hidden dark:block" />
    </button>
  );
}

export default function TopHeader({ user, onMenuToggle }: TopHeaderProps) {
  const pathname  = usePathname();
  const pageTitle = getPageTitle(pathname);
  const roleLabel = ROLE_LABEL[user.role] ?? user.role;

  const displayName = user.email
    .split('@')[0]
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  const initials = displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="h-12 flex items-center justify-between flex-shrink-0 border-b border-border px-5 sm:px-8 lg:px-12">

      {/* Left: hamburger (mobile) + page title */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onMenuToggle}
          className="p-1.5 -ml-1 rounded-md surface-interactive lg:hidden text-muted-foreground"
          aria-label="Toggle menu"
        >
          <Menu size={18} />
        </button>

        <h1 className="text-[13px] font-medium text-muted-foreground tracking-tight leading-none">
          {pageTitle}
        </h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1.5">

        {/* Search hint */}
        <button className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-md border border-border text-muted-foreground surface-interactive mr-1">
          <Search size={14} />
          <span className="text-[12px] font-medium">Search</span>
          <kbd className="hidden lg:inline text-[10px] font-medium bg-[var(--surface)] border border-border rounded px-1.5 py-0.5 ml-2 text-muted-foreground/70">
            /
          </kbd>
        </button>

        {/* Notification */}
        <button className="relative w-8 h-8 flex items-center justify-center rounded-md surface-interactive text-muted-foreground">
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-[var(--surface-raised)]" />
        </button>

        {/* Theme toggle */}
        <ThemeToggleButton />

        {/* Separator */}
        <div className="w-px h-5 bg-border mx-1.5 flex-shrink-0" />

        {/* User profile */}
        <button className="flex items-center gap-2.5 rounded-md surface-interactive px-2 py-1.5 -mr-2">
          <div className="w-7 h-7 rounded-md bg-[var(--active-bg)] flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-medium text-[var(--active-border)] leading-none">
              {initials}
            </span>
          </div>

          <div className="hidden sm:flex flex-col items-start min-w-0">
            <span className="text-[13px] font-medium text-foreground leading-tight truncate">
              {displayName}
            </span>
            <span className="text-[11px] text-muted-foreground leading-tight truncate">
              {roleLabel}
            </span>
          </div>

          <ChevronDown size={14} className="text-muted-foreground hidden sm:block flex-shrink-0" />
        </button>

      </div>
    </header>
  );
}
