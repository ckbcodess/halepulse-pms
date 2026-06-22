'use client';
import { useState, useCallback, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu as MenuIcon, Search } from 'lucide-react';
import SuperAdminSidebar from './SuperAdminSidebar';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

export default function SuperAdminShell({
  email,
  children,
}: {
  email?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface)]">
      {/* Backdrop overlay — mobile only */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-30 lg:hidden animate-in fade-in duration-150"
          onClick={close}
        />
      )}

      <SuperAdminSidebar isOpen={open} onClose={close} />

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-14 bg-card border-b border-border flex items-center gap-3 px-4 sm:px-6 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            className="lg:hidden -ml-2"
            aria-label="Open menu"
          >
            <MenuIcon size={18} />
          </Button>
          <p className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest hidden sm:block">
            Super Admin Console
          </p>
          {/* Global Search */}
          <form
            className="flex-1 max-w-sm mx-auto sm:mx-4"
            onSubmit={e => {
              e.preventDefault();
              if (searchQuery.trim()) router.push(`/super-admin/search?q=${encodeURIComponent(searchQuery.trim())}`);
            }}
          >
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search businesses, users, products…"
                className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-input bg-muted/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </form>
          <div className="ml-auto flex items-center gap-2">
            {email && (
              <span className="text-xs text-muted-foreground truncate max-w-[20vw] hidden md:block">{email}</span>
            )}
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8 page-stagger">
          {children}
        </div>
      </main>
    </div>
  );
}
