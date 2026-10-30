'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Connectivity + POS sync hooks.
//
// We do NOT trust navigator.onLine on its own — it stays `true` when wifi is
// switched off, so the UI (and the POS) would wrongly believe it's online.
// Instead we actively probe /api/ping: if the server answers, we're online;
// if the fetch fails, we're offline. navigator's online/offline events, tab
// focus, and a slow interval all just trigger a re-probe.
//
//   useOnlineStatus() — reachability only; safe to mount on every page.
//   useOffline()      — reachability + POS catalogue/outbox sync on reconnect.
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

const PROBE_URL      = '/api/ping';
const PROBE_TIMEOUT  = 4000;   // ms — treat a slow probe as offline
const PROBE_INTERVAL = 15000;  // ms — background re-check while the tab is open

/** Returns true iff the server actually answered the probe. A unique query
 *  string defeats any HTTP/service-worker cache so this always hits the wire. */
async function probeReachable(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT);
    // Any HTTP response (even an error status) means we reached the server.
    await fetch(`${PROBE_URL}?_=${Date.now()}`, { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

/** Shared reachability tracker. onChange fires only on an actual transition. */
function useReachability(onChange?: (online: boolean) => void): boolean {
  const [online, setOnline] = useState(true);
  const current = useRef(true);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const ok = await probeReachable();
      if (cancelled) return;
      if (ok !== current.current) {
        current.current = ok;
        setOnline(ok);
        cb.current?.(ok);
      }
    };

    void check();

    const onEvt      = () => { void check(); };
    const onVisible  = () => { if (document.visibilityState === 'visible') void check(); };
    window.addEventListener('online', onEvt);
    window.addEventListener('offline', onEvt);
    document.addEventListener('visibilitychange', onVisible);
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void check();
    }, PROBE_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('online', onEvt);
      window.removeEventListener('offline', onEvt);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return online;
}

/** Connectivity only — no sync side-effects. For the global top-bar indicator. */
export function useOnlineStatus(): boolean {
  return useReachability();
}

export function useOffline(): OfflineState {
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

  // When reachability flips back to online, flush the outbox and re-mirror.
  const online = useReachability((isOnline) => {
    if (isOnline) void drainAndMirror(false);
  });

  // Initial pass: freshen the cache and flush anything left from a prior session.
  useEffect(() => {
    void (async () => {
      if (await probeReachable()) await drainAndMirror(true);
      await refreshCounts();
    })();
  }, [drainAndMirror, refreshCounts]);

  return { online, pending, failed, syncing, refresh: refreshCounts };
}
