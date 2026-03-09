'use client';
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

  const hideShell =
    !session ||
    NO_SHELL_PREFIXES.some(prefix => pathname.startsWith(prefix));

  if (hideShell) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={session.user} menuItems={menuItems} />
      <main className="flex-1 flex flex-col overflow-hidden relative bg-white dark:bg-[#0a0a0c]">
        <TopHeader user={session.user} />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500 ease-out-expo">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
