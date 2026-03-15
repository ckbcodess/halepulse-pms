'use client';
import { usePathname } from 'next/navigation';
import { Bell, Menu, ChevronDown, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';

interface TopHeaderProps {
  user: {
    email:    string;
    role:     string;
    tenantId: string | null;
  };
  onMenuToggle?: () => void;
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
    /*
      Figma: Background — bg-[#fbfbfb] p-[10px] rounded-[8332.5px] (fully round pill)
      Sun icon 20×20 inside
    */
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="w-10 h-10 flex items-center justify-center bg-[#fbfbfb] dark:bg-[#1e1e20] rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
      aria-label="Toggle theme"
    >
      <Sun className="h-5 w-5 text-[#0f172a] dark:hidden block" />
      <Moon className="h-5 w-5 text-slate-300 hidden dark:block" />
    </button>
  );
}

export default function TopHeader({ user, onMenuToggle }: TopHeaderProps) {
  const pathname  = usePathname();
  const pageTitle = getPageTitle(pathname);
  const roleLabel = ROLE_LABEL[user.role] ?? user.role;

  // Derive display name from email: "jane.doe@..." → "Jane Doe"
  const displayName = user.email
    .split('@')[0]
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  // Initials for avatar fallback
  const initials = displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    /*
      Figma: TopNav — h-[64px], sits inside the white card (no bg/border of its own).
      The white card provides the background. A subtle bottom border separates it from content.
    */
    <header className="h-16 flex items-center justify-between flex-shrink-0 border-b border-slate-100 dark:border-white/[0.06] px-4 sm:px-10 lg:px-20">

      {/* Left: hamburger (mobile only) + page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="p-2 -ml-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu size={20} className="text-slate-600 dark:text-slate-300" />
        </button>

        {/*
          Figma: Dashboard Title — text-[16px] font-medium opacity-60
          text-[#0f172a] tracking-[-0.05px]
        */}
        <h1 className="text-[16px] font-medium text-[#0f172a]/60 dark:text-white/50 tracking-[-0.05px] leading-8">
          {pageTitle}
        </h1>
      </div>

      {/* Right: Header Container — gap-[24px] */}
      <div className="flex items-center gap-6">

        {/* Figma: Header Icons — gap-[16px] between the two icon buttons */}
        <div className="flex items-center gap-4">

          {/*
            Figma: Notification Background — bg-[#fbfbfb] p-[10px] rounded-full
            Badge: bg-red, absolute top-right, text "1"
          */}
          <button className="relative w-10 h-10 flex items-center justify-center bg-[#fbfbfb] dark:bg-[#1e1e20] rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex-shrink-0">
            <Bell size={20} className="text-[#0f172a] dark:text-slate-300" />
            {/* Figma: Notifications Container — bg-red, 16.8×16.8, top:-3px left:26px */}
            <span className="absolute -top-0.5 right-0 w-[17px] h-[17px] bg-red-500 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-[#111113]">
              <span className="text-white font-semibold leading-none" style={{ fontSize: '9px' }}>1</span>
            </span>
          </button>

          {/* Figma: Theme toggle — same pill style as notification button */}
          <ThemeToggleButton />
        </div>

        {/* Figma: Line 2 — vertical divider, h≈20px */}
        <div className="w-px h-5 bg-slate-200 dark:bg-white/10 flex-shrink-0" />

        {/*
          Figma: Project Switcher (user profile)
          Avatar: bg-[#dee8ff] size-[40px] rounded-full
          Name: text-[14px] font-semibold text-[#0f172a] tracking-[0.02px] leading-6
          Role: text-[12px] text-[#64748b] leading-4
        */}
        <button className="flex items-center gap-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors px-1 py-1 -mr-1">
          {/* Avatar circle */}
          <div className="w-10 h-10 rounded-full bg-[#dee8ff] dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-[#0f172a]/70 dark:text-primary leading-none">
              {initials}
            </span>
          </div>

          {/* Name + role — hidden on small screens */}
          <div className="hidden sm:flex flex-col items-start">
            <span className="text-[14px] font-semibold text-[#0f172a] dark:text-white tracking-[0.02px] leading-6 whitespace-nowrap">
              {displayName}
            </span>
            <span className="text-[12px] text-[#64748b] dark:text-slate-400 leading-4 whitespace-nowrap">
              {roleLabel}
            </span>
          </div>

          <ChevronDown size={16} className="text-slate-400 hidden sm:block" />
        </button>

      </div>
    </header>
  );
}
