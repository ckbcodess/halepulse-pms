'use client';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

/**
 * Reads primaryColor from the session (set at login from tenant.primaryColor)
 * and injects it as CSS variables so the entire portal reflects the business brand.
 */
export default function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    const color = session?.user?.primaryColor;
    if (!color) return;

    // Convert hex to RGB for opacity variants
    const hex = color.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    // Compute a foreground colour (white or dark) based on luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const fg = luminance > 0.55 ? '#1a1a1a' : '#ffffff';

    const root = document.documentElement;
    root.style.setProperty('--primary', color);
    root.style.setProperty('--primary-foreground', fg);
    root.style.setProperty('--active-border', color);
    root.style.setProperty('--active-bg', `rgba(${r},${g},${b},0.12)`);
    root.style.setProperty('--sidebar-primary', color);
    root.style.setProperty('--sidebar-primary-foreground', fg);

    return () => {
      // Clean up overrides when session ends
      root.style.removeProperty('--primary');
      root.style.removeProperty('--primary-foreground');
      root.style.removeProperty('--active-border');
      root.style.removeProperty('--active-bg');
      root.style.removeProperty('--sidebar-primary');
      root.style.removeProperty('--sidebar-primary-foreground');
    };
  }, [session?.user?.primaryColor]);

  return <>{children}</>;
}
