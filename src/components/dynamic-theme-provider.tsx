'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { generateTheme, applyTheme, removeTheme, type ThemePalette } from '@/lib/theme/theme-utils';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface DynamicThemeContextValue {
  /** Currently active base color hex. */
  baseColor: string;
  /** Update the base color — instantly regenerates and applies the palette. */
  setBaseColor: (hex: string) => void;
  /** The generated palette (useful for previews). */
  palette: ThemePalette | null;
}

const DynamicThemeContext = createContext<DynamicThemeContextValue>({
  baseColor: '#6366f1',
  setBaseColor: () => {},
  palette: null,
});

export function useDynamicTheme() {
  return useContext(DynamicThemeContext);
}

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'theme-base-color';

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface DynamicThemeProviderProps {
  children: ReactNode;
  /** Base color injected by the server (from tenant branding). */
  initialBaseColor?: string;
}

export function DynamicThemeProvider({
  children,
  initialBaseColor = '#6366f1',
}: DynamicThemeProviderProps) {
  const { resolvedTheme } = useTheme();
  const [baseColor, setBaseColorState] = useState(initialBaseColor);
  const [palette, setPalette] = useState<ThemePalette | null>(null);
  const [prevVars, setPrevVars] = useState<Record<string, string> | null>(null);

  // On mount, check localStorage for a persisted color
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && /^#[0-9a-fA-F]{6}$/.test(stored)) {
        setBaseColorState(stored);
      }
    } catch {
      // localStorage unavailable (SSR, privacy mode, etc.)
    }
  }, []);

  // Generate + apply palette whenever baseColor or theme mode changes
  useEffect(() => {
    const theme = generateTheme(baseColor);
    setPalette(theme);

    const mode = resolvedTheme === 'dark' ? 'dark' : 'light';
    const vars = theme[mode];

    // Remove previous overrides first (avoids stale vars if palette shape changes)
    if (prevVars) {
      removeTheme(prevVars);
    }

    applyTheme(vars);
    setPrevVars(vars);

    // Cleanup on unmount
    return () => {
      removeTheme(vars);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseColor, resolvedTheme]);

  const setBaseColor = useCallback((hex: string) => {
    const normalised = hex.startsWith('#') ? hex : `#${hex}`;
    setBaseColorState(normalised);
    try {
      localStorage.setItem(STORAGE_KEY, normalised);
    } catch {
      // ignore
    }
  }, []);

  return (
    <DynamicThemeContext.Provider value={{ baseColor, setBaseColor, palette }}>
      {children}
    </DynamicThemeContext.Provider>
  );
}
