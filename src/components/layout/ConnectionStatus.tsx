'use client';

// Global connectivity indicator for the portal top bar. Shows a calm green
// "Online" pill normally, and an amber "Offline" pill when the device loses the
// network. Connectivity-only (no sync side-effects) — the POS header carries
// the sync/queue detail.

import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/lib/offline/useOffline';
import { cn } from '@/lib/utils';

export default function ConnectionStatus() {
  const online = useOnlineStatus();

  return (
    <span
      role="status"
      aria-live="polite"
      title={
        online
          ? 'Online — changes save to the server'
          : 'Offline — working from this device; changes sync when the connection returns'
      }
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium leading-none select-none',
        online
          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
          : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
      )}
    >
      {online ? (
        <>
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
          </span>
          <span className="hidden sm:inline">Online</span>
        </>
      ) : (
        <>
          <WifiOff size={12} />
          <span className="hidden sm:inline">Offline</span>
        </>
      )}
    </span>
  );
}
