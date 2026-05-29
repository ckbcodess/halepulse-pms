'use client';
import { useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Menu as MenuIcon } from 'lucide-react';
import SuperAdminSidebar from './SuperAdminSidebar';
import { Button } from '@/components/ui/button';

export default function SuperAdminShell({
  email,
  children,
}: {
  email?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
          <p className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest">
            Super Admin Console
          </p>
          {email && (
            <div className="ml-auto text-xs text-muted-foreground truncate max-w-[45vw]">{email}</div>
          )}
        </header>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
