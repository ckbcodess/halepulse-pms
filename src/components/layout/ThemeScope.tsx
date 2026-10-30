'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { ThemeProvider } from '@/components/theme-provider';

const LOGGED_OUT_PREFIXES = ['/login', '/sp-login'];

function ThemeSync({ storageKey, forcedTheme }: { storageKey: string; forcedTheme?: string }) {
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    if (forcedTheme) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && saved !== theme) {
        setTheme(saved);
      }
    } catch {}
  }, [storageKey, forcedTheme, setTheme, theme]);

  return null;
}

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
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      storageKey={storageKey}
      forcedTheme={forcedTheme}
    >
      <ThemeSync storageKey={storageKey} forcedTheme={forcedTheme} />
      {children}
    </ThemeProvider>
  );
}
