'use client';
import { usePathname } from 'next/navigation';
import { Bell, Menu, ChevronDown, Sun, Moon, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { signOut } from 'next-auth/react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

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
      className="w-7 h-7 flex items-center justify-center rounded-[7px] hover:bg-muted/50 text-muted-foreground transition-all"
      aria-label="Toggle theme"
    >
      <Sun className="h-3.5 w-3.5 dark:hidden block" />
      <Moon className="h-3.5 w-3.5 hidden dark:block" />
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
    <header className="h-[54px] flex items-center justify-between flex-shrink-0 border-b border-border px-5 sm:px-8 lg:px-12">

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

      {/* Right side — matches Figma Control Panel (node 156:67) */}
      <div className="flex items-center gap-2 py-1">

        {/* Notification */}
        <button className="relative w-[31.5px] h-[31.5px] flex items-center justify-center rounded-[12.25px] hover:bg-muted/50 text-muted-foreground transition-all">
          <Bell size={16} strokeWidth={2} />
          <span className="absolute top-[6px] right-[6px] w-[7px] h-[7px] bg-[#ff2056] rounded-full" />
        </button>

        {/* Theme toggle */}
        <ThemeToggleButton />

        {/* Separator */}
        <div className="w-px h-[17.5px] bg-[rgba(8,9,14,0.08)] flex-shrink-0" />

        {/* User profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex items-center gap-[10.5px] rounded-[12.25px] hover:bg-muted/50 px-[7px] py-2 transition-all" />
            }
          >
            <div className="w-7 h-7 rounded-[8.75px] bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20">
              <span className="text-[11px] font-bold text-primary leading-none">
                {initials}
              </span>
            </div>

            <div className="hidden sm:flex flex-col items-start min-w-0">
              <span className="text-[13px] font-medium text-foreground leading-[16.25px] truncate">
                {displayName}
              </span>
              <span className="text-[10px] text-muted-foreground/70 font-medium leading-[12.5px] truncate">
                {roleLabel}
              </span>
            </div>

            <ChevronDown size={14} className="text-muted-foreground hidden sm:block flex-shrink-0" />
          </DropdownMenuTrigger>

          <DropdownMenuPortal>
            <DropdownMenuPositioner align="end" sideOffset={8}>
              <DropdownMenuContent>
                <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-rose-600 hover:bg-rose-50 focus:bg-rose-50 dark:hover:bg-rose-950/40 dark:focus:bg-rose-950/40"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                >
                  <LogOut size={14} />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuPositioner>
          </DropdownMenuPortal>
        </DropdownMenu>

      </div>
    </header>
  );
}
