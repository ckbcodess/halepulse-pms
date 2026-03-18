'use client';
import { usePathname } from 'next/navigation';
import {
  Bell, Menu, ChevronDown, Sun, Moon, LogOut,
  LayoutDashboard, ShoppingCart, Package, Users,
  FileText, Settings, UserCog, KeyRound, type LucideIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { signOut } from 'next-auth/react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
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

const ROUTE_META: Record<string, { title: string; icon: LucideIcon }> = {
  '/':                 { title: 'Dashboard',       icon: LayoutDashboard },
  '/pos':              { title: 'Point of Sale',   icon: ShoppingCart },
  '/inventory':        { title: 'Inventory',       icon: Package },
  '/inventory/new':    { title: 'Add Product',     icon: Package },
  '/inventory/import': { title: 'Import Products', icon: Package },
  '/customers':        { title: 'Customers',       icon: Users },
  '/customers/new':    { title: 'Add Customer',    icon: Users },
  '/reports':          { title: 'Reports',         icon: FileText },
  '/settings':         { title: 'Settings',        icon: Settings },
  '/users':            { title: 'Team',            icon: UserCog },
  '/change-password':  { title: 'Change Password', icon: KeyRound },
};

function getPageMeta(pathname: string): { title: string; icon: LucideIcon } {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname];
  if (pathname.startsWith('/customers/')) return { title: 'Customer Details', icon: Users };
  return { title: 'Dashboard', icon: LayoutDashboard };
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
  const { title: pageTitle, icon: PageIcon } = getPageMeta(pathname);
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
    <header className="h-[64px] flex items-center justify-between flex-shrink-0 border-b border-border px-6">

      {/* Left: hamburger (mobile) + icon + page title */}
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuToggle}
          className="p-1.5 -ml-1 rounded-md surface-interactive lg:hidden text-muted-foreground"
          aria-label="Toggle menu"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2">
          <PageIcon size={20} className="text-foreground/60 flex-shrink-0" />
          <h1 className="text-[16px] font-medium text-foreground/60 tracking-[-0.05px] leading-none whitespace-nowrap">
            {pageTitle}
          </h1>
        </div>
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

          <DropdownMenuContent align="end" sideOffset={8}>
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
        </DropdownMenu>

      </div>
    </header>
  );
}
