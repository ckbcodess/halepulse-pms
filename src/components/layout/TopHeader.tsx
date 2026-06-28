'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Menu, ChevronDown, Sun, Moon, LogOut, ArrowLeft,
  LayoutDashboard, ShoppingCart, Package, Truck, Users,
  Settings, UserCog, KeyRound, Receipt, Coins, Wallet,
  BarChart3, type LucideIcon,
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
import { Button } from '@/components/ui/button';
import NotificationBell from './NotificationBell';

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

// Icons here MUST match the sidebar ICON_MAP (src/components/layout/Sidebar.tsx)
// so a section shows the same glyph in the nav and the page header.
const ROUTE_META: Record<string, { title: string; icon: LucideIcon }> = {
  '/':                 { title: 'Dashboard',       icon: LayoutDashboard },
  '/pos':              { title: 'Point of Sale',   icon: ShoppingCart },
  '/inventory':           { title: 'Stock',        icon: Package },
  '/inventory/new':       { title: 'Add Product',  icon: Package },
  '/inventory/suppliers': { title: 'Suppliers',    icon: Truck },
  '/stock-value':         { title: 'Stock Value',  icon: Coins },
  '/sales':            { title: 'Sales',           icon: Receipt },
  '/customers':        { title: 'Customers',       icon: Users },
  '/customers/new':    { title: 'Add Customer',    icon: Users },
  '/purchases':        { title: 'Expenses',        icon: Wallet },
  '/reports':          { title: 'Reports',         icon: BarChart3 },
  '/team':             { title: 'Team',            icon: UserCog },
  '/users':            { title: 'Team',            icon: UserCog },
  '/settings':         { title: 'Settings',        icon: Settings },
  '/change-password':  { title: 'Change Password', icon: KeyRound },
};

// Prefix fallbacks for sub-routes (e.g. /inventory/suppliers, /dashboard/manager)
// so deeper pages still resolve to their section instead of defaulting to "Dashboard".
const PREFIX_META: { prefix: string; title: string; icon: LucideIcon }[] = [
  { prefix: '/dashboard',          title: 'Dashboard',     icon: LayoutDashboard },
  { prefix: '/pos',                title: 'Point of Sale', icon: ShoppingCart },
  { prefix: '/inventory/suppliers', title: 'Suppliers',    icon: Truck },
  { prefix: '/inventory',          title: 'Stock',         icon: Package },
  { prefix: '/stock-value', title: 'Stock Value',   icon: Coins },
  { prefix: '/sales',       title: 'Sales',         icon: Receipt },
  { prefix: '/customers',   title: 'Customers',     icon: Users },
  { prefix: '/purchases',   title: 'Expenses',      icon: Wallet },
  { prefix: '/reports',     title: 'Reports',       icon: BarChart3 },
  { prefix: '/team',        title: 'Team',          icon: UserCog },
  { prefix: '/settings',    title: 'Settings',      icon: Settings },
];

function getPageMeta(pathname: string): { title: string; icon: LucideIcon } {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname];
  const match = PREFIX_META.find(
    m => pathname === m.prefix || pathname.startsWith(m.prefix + '/'),
  );
  if (match) return { title: match.title, icon: match.icon };
  return { title: 'Dashboard', icon: LayoutDashboard };
}

// Operational / bulk-task screens show a "Back to {parent}" breadcrumb in the
// header instead of the page title + branch switcher.
const BACK_ROUTES: Record<string, { href: string; label: string; current: string }> = {
  '/inventory/restock':       { href: '/inventory', label: 'Stock', current: 'Restock' },
  '/inventory/stock-take':    { href: '/inventory', label: 'Stock', current: 'Stock Take' },
  '/inventory/transfers':     { href: '/inventory', label: 'Stock', current: 'Stock Transfer' },
  '/pos/eod':                 { href: '/pos',       label: 'POS',   current: 'End of Day' },
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  MANAGER:     'Manager',
  PHARMACIST:  'Pharmacist',
  MCA:         'MCA',
  AUDIT:       'Audit',
  NES:         'Audit',
};

function ThemeToggleButton() {
  const { setTheme, theme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      aria-label="Toggle theme"
    >
      <Sun className="h-3.5 w-3.5 dark:hidden block" />
      <Moon className="h-3.5 w-3.5 hidden dark:block" />
    </Button>
  );
}

export default function TopHeader({ user, onMenuToggle }: TopHeaderProps) {
  const pathname  = usePathname();
  const { title: pageTitle, icon: PageIcon } = getPageMeta(pathname);
  const backRoute = BACK_ROUTES[pathname];
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
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onMenuToggle}
          className="-ml-1 lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu size={18} />
        </Button>

        {backRoute ? (
          <div className="flex items-center gap-2">
            <Link
              href={backRoute.href}
              className="flex items-center gap-3 text-[14px] text-foreground opacity-60 hover:opacity-100 whitespace-nowrap transition-opacity"
            >
              <ArrowLeft size={14} className="flex-shrink-0" />
              Back to {backRoute.label}
            </Link>
            <span className="text-[14px] text-foreground/30 select-none">/</span>
            <span className="text-[14px] text-foreground whitespace-nowrap">{backRoute.current}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <PageIcon size={14} className="text-foreground/60 flex-shrink-0" />
              <h1 className="text-[14px] font-medium text-foreground/60 tracking-[-0.05px] leading-none whitespace-nowrap">
                {pageTitle}
              </h1>
            </div>
          </>
        )}
      </div>

      {/* Right side — Figma node 411:23400 */}
      <div className="flex items-center gap-3 py-1">

        {/* Theme toggle */}
        <ThemeToggleButton />

        {/* Notifications */}
        <NotificationBell />

        {/* User profile dropdown — tinted fill card */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<button className="outline-none" aria-label="User menu" />}
          >
            <div className="flex items-center justify-between gap-2.5 rounded-lg bg-foreground/[0.03] hover-surface p-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-6 items-center justify-center rounded-[10px] [background-image:linear-gradient(to_bottom,color-mix(in_oklch,var(--primary)_14%,transparent),color-mix(in_oklch,var(--primary)_6%,transparent))] flex-shrink-0">
                  <span className="text-[10px] font-semibold text-primary leading-none">
                    {initials}
                  </span>
                </div>
                <div className="hidden sm:flex flex-col items-start min-w-0">
                  <span className="text-[14px] font-medium text-foreground leading-[17.5px] tracking-[-0.35px] truncate">
                    {displayName}
                  </span>
                  <span className="text-[12px] font-medium text-foreground/40 leading-none truncate">
                    {roleLabel}
                  </span>
                </div>
              </div>
              <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" />
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={8}>
            <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive hover:bg-destructive/10 focus:bg-destructive/10 cursor-pointer"
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
