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
    <div className="flex h-screen overflow-hidden">
      {/* Backdrop overlay — visible on mobile when sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden animate-in fade-in duration-200"
          onClick={closeSidebar}
        />
      )}

      <Sidebar
        user={session.user}
        menuItems={menuItems}
        isOpen={sidebarOpen}
        onClose={closeSidebar}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative bg-white dark:bg-[#0a0a0c]">
        <TopHeader user={session.user} onMenuToggle={toggleSidebar} />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500 ease-out-expo">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
