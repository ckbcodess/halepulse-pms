'use client';

// ─────────────────────────────────────────────────────────────────────────────
// useOffline — connectivity state + automatic sync for the POS.
//
// On mount (online): mirror the catalogue, then drain the outbox.
// On 'online' event: drain the outbox, then re-mirror the catalogue.
// Exposes { online, pending, failed, syncing, refresh } for the UI badge.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  syncCatalogue, syncOutbox, pendingCount, failedCount, clearSyncedSales,
} from './sync';

export interface OfflineState {
  online:  boolean;
  pending: number;   // sales waiting to sync
  failed:  number;   // sales the server rejected on replay
  syncing: boolean;
  refresh: () => Promise<void>;
}

export function useOffline(): OfflineState {
  const [online, setOnline]   = useState(true);
  const [pending, setPending] = useState(0);
  const [failed, setFailed]   = useState(0);
  const [syncing, setSyncing] = useState(false);
  const busy = useRef(false);

  const refreshCounts = useCallback(async () => {
    setPending(await pendingCount());
    setFailed(await failedCount());
  }, []);

  const drainAndMirror = useCallback(async (mirrorFirst: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setSyncing(true);
    try {
      if (mirrorFirst) await syncCatalogue();
      await syncOutbox();
      if (!mirrorFirst) await syncCatalogue();
      await clearSyncedSales();
      await refreshCounts();
    } finally {
      busy.current = false;
      setSyncing(false);
    }
  }, [refreshCounts]);

  useEffect(() => {
    setOnline(navigator.onLine);

    const goOnline  = () => { setOnline(true);  void drainAndMirror(false); };
    const goOffline = () => { setOnline(false); };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Initial pass: freshen the cache and flush anything left from a prior session.
    void (async () => {
      if (navigator.onLine) await drainAndMirror(true);
      await refreshCounts();
    })();

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [drainAndMirror, refreshCounts]);

  return { online, pending, failed, syncing, refresh: refreshCounts };
}
