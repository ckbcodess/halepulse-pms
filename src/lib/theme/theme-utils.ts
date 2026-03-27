/**
 * Dynamic Theme Engine
 *
 * Takes a single hex color and generates a full set of shadcn-compatible
 * CSS custom properties in OKLCH.
 *
 * For known preset colors, uses exact Tailwind v4 reference scale values.
 * For arbitrary hex colors, falls back to perceptual math via `culori`.
 */
import { parse, converter } from 'culori';
import { COLOR_SCALES, isNeutralScale, type ColorScale, type NeutralScaleName } from './color-scales';

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
function oklchStr(l: number, c: number, h: number, alpha?: number): string {
  const cl = Math.max(0, Math.min(1, l));
  const cc = Math.max(0, Math.min(0.4, c));
  const ch = ((h % 360) + 360) % 360;
  if (alpha !== undefined && alpha < 1) {
    return `oklch(${n(cl)} ${n(cc)} ${n(ch)} / ${Math.round(alpha * 100)}%)`;
  }
  return `oklch(${n(cl)} ${n(cc)} ${n(ch)})`;
}

/**
 * Add alpha transparency to an existing oklch() CSS value string.
 * e.g. "oklch(0.674 0.178 162)" → "oklch(0.674 0.178 162 / 10%)"
 */
function withAlpha(oklchValue: string, alpha: number): string {
  const pct = Math.round(alpha * 100);
  return oklchValue.replace(/\)$/, ` / ${pct}%)`);
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
  { name: 'Zinc', hex: '#09090b', scale: 'zinc' },
  { name: 'Slate', hex: '#020617', scale: 'slate' },
  { name: 'Stone', hex: '#1c1917', scale: 'stone' },
  { name: 'Gray', hex: '#111827', scale: 'gray' },
  { name: 'Neutral', hex: '#0a0a0a', scale: 'neutral' },
  { name: 'Red', hex: '#ef4444', scale: 'red' },
  { name: 'Rose', hex: '#f43f5e', scale: 'rose' },
  { name: 'Orange', hex: '#f97316', scale: 'orange' },
  { name: 'Amber', hex: '#f59e0b', scale: 'amber' },
  { name: 'Yellow', hex: '#f8c600', scale: 'yellow' },
  { name: 'Green', hex: '#22c55e', scale: 'green' },
  { name: 'Emerald', hex: '#10b981', scale: 'emerald' },
  { name: 'Cyan', hex: '#06b6d4', scale: 'cyan' },
  { name: 'Sky', hex: '#0ea5e9', scale: 'sky' },
  { name: 'Blue', hex: '#3b82f6', scale: 'blue' },
  { name: 'Indigo', hex: '#6366f1', scale: 'indigo' },
  { name: 'Violet', hex: '#8b5cf6', scale: 'violet' },
  { name: 'Purple', hex: '#a855f7', scale: 'purple' },
  { name: 'Fuchsia', hex: '#d946ef', scale: 'fuchsia' },
  { name: 'Pink', hex: '#ec4899', scale: 'pink' },
] as const;

// ---------------------------------------------------------------------------
// Neutral palettes — now backed by full scales
// ---------------------------------------------------------------------------

export const NEUTRAL_PALETTES = [
  'zinc', 'slate', 'stone', 'gray', 'neutral',
  'mauve', 'olive', 'mist', 'taupe',
] as const;

export type NeutralType = (typeof NEUTRAL_PALETTES)[number];

// ---------------------------------------------------------------------------
// Theme generator
// ---------------------------------------------------------------------------

export interface ThemePalette {
  light: Record<string, string>;
  dark: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parses a combined theme string like "#6366f1|stone" into hex and neutral values.
 * Falls back to stone if no neutral is specified.
 */
export function unpackTheme(combined: string): { hex: string; neutral: NeutralType } {
  const [hex, neutral] = combined.split('|');
  const validNeutral = (neutral && (NEUTRAL_PALETTES as readonly string[]).includes(neutral))
    ? (neutral as NeutralType)
    : 'stone';
  return { hex: hex || '#6366f1', neutral: validNeutral };
}

/**
 * Combines hex and neutral into a single storage string.
 */
export function packTheme(hex: string, neutral: NeutralType): string {
  return `${hex}|${neutral}`;
}

// ---------------------------------------------------------------------------
// Scale-based theme generation (exact values)
// ---------------------------------------------------------------------------

/** Find the scale name that matches a given hex color. */
function findScaleForHex(hex: string): string | null {
  const lower = hex.toLowerCase();
  const preset = PRESET_COLORS.find(p => p.hex.toLowerCase() === lower);
  return preset ? preset.scale : null;
}

/**
 * Bright/warm accents need dark text on their primary button
 * because their mid-range shades (500-600) are still very light.
 * shadcn handles this by using shade 500 + dark foreground (950).
 */
const BRIGHT_ACCENTS = new Set(['yellow', 'amber', 'lime']);

/**
 * Generate theme from exact scale values.
 * Uses specific shade positions following shadcn conventions.
 */
function generateFromScales(
  accent: ColorScale,
  neutral: ColorScale,
  accentIsNeutral: boolean,
  accentName?: string,
): ThemePalette {
  const isBright = accentName ? BRIGHT_ACCENTS.has(accentName) : false;
  const light: Record<string, string> = {
    // Backgrounds
    '--background': 'oklch(1 0 0)',
    '--foreground': neutral[950],
    '--card': 'oklch(1 0 0)',
    '--card-foreground': neutral[950],
    '--popover': 'oklch(1 0 0)',
    '--popover-foreground': neutral[950],

    // Primary — neutral: 900/white, bright: 500/950, standard: 600/50
    '--primary': accentIsNeutral ? accent[900] : (isBright ? accent[500] : accent[600]),
    '--primary-foreground': accentIsNeutral ? 'oklch(1 0 0)' : (isBright ? accent[950] : accent[50]),

    // Secondary & Accent (neutral-based)
    '--secondary': neutral[100],
    '--secondary-foreground': neutral[900],
    '--muted': neutral[100],
    '--muted-foreground': neutral[500],
    '--accent': neutral[100],
    '--accent-foreground': neutral[900],

    // Destructive
    '--destructive': COLOR_SCALES.red[600],
    '--destructive-foreground': 'oklch(1 0 0)',

    // Borders & Input
    '--border': neutral[200],
    '--input': neutral[200],
    '--ring': accentIsNeutral ? accent[950] : accent[500],

    // Charts (accent gradient across shades)
    '--chart-1': accent[300],
    '--chart-2': accent[400],
    '--chart-3': accent[500],
    '--chart-4': accent[600],
    '--chart-5': accent[700],

    // Sidebar
    '--sidebar': neutral[50],
    '--sidebar-foreground': neutral[600],
    '--sidebar-primary': accentIsNeutral ? accent[900] : (isBright ? accent[500] : accent[600]),
    '--sidebar-primary-foreground': accentIsNeutral ? 'oklch(1 0 0)' : (isBright ? accent[950] : accent[50]),
    '--sidebar-accent': neutral[100],
    '--sidebar-accent-foreground': neutral[900],
    '--sidebar-border': neutral[200],
    '--sidebar-ring': accentIsNeutral ? accent[950] : accent[500],

    // Interaction & surface tokens (must match brand color)
    '--hover': 'oklch(0 0 0 / 4%)',
    '--active-bg': withAlpha(accentIsNeutral ? accent[900] : accent[500], 0.08),
    '--active-border': accentIsNeutral ? accent[900] : accent[500],
    '--surface': neutral[50],
    '--surface-raised': 'oklch(1 0 0)',
    '--glass-bg': 'oklch(1 0 0 / 70%)',
    '--glass-border': 'oklch(0 0 0 / 8%)',
  };

  const dark: Record<string, string> = {
    // Backgrounds
    '--background': neutral[950],
    '--foreground': neutral[100], // text color
    '--card': neutral[900],
    '--card-foreground': neutral[50], 
    '--popover': neutral[800],
    '--popover-foreground': neutral[50],

    // Primary — neutral: 50/900, bright: 500/950, standard: 500/white
    '--primary': accentIsNeutral ? accent[50] : accent[500],
    '--primary-foreground': accentIsNeutral ? accent[900] : (isBright ? accent[950] : 'oklch(1 0 0)'),

    // Secondary & Accent — distinct shades for visual hierarchy
    '--secondary': neutral[800],
    '--secondary-foreground': neutral[50],
    '--muted': neutral[800],
    '--muted-foreground': neutral[400],
    '--accent': neutral[700],        // lighter than secondary — creates visible hover state
    '--accent-foreground': neutral[50],

    // Destructive
    '--destructive': COLOR_SCALES.red[500],
    '--destructive-foreground': 'oklch(1 0 0)',

    // Borders & Input
    '--border': neutral[800],        // was neutral[900] — invisible against card; now visible
    '--input': neutral[800],         // was neutral[700] — too light/floating; now matches card level
    '--ring': accentIsNeutral ? accent[50] : accent[400],

    // Charts
    '--chart-1': accent[300],
    '--chart-2': accent[400],
    '--chart-3': accent[500],
    '--chart-4': accent[600],
    '--chart-5': accent[700],

    // Sidebar
    '--sidebar': neutral[900],
    '--sidebar-foreground': neutral[400],
    '--sidebar-primary': accentIsNeutral ? accent[50] : accent[500],
    '--sidebar-primary-foreground': accentIsNeutral ? accent[900] : (isBright ? accent[950] : 'oklch(1 0 0)'),
    '--sidebar-accent': neutral[700],
    '--sidebar-accent-foreground': neutral[50],
    '--sidebar-border': neutral[800],
    '--sidebar-ring': accentIsNeutral ? accent[50] : accent[400],

    // Interaction & surface tokens (must match brand color)
    '--hover': 'oklch(1 0 0 / 5%)',
    '--active-bg': withAlpha(accentIsNeutral ? accent[50] : accent[400], 0.12),
    '--active-border': accentIsNeutral ? accent[50] : accent[400],
    '--surface': neutral[950],
    '--surface-raised': neutral[900],
    '--glass-bg': withAlpha(neutral[900], 0.60),
    '--glass-border': 'oklch(1 0 0 / 10%)',
  };

  return { light, dark };
}

// ---------------------------------------------------------------------------
// Math-based fallback (for arbitrary hex colors)
// ---------------------------------------------------------------------------

function generateMathFallback(hex: string, neutralName: NeutralType): ThemePalette {
  const brand = parseToOklch(hex);
  if (!brand) {
    return generateTheme('#6366f1', neutralName);
  }

  const h = brand.h;
  const c = brand.c;

  // Get neutral scale for neutral tokens
  const nScale = COLOR_SCALES[neutralName];
  if (!nScale) {
    return generateTheme('#6366f1', neutralName);
  }

  // Normalise brand lightness for primary
  const primaryL = clamp(brand.l, 0.48, 0.62);
  const primaryC = Math.max(c, 0.08);
  const primaryFg = primaryL > 0.65 ? 'oklch(0.15 0 0)' : 'oklch(1 0 0)';
  const darkPrimaryL = clamp(primaryL + 0.08, 0.55, 0.72);

  const chartHues = [0, 55, 120, 185, 250].map((offset) => (h + offset) % 360);

  const light: Record<string, string> = {
    '--background': 'oklch(1 0 0)',
    '--foreground': nScale[950],
    '--card': 'oklch(1 0 0)',
    '--card-foreground': nScale[950],
    '--popover': 'oklch(1 0 0)',
    '--popover-foreground': nScale[950],
    '--primary': oklchStr(primaryL, primaryC, h),
    '--primary-foreground': primaryFg,
    '--secondary': nScale[100],
    '--secondary-foreground': nScale[900],
    '--muted': nScale[100],
    '--muted-foreground': nScale[500],
    '--accent': nScale[100],
    '--accent-foreground': nScale[900],
    '--destructive': COLOR_SCALES.red[600],
    '--destructive-foreground': 'oklch(1 0 0)',
    '--border': nScale[200],
    '--input': nScale[200],
    '--ring': oklchStr(0.65, primaryC * 0.5, h),
    '--chart-1': oklchStr(0.75, 0.14, chartHues[0]),
    '--chart-2': oklchStr(0.65, 0.18, chartHues[1]),
    '--chart-3': oklchStr(0.55, 0.20, chartHues[2]),
    '--chart-4': oklchStr(0.50, 0.18, chartHues[3]),
    '--chart-5': oklchStr(0.45, 0.15, chartHues[4]),
    '--sidebar': nScale[50],
    '--sidebar-foreground': nScale[600],
    '--sidebar-primary': oklchStr(primaryL, primaryC, h),
    '--sidebar-primary-foreground': primaryFg,
    '--sidebar-accent': nScale[100],
    '--sidebar-accent-foreground': nScale[900],
    '--sidebar-border': nScale[200],
    '--sidebar-ring': oklchStr(0.65, primaryC * 0.5, h),

    // Interaction & surface tokens (must match brand color)
    '--hover': 'oklch(0 0 0 / 4%)',
    '--active-bg': oklchStr(primaryL, primaryC, h, 0.08),
    '--active-border': oklchStr(primaryL, primaryC, h),
    '--surface': nScale[50],
    '--surface-raised': 'oklch(1 0 0)',
    '--glass-bg': 'oklch(1 0 0 / 70%)',
    '--glass-border': 'oklch(0 0 0 / 8%)',
  };

  const dark: Record<string, string> = {
    '--background': nScale[950],
    '--foreground': nScale[50],
    '--card': nScale[900],           // was [800] — too light; [900] gives proper depth hierarchy
    '--card-foreground': nScale[50],
    '--popover': nScale[800],        // was [700] — elevated overlays sit above card, not above card[800]
    '--popover-foreground': nScale[50],
    '--primary': oklchStr(darkPrimaryL, primaryC, h),
    '--primary-foreground': 'oklch(1 0 0)',
    '--secondary': nScale[800],
    '--secondary-foreground': nScale[50],
    '--muted': nScale[800],
    '--muted-foreground': nScale[400],
    '--accent': nScale[700],         // was [800] — lighter than secondary creates visible hover state
    '--accent-foreground': nScale[50],
    '--destructive': COLOR_SCALES.red[500],
    '--destructive-foreground': 'oklch(1 0 0)',
    '--border': nScale[800],
    '--input': nScale[800],
    '--ring': oklchStr(0.55, primaryC * 0.4, h),
    '--chart-1': oklchStr(0.80, 0.12, chartHues[0]),
    '--chart-2': oklchStr(0.68, 0.17, chartHues[1]),
    '--chart-3': oklchStr(0.58, 0.19, chartHues[2]),
    '--chart-4': oklchStr(0.52, 0.17, chartHues[3]),
    '--chart-5': oklchStr(0.47, 0.14, chartHues[4]),
    '--sidebar': nScale[900],
    '--sidebar-foreground': nScale[400],
    '--sidebar-primary': oklchStr(darkPrimaryL, primaryC, h),
    '--sidebar-primary-foreground': 'oklch(1 0 0)',
    '--sidebar-accent': nScale[700],
    '--sidebar-accent-foreground': nScale[50],
    '--sidebar-border': nScale[800],
    '--sidebar-ring': oklchStr(0.55, primaryC * 0.4, h),

    // Interaction & surface tokens (must match brand color)
    '--hover': 'oklch(1 0 0 / 5%)',
    '--active-bg': oklchStr(darkPrimaryL, primaryC * 0.8, h, 0.12),
    '--active-border': oklchStr(darkPrimaryL, primaryC, h),
    '--surface': nScale[950],
    '--surface-raised': nScale[900],
    '--glass-bg': withAlpha(nScale[900], 0.60),
    '--glass-border': 'oklch(1 0 0 / 10%)',
  };

  return { light, dark };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generate a full shadcn-compatible theme from a primary base color
 * and a neutral palette. Can accept a combined string or separate values.
 *
 * For known preset colors, uses exact Tailwind v4 reference values.
 * For arbitrary hex colors, computes values via perceptual math.
 */
export function generateTheme(base: string, baseNeutral?: NeutralType): ThemePalette {
  // If base contains a pipe, it's a combined string
  const { hex, neutral: neutralName } = base.includes('|')
    ? unpackTheme(base)
    : { hex: base, neutral: baseNeutral || 'stone' };

  const neutralScale = COLOR_SCALES[neutralName];
  if (!neutralScale) {
    return generateTheme('#6366f1|stone');
  }

  // Try to match the hex to a known preset scale
  const accentScaleName = findScaleForHex(hex);

  if (accentScaleName && COLOR_SCALES[accentScaleName]) {
    // Use exact scale values
    const accentScale = COLOR_SCALES[accentScaleName];
    const accentIsNeutral = isNeutralScale(accentScaleName);
    return generateFromScales(accentScale, neutralScale, accentIsNeutral, accentScaleName);
  }

  // Fallback: compute mathematically for custom hex colors
  return generateMathFallback(hex, neutralName);
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
export function generateThemeCSS(base: string, baseNeutral?: NeutralType): string {
  const { light, dark } = generateTheme(base, baseNeutral);

  const lightVars = Object.entries(light)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');

  const darkVars = Object.entries(dark)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');

  return `:root {\n${lightVars}\n}\n.dark {\n${darkVars}\n}`;
}
