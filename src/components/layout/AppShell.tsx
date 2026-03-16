'use client';
import { useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import type { Session } from 'next-auth';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';

const NO_SHELL_PREFIXES = ['/login', '/super-admin'];
const COLLAPSE_KEY = 'sidebar-collapsed';

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
  const [collapsed, setCollapsed] = useState(false);

  // Restore collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSE_KEY);
    if (stored === 'true') setCollapsed(true);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);
  const closeSidebar  = useCallback(() => setSidebarOpen(false), []);
  const toggleCollapse = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, String(next));
      return next;
    });
  }, []);

  const hideShell =
    !session ||
    NO_SHELL_PREFIXES.some(prefix => pathname.startsWith(prefix));

  if (hideShell) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface)] dark:bg-background">
      {/* Backdrop overlay — mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-30 lg:hidden animate-in fade-in duration-150"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        user={session.user}
        menuItems={menuItems}
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />

      {/* Main content area — floating card on surface background */}
      <div className="flex-1 flex flex-col p-2.5 overflow-hidden min-w-0">
        <div className="flex-1 flex flex-col bg-white dark:bg-[var(--surface-raised)] rounded-xl border border-border overflow-hidden min-h-0 shadow-[0_0_0_1px_var(--border)]">

          {/* Top header inside the card */}
          <TopHeader
            user={session.user}
            onMenuToggle={toggleSidebar}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
          />

          {/* Scrollable content */}
          <main className="flex-1 overflow-y-auto">
            <div className="px-5 sm:px-8 lg:px-12 pt-8 pb-10">
              {children}
            </div>
          </main>

        </div>
      </div>
    </div>
  );
}
