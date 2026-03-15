'use client';
import { useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import type { Session } from 'next-auth';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';

// Paths that render without the sidebar shell
const NO_SHELL_PREFIXES = ['/login', '/super-admin'];

interface MenuItem {
  key:     string;
  label:   string;
  path:    string;
  visible: boolean;
}

interface AppShellProps {
  children:  React.ReactNode;
  session:   Session | null;
  menuItems: MenuItem[];
}

export default function AppShell({ children, session, menuItems }: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);
  const closeSidebar  = useCallback(() => setSidebarOpen(false), []);

  const hideShell =
    !session ||
    NO_SHELL_PREFIXES.some(prefix => pathname.startsWith(prefix));

  if (hideShell) {
    return <>{children}</>;
  }

  return (
    // Figma: Body bg-[#f7f7f7] — the ash background that shows around the white card
    <div className="flex h-screen overflow-hidden bg-[#f7f7f7] dark:bg-[#0c0c0e]">

      {/* Backdrop overlay — visible on mobile when sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden animate-in fade-in duration-200"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar sits directly on the ash background — no white bg of its own */}
      <Sidebar
        user={session.user}
        menuItems={menuItems}
        isOpen={sidebarOpen}
        onClose={closeSidebar}
      />

      {/*
        Figma: Main Content — px-[12px] py-[16px]
        This padding exposes the ash background on all sides of the white card,
        making the card appear to "float" above the background.
      */}
      <div className="flex-1 flex flex-col px-3 py-4 overflow-hidden min-w-0">

        {/*
          Figma: Main Content Area — bg-white, border-[0.5px] border-[rgba(0,0,0,0.1)],
          rounded-[12px], overflow-clip, px-[80px]
        */}
        <div className="flex-1 flex flex-col bg-white dark:bg-[#111113] rounded-[12px] border-[0.5px] border-black/10 dark:border-white/[0.07] overflow-hidden min-h-0">

          {/* TopNav is INSIDE the white card — not a separate bar above it */}
          <TopHeader user={session.user} onMenuToggle={toggleSidebar} />

          {/*
            Figma: gap-[64px] between TopNav and Body.
            Achieved via pt-16 (64px) top padding on the scrollable main area.
            Horizontal padding px-20 (80px) matches Figma's px-[80px] on the card.
          */}
          <main className="flex-1 overflow-y-auto">
            <div className="px-4 sm:px-10 lg:px-20 pt-16 pb-12 animate-in fade-in duration-300">
              {children}
            </div>
          </main>

        </div>
      </div>
    </div>
  );
}
