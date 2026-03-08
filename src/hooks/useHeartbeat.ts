'use client';
import { useEffect } from 'react';

const INTERVAL_MS = 60_000; // 1 minute

export function useHeartbeat() {
  useEffect(() => {
    const ping = () => fetch('/api/auth/heartbeat', { method: 'POST' }).catch(() => {});
    ping(); // immediate on mount
    const id = setInterval(ping, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
