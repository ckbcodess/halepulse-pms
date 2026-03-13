/**
 * Dynamic Theme Engine
 *
 * Takes a single hex color and generates a full set of shadcn-compatible
 * CSS custom properties in OKLCH. Inspired by Linear's theming approach.
 *
 * Uses `culori` for perceptually uniform color conversions.
 */
import { parse, converter, formatCss } from 'culori';

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const toOklch = converter('oklch');

interface Oklch {
  l: number; // 0-1 lightness
  c: number; // 0-0.4 chroma
  h: number; // 0-360 hue
}

/** Parse any CSS color string → OKLCH triplet. Returns null on failure. */
function parseToOklch(color: string): Oklch | null {
  const parsed = parse(color);
  if (!parsed) return null;
  const oklch = toOklch(parsed);
  return {
    l: oklch.l ?? 0,
    c: oklch.c ?? 0,
    h: oklch.h ?? 0,
  };
}

/** Format OKLCH triplet as a CSS oklch() value string. */
function oklch(l: number, c: number, h: number, alpha?: number): string {
  // Clamp values to valid ranges
  const cl = Math.max(0, Math.min(1, l));
  const cc = Math.max(0, Math.min(0.4, c));
  const ch = ((h % 360) + 360) % 360; // normalise hue
  if (alpha !== undefined && alpha < 1) {
    return `oklch(${n(cl)} ${n(cc)} ${n(ch)} / ${Math.round(alpha * 100)}%)`;
  }
  return `oklch(${n(cl)} ${n(cc)} ${n(ch)})`;
}

/** Round to 3 decimal places for clean CSS output. */
function n(v: number): string {
  return Number(v.toFixed(3)).toString();
}

/** Clamp a number between min and max. */
function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// ---------------------------------------------------------------------------
// Preset palette
// ---------------------------------------------------------------------------

export const PRESET_COLORS = [
  { name: 'Indigo',  hex: '#6366f1' },
  { name: 'Blue',    hex: '#3b82f6' },
  { name: 'Cyan',    hex: '#06b6d4' },
  { name: 'Teal',    hex: '#14b8a6' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Amber',   hex: '#f59e0b' },
  { name: 'Rose',    hex: '#f43f5e' },
  { name: 'Purple',  hex: '#a855f7' },
  { name: 'Fuchsia', hex: '#d946ef' },
  { name: 'Slate',   hex: '#64748b' },
] as const;

// ---------------------------------------------------------------------------
// Theme generator
// ---------------------------------------------------------------------------

export interface ThemePalette {
  light: Record<string, string>;
  dark: Record<string, string>;
}

/**
 * Generate a full shadcn-compatible theme from a single hex color.
 *
 * The returned records contain CSS custom property names (e.g. `--primary`)
 * as keys and `oklch(…)` value strings as values.
 */
export function generateTheme(baseHex: string): ThemePalette {
  const brand = parseToOklch(baseHex);
  if (!brand) {
    // Fallback to indigo if parse fails
    return generateTheme('#6366f1');
  }

  const h = brand.h;
  const c = brand.c;

  // Normalise brand lightness for primary (target 0.55 for good contrast on
  // both white and dark backgrounds)
  const primaryL = clamp(brand.l, 0.48, 0.62);
  const primaryC = Math.max(c, 0.08); // ensure minimum saturation

  // Auto-contrast: primary-foreground
  const primaryFg = primaryL > 0.65 ? oklch(0.15, 0, 0) : oklch(1, 0, 0);

  // Dark-mode primary needs slightly more lightness for legibility
  const darkPrimaryL = clamp(primaryL + 0.08, 0.55, 0.72);

  // Tiny brand tint for neutrals (makes the palette feel cohesive)
  const tintC = Math.min(c * 0.06, 0.012);

  // ------------------------------------------------------------------
  // Chart colors — 5 harmonic hues rotated from brand
  // ------------------------------------------------------------------
  const chartHues = [0, 55, 120, 185, 250].map((offset) => (h + offset) % 360);

  const light: Record<string, string> = {
    '--background':                oklch(1, 0, 0),
    '--foreground':                oklch(0.141, tintC, h),
    '--card':                      oklch(1, 0, 0),
    '--card-foreground':           oklch(0.141, tintC, h),
    '--popover':                   oklch(1, 0, 0),
    '--popover-foreground':        oklch(0.141, tintC, h),
    '--primary':                   oklch(primaryL, primaryC, h),
    '--primary-foreground':        primaryFg,
    '--secondary':                 oklch(0.965, 0.012, h),
    '--secondary-foreground':      oklch(0.205, tintC, h),
    '--muted':                     oklch(0.965, 0.008, h),
    '--muted-foreground':          oklch(0.50, 0.01, h),
    '--accent':                    oklch(0.955, 0.018, h),
    '--accent-foreground':         oklch(0.205, tintC, h),
    '--destructive':               oklch(0.577, 0.245, 27.325),
    // Glass borders — semi-transparent foreground
    '--border':                    oklch(0.141, tintC, h, 0.08),
    '--input':                     oklch(0.141, tintC, h, 0.11),
    '--ring':                      oklch(0.65, primaryC * 0.5, h),
    // Chart
    '--chart-1':                   oklch(0.75, 0.14, chartHues[0]),
    '--chart-2':                   oklch(0.65, 0.18, chartHues[1]),
    '--chart-3':                   oklch(0.55, 0.20, chartHues[2]),
    '--chart-4':                   oklch(0.50, 0.18, chartHues[3]),
    '--chart-5':                   oklch(0.45, 0.15, chartHues[4]),
    // Sidebar
    '--sidebar':                   oklch(0.98, 0.005, h),
    '--sidebar-foreground':        oklch(0.35, 0.012, h),
    '--sidebar-primary':           oklch(0.25, primaryC * 0.3, h),
    '--sidebar-primary-foreground': oklch(0.985, 0, 0),
    '--sidebar-accent':            oklch(0.955, 0.01, h),
    '--sidebar-accent-foreground': oklch(0.25, tintC, h),
    '--sidebar-border':            oklch(0.141, tintC, h, 0.08),
    '--sidebar-ring':              oklch(0.65, primaryC * 0.5, h),
  };

  const dark: Record<string, string> = {
    '--background':                oklch(0.145, tintC, h),
    '--foreground':                oklch(0.985, 0, 0),
    '--card':                      oklch(0.195, tintC * 1.4, h),
    '--card-foreground':           oklch(0.985, 0, 0),
    '--popover':                   oklch(0.195, tintC * 1.4, h),
    '--popover-foreground':        oklch(0.985, 0, 0),
    '--primary':                   oklch(darkPrimaryL, primaryC, h),
    '--primary-foreground':        oklch(1, 0, 0),
    '--secondary':                 oklch(0.265, tintC * 1.4, h),
    '--secondary-foreground':      oklch(0.985, 0, 0),
    '--muted':                     oklch(0.265, tintC * 1.4, h),
    '--muted-foreground':          oklch(0.68, 0.012, h),
    '--accent':                    oklch(0.275, 0.015, h),
    '--accent-foreground':         oklch(0.985, 0, 0),
    '--destructive':               oklch(0.704, 0.191, 22.216),
    // Glass borders — semi-transparent white
    '--border':                    oklch(0.985, 0, 0, 0.10),
    '--input':                     oklch(0.985, 0, 0, 0.14),
    '--ring':                      oklch(0.55, primaryC * 0.4, h),
    // Chart (bump lightness for dark bg)
    '--chart-1':                   oklch(0.80, 0.12, chartHues[0]),
    '--chart-2':                   oklch(0.68, 0.17, chartHues[1]),
    '--chart-3':                   oklch(0.58, 0.19, chartHues[2]),
    '--chart-4':                   oklch(0.52, 0.17, chartHues[3]),
    '--chart-5':                   oklch(0.47, 0.14, chartHues[4]),
    // Sidebar
    '--sidebar':                   oklch(0.175, tintC * 1.4, h),
    '--sidebar-foreground':        oklch(0.785, 0.012, h),
    '--sidebar-primary':           oklch(darkPrimaryL, primaryC, h),
    '--sidebar-primary-foreground': oklch(0.985, 0, 0),
    '--sidebar-accent':            oklch(0.265, 0.012, h),
    '--sidebar-accent-foreground': oklch(0.985, 0, 0),
    '--sidebar-border':            oklch(0.985, 0, 0, 0.10),
    '--sidebar-ring':              oklch(0.55, primaryC * 0.4, h),
  };

  return { light, dark };
}

// ---------------------------------------------------------------------------
// DOM helpers (client-side only)
// ---------------------------------------------------------------------------

/** Apply a palette to :root by setting inline CSS custom properties. */
export function applyTheme(vars: Record<string, string>): void {
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(vars)) {
    root.style.setProperty(prop, value);
  }
}

/** Remove dynamic overrides, reverting to stylesheet defaults. */
export function removeTheme(vars: Record<string, string>): void {
  const root = document.documentElement;
  for (const prop of Object.keys(vars)) {
    root.style.removeProperty(prop);
  }
}

// ---------------------------------------------------------------------------
// Server-side helper — build a CSS string for <style> injection
// ---------------------------------------------------------------------------

/**
 * Generate a complete `<style>` block string for SSR injection.
 * Contains both `:root` (light) and `.dark` overrides.
 */
export function generateThemeCSS(baseHex: string): string {
  const { light, dark } = generateTheme(baseHex);

  const lightVars = Object.entries(light)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');

  const darkVars = Object.entries(dark)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');

  return `:root {\n${lightVars}\n}\n.dark {\n${darkVars}\n}`;
}
