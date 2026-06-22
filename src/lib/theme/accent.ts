/**
 * Accent engine.
 *
 * The product neutral (backgrounds, text, borders, cards) is fixed and lives
 * statically in `globals.css`. The ONLY thing a tenant configures is a single
 * brand hex. From that one color we derive the handful of "accent" tokens that
 * should carry the brand: primary, ring, sidebar-active and the chart series.
 *
 * Everything is computed algorithmically in OKLCH — there is one code path for
 * every possible color, no preset tables, no neutral picker.
 */
import { parse, converter, clampChroma } from 'culori';

const toOklch = converter('oklch');

/** Fallback brand (HalePulse indigo) used when no/invalid color is supplied. */
export const DEFAULT_BRAND = '#6366f1';

/** Curated swatches offered in the branding admin. Purely a UI convenience. */
export const BRAND_PRESETS: { name: string; hex: string }[] = [
  { name: 'Indigo',  hex: '#6366f1' },
  { name: 'Blue',    hex: '#3b82f6' },
  { name: 'Sky',     hex: '#0ea5e9' },
  { name: 'Teal',    hex: '#14b8a6' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Green',   hex: '#22c55e' },
  { name: 'Yellow',  hex: '#FFDD00' },
  { name: 'Amber',   hex: '#f59e0b' },
  { name: 'Orange',  hex: '#f97316' },
  { name: 'Red',     hex: '#ef4444' },
  { name: 'Rose',    hex: '#f43f5e' },
  { name: 'Violet',  hex: '#8b5cf6' },
  { name: 'Fuchsia', hex: '#d946ef' },
];

export type TokenMap = Record<string, string>;
export interface ThemeTokens {
  light: TokenMap;
  dark: TokenMap;
}

// ---------------------------------------------------------------------------
// Small math helpers
// ---------------------------------------------------------------------------

const WHITE = 'oklch(1 0 0)';
const NEAR_BLACK = 'oklch(0.205 0 0)';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function round(v: number): string {
  return Number(v.toFixed(3)).toString();
}

/** Format an OKLCH triplet (with optional alpha) as a CSS value. */
function oklch(l: number, c: number, h: number, alpha = 1): string {
  const L = clamp(l, 0, 1);
  const C = clamp(c, 0, 0.4);
  const H = ((h % 360) + 360) % 360;
  return alpha < 1
    ? `oklch(${round(L)} ${round(C)} ${round(H)} / ${Math.round(alpha * 100)}%)`
    : `oklch(${round(L)} ${round(C)} ${round(H)})`;
}

// ---------------------------------------------------------------------------
// Brand parsing
// ---------------------------------------------------------------------------

interface Hsl {
  l: number;
  c: number;
  h: number;
}

/**
 * Normalise any stored brand value to a clean `#rrggbb` hex.
 * Tolerates the legacy `"#6366f1|stone"` packed format by dropping the suffix.
 */
export function sanitizeBrand(input?: string | null): string {
  if (!input) return DEFAULT_BRAND;
  let v = input.split('|')[0].trim();
  if (!v) return DEFAULT_BRAND;
  if (!v.startsWith('#')) v = `#${v}`;
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : DEFAULT_BRAND;
}

function brandOklch(input?: string | null): Hsl {
  const parsed = parse(sanitizeBrand(input));
  const o = parsed ? toOklch(parsed) : null;
  if (!o) return { l: 0.51, c: 0.26, h: 277 }; // indigo
  return { l: o.l ?? 0, c: o.c ?? 0, h: o.h ?? 0 };
}

// ---------------------------------------------------------------------------
// Accent token generation
// ---------------------------------------------------------------------------

// Chart series: vibrant tints of the brand. Each stop is anchored on the brand's
// OWN lightness and pushed to its maximum in-gamut chroma, so colors stay
// saturated for any hue — a fixed lightness ladder turns yellows into dull
// mustard. Stop 1 is the brand anchor; the rest alternate lighter/darker so
// adjacent slices (e.g. in a donut) stay distinguishable.
const CHART_L_DELTAS = [0, 0.1, -0.1, 0.18, -0.16];
const CHART_H_DELTAS = [0, 10, -8, 16, -14];

/** Format an OKLCH triplet, reducing chroma only as far as the sRGB gamut needs. */
function gamutOklch(l: number, c: number, h: number): string {
  const x = clampChroma({ mode: 'oklch', l: clamp(l, 0, 1), c, h }, 'oklch');
  return oklch(x.l ?? 0, x.c ?? 0, x.h ?? 0);
}

/** Most vibrant in-gamut color at the given lightness near the brand hue. */
function vibrantChartStop(baseL: number, h: number, i: number): string {
  return gamutOklch(clamp(baseL + CHART_L_DELTAS[i], 0.32, 0.95), 0.4, h + CHART_H_DELTAS[i]);
}

/**
 * Derive the brand-tinted tokens for light & dark from a single hex.
 * These are layered on top of the static neutral palette in `globals.css`.
 */
export function generateAccent(input?: string | null): ThemeTokens {
  const { l, c, h } = brandOklch(input);
  const chroma = Math.max(c, 0.08);

  // The primary IS the selected brand color, only gently bounded so it never
  // becomes invisible (pure white) or a black hole. Inherently light accents
  // (yellow, amber, lime — OKLCH L ≥ 0.75) flip to dark text so contrast holds;
  // everything else gets white. Dark brands are lifted slightly in dark mode so
  // the button still pops against the near-black background.
  const isBright = l >= 0.75;
  const lightL = clamp(l, 0.45, 0.97);
  const darkL = clamp(l < 0.6 ? l + 0.06 : l, 0.45, 0.97);
  const lightFg = isBright ? NEAR_BLACK : WHITE;
  const darkFg = lightFg;

  // Brand gradient for active pills / avatars: a subtle vertical sheen on the
  // brand's OWN hue — a slightly deeper, marginally hue-shifted top flowing into
  // the vivid brand color at the bottom. The shift is intentionally small (-6°)
  // and chroma is held constant so the pill never blends into a second hue the
  // tenant didn't pick (the old -22° at max chroma turned red→magenta, violet→
  // blue, yellow→orange). Interpolated in OKLCH at the consumer (see Sidebar) so
  // the midpoint stays saturated rather than dipping through a muddy sRGB blend.
  // Same in both modes — it's a colored surface on the sidebar either way.
  // Top is a touch deeper than the brand; the bottom falls off into a brighter
  // tint so the pill reads with a soft glow at its base.
  const gradientChroma = Math.max(c, 0.12);
  const gradientFrom = gamutOklch(clamp(l - 0.1, 0.2, 0.9), gradientChroma, h - 8);
  const gradientTo = gamutOklch(clamp(l + 0.0, 0.45, 0.95), gradientChroma, h - 2);

  const light: TokenMap = {
    '--primary': oklch(lightL, chroma, h),
    '--primary-foreground': lightFg,
    '--ring': oklch(lightL, chroma * 0.6, h),
    '--sidebar-primary': oklch(lightL, chroma, h),
    '--sidebar-primary-foreground': lightFg,
    '--sidebar-ring': oklch(lightL, chroma * 0.6, h),
    '--primary-gradient-from': gradientFrom,
    '--primary-gradient-to': gradientTo,
  };
  const dark: TokenMap = {
    '--primary': oklch(darkL, chroma, h),
    '--primary-foreground': darkFg,
    '--ring': oklch(darkL, chroma * 0.6, h),
    '--sidebar-primary': oklch(darkL, chroma, h),
    '--sidebar-primary-foreground': darkFg,
    '--sidebar-ring': oklch(darkL, chroma * 0.6, h),
    '--primary-gradient-from': gradientFrom,
    '--primary-gradient-to': gradientTo,
  };

  // Upper bound is high (0.9 / 0.92) so inherently-light hues like yellow keep
  // their native lightness — at L≈0.8 the sRGB gamut starves yellow of chroma and
  // it collapses into muddy olive (#c4c500). Only brands lighter than the old 0.8
  // cap (essentially yellow / near-white) are affected; every other hue sits well
  // below it and is unchanged.
  const chartBaseLight = clamp(l, 0.58, 0.9);
  const chartBaseDark = clamp(l, 0.62, 0.92);
  // Secondary chart palette = the complementary hue (h + 180°), held at a fixed
  // vibrant lightness so it pops regardless of the brand's own lightness. Used
  // for "secondary" charts (e.g. Today's Report) to set them apart from primary.
  const secHue = h + 180;
  for (let i = 0; i < 5; i++) {
    light[`--chart-${i + 1}`] = vibrantChartStop(chartBaseLight, h, i);
    dark[`--chart-${i + 1}`] = vibrantChartStop(chartBaseDark, h, i);
    light[`--chart-secondary-${i + 1}`] = vibrantChartStop(0.66, secHue, i);
    dark[`--chart-secondary-${i + 1}`] = vibrantChartStop(0.7, secHue, i);
  }

  return { light, dark };
}

/**
 * Build a `<style>` body that overrides the accent tokens for both modes.
 * Injected server-side from the tenant's brand cookie so there is no flash and
 * no client-side recomputation — `next-themes` toggling `.dark` does the rest.
 */
export function generateAccentCSS(input?: string | null): string {
  const { light, dark } = generateAccent(input);
  const block = (vars: TokenMap) =>
    Object.entries(vars)
      .map(([k, v]) => `${k}:${v}`)
      .join(';');
  return `:root{${block(light)}}\n.dark{${block(dark)}}`;
}

// ---------------------------------------------------------------------------
// Static neutral palette (mirrors globals.css) — for admin live previews only
// ---------------------------------------------------------------------------

const NEUTRAL_LIGHT: TokenMap = {
  '--background': 'oklch(1 0 0)',
  '--foreground': 'oklch(0.145 0 0)',
  '--card': 'oklch(1 0 0)',
  '--card-foreground': 'oklch(0.145 0 0)',
  '--secondary': 'oklch(0.97 0 0)',
  '--secondary-foreground': 'oklch(0.205 0 0)',
  '--muted': 'oklch(0.97 0 0)',
  '--muted-foreground': 'oklch(0.556 0 0)',
  '--accent': 'oklch(0.97 0 0)',
  '--accent-foreground': 'oklch(0.205 0 0)',
  '--border': 'oklch(0.922 0 0)',
};

const NEUTRAL_DARK: TokenMap = {
  '--background': 'oklch(0.145 0 0)',
  '--foreground': 'oklch(0.985 0 0)',
  '--card': 'oklch(0.205 0 0)',
  '--card-foreground': 'oklch(0.985 0 0)',
  '--secondary': 'oklch(0.269 0 0)',
  '--secondary-foreground': 'oklch(0.985 0 0)',
  '--muted': 'oklch(0.269 0 0)',
  '--muted-foreground': 'oklch(0.708 0 0)',
  '--accent': 'oklch(0.371 0 0)',
  '--accent-foreground': 'oklch(0.985 0 0)',
  '--border': 'oklch(0.269 0 0)',
};

const DESTRUCTIVE = { light: 'oklch(0.577 0.245 27.325)', dark: 'oklch(0.637 0.237 25.331)' };

/** Full token maps (neutral + destructive + accent) for the branding preview. */
export function previewPalette(input?: string | null): ThemeTokens {
  const accent = generateAccent(input);
  return {
    light: { ...NEUTRAL_LIGHT, '--destructive': DESTRUCTIVE.light, ...accent.light },
    dark: { ...NEUTRAL_DARK, '--destructive': DESTRUCTIVE.dark, ...accent.dark },
  };
}
