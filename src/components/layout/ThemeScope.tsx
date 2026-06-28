'use client';

import { usePathname } from 'next/navigation';
import { ThemeProvider } from '@/components/theme-provider';

/**
 * Decides which dark/light preference applies on the current surface and keeps
 * the three audiences fully isolated:
 *
 *   • Logged-out pages (login / sp-login) are FORCED to light — they must never
 *     inherit a tenant's dark/light choice.
 *   • The super-admin console keeps its own preference (`theme_admin`).
 *   • Tenant users use the per-tenant key computed on the server (`theme_<id>`).
 *
 * The `key` is critical: `next-themes` only reads its `storageKey` once at mount
 * and writes `.dark` to the shared <html>. Re-keying the provider whenever the
 * identity changes forces a remount so it re-reads the correct preference —
 * otherwise one audience's theme leaks into the others until a hard reload.
 */
const LOGGED_OUT_PREFIXES = ['/login', '/sp-login'];

export default function ThemeScope({
  serverKey,
  children,
}: {
  /** Per-tenant/admin key resolved on the server from the session. */
  serverKey: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  let storageKey = serverKey;
  let forcedTheme: string | undefined;

  if (LOGGED_OUT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    storageKey = 'theme_public';
    forcedTheme = 'light';
  } else if (pathname.startsWith('/super-admin')) {
    storageKey = 'theme_admin';
  }

  return (
    <ThemeProvider
      key={storageKey}
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      storageKey={storageKey}
      forcedTheme={forcedTheme}
    >
      {children}
    </ThemeProvider>
  );
}
