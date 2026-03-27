'use client';

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
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

// Use useLayoutEffect on the client, useEffect on the server (avoids SSR warnings)
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface DynamicThemeProviderProps {
  children: ReactNode;
  /** Base color injected by the server (from tenant branding). */
  initialBaseColor?: string;
}

const hexRegex = /^#[0-9a-fA-F]{6}$/;
const combinedRegex = /^#[0-9a-fA-F]{6}\|[a-z]+$/;

export function DynamicThemeProvider({
  children,
  initialBaseColor = '#6366f1',
}: DynamicThemeProviderProps) {
  const { resolvedTheme } = useTheme();
  const [baseColor, setBaseColorState] = useState(initialBaseColor);
  const [palette, setPalette] = useState<ThemePalette | null>(null);
  const [isReady, setIsReady] = useState(false);
  const prevVarsRef = useRef<Record<string, string> | null>(null);

  // Sync to the server-authoritative color (from admin-saved cookie via layout).
  // Server ALWAYS wins — this prevents stale localStorage from overriding
  // branding changes made in the admin panel. We also write back to localStorage
  // so future loads start fresh and don't carry a stale override.
  useIsomorphicLayoutEffect(() => {
    setBaseColorState(initialBaseColor);
    try {
      localStorage.setItem(STORAGE_KEY, initialBaseColor);
    } catch {
      // localStorage unavailable (SSR, privacy mode, etc.)
    }
  }, [initialBaseColor]);

  // Generate + apply palette whenever baseColor or theme mode changes.
  // Uses useLayoutEffect to paint variables BEFORE the browser renders,
  // preventing FOUC when localStorage has a different color than SSR.
  useIsomorphicLayoutEffect(() => {
    const theme = generateTheme(baseColor);
    setPalette(theme);

    const mode = resolvedTheme === 'dark' ? 'dark' : 'light';
    const vars = theme[mode];

    // Remove previous overrides first (avoids stale vars if palette shape changes)
    if (prevVarsRef.current) {
      removeTheme(prevVarsRef.current);
    }

    applyTheme(vars);
    prevVarsRef.current = vars;

    // Mark as ready after first paint
    if (!isReady) setIsReady(true);

    // Cleanup on unmount
    return () => {
      removeTheme(vars);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseColor, resolvedTheme]);

  const setBaseColor = useCallback((value: string) => {
    // If it's a simple hex without #, add it. If it's combined, leave it.
    const normalised = (value.startsWith('#') || value.includes('|')) ? value : `#${value}`;
    setBaseColorState(normalised);
    try {
      localStorage.setItem(STORAGE_KEY, normalised);
    } catch {
      // ignore
    }
  }, []);

  return (
    <DynamicThemeContext.Provider value={{ baseColor, setBaseColor, palette }}>
      <div style={isReady ? undefined : { visibility: 'hidden' }}>
        {children}
      </div>
    </DynamicThemeContext.Provider>
  );
}

