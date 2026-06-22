'use client';

/**
 * Developer-only theme playground (tenant side).
 *
 * Lets you preview any brand color live — without going through the super-admin
 * branding page — by writing the generated accent tokens as inline overrides on
 * <html>. Inline styles win over the server-injected accent <style>, so the whole
 * UI (primary, sidebar gradient, charts, etc.) re-themes instantly. "Reset"
 * removes the overrides and falls back to the real, server-set brand.
 *
 * Renders only outside production. The override is local to this browser and is
 * NOT persisted to the tenant — it's purely a preview aid.
 */
import { useEffect, useState } from 'react';
import { Palette, X, RotateCcw, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { generateAccent, BRAND_PRESETS, DEFAULT_BRAND } from '@/lib/theme/accent';

const STORAGE_KEY = 'dev-theme-override';
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function applyOverride(hex: string, mode: 'light' | 'dark') {
  const tokens = generateAccent(hex)[mode];
  const root = document.documentElement;
  for (const [k, v] of Object.entries(tokens)) root.style.setProperty(k, v);
}

function clearOverride() {
  // generateAccent always emits the same keys — use the default to enumerate them.
  const keys = Object.keys(generateAccent(DEFAULT_BRAND).light);
  const root = document.documentElement;
  for (const k of keys) root.style.removeProperty(k);
}

export default function ThemeDevTool() {
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState('');       // active override ('' = none)
  const [draft, setDraft] = useState('#6366f1');

  // Restore a persisted override on mount. localStorage is client-only, so this
  // must run in an effect (a lazy initializer would mismatch SSR), hence the
  // intentional set-state-in-effect below.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored || !HEX_RE.test(stored)) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setHex(stored);
    setDraft(stored);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // (Re)apply whenever the color or light/dark mode changes.
  useEffect(() => {
    if (!hex) return;
    applyOverride(hex, resolvedTheme === 'dark' ? 'dark' : 'light');
  }, [hex, resolvedTheme]);

  const choose = (value: string) => {
    setDraft(value);
    if (!HEX_RE.test(value)) return;
    setHex(value);
    localStorage.setItem(STORAGE_KEY, value);
  };

  const reset = () => {
    clearOverride();
    setHex('');
    setDraft('#6366f1');
    localStorage.removeItem(STORAGE_KEY);
  };

  if (process.env.NODE_ENV === 'production') return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open theme preview"
        className="fixed bottom-4 right-4 z-[200] flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg hover:bg-accent transition-colors"
      >
        <Palette size={18} />
        {hex && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-card" />}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[200] w-72 rounded-2xl border border-border bg-card text-card-foreground shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Palette size={15} className="text-primary" />
          <span className="text-[13px] font-semibold">Theme Preview</span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">dev</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* Presets */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Presets</p>
          <div className="flex flex-wrap gap-1.5">
            {BRAND_PRESETS.map((p) => {
              const active = hex.toLowerCase() === p.hex.toLowerCase();
              return (
                <button
                  key={p.hex}
                  type="button"
                  title={p.name}
                  onClick={() => choose(p.hex)}
                  className={`size-7 rounded-lg border-2 transition-all hover:scale-110 ${
                    active ? 'border-foreground scale-110' : 'border-transparent hover:border-border'
                  }`}
                  style={{ backgroundColor: p.hex }}
                />
              );
            })}
          </div>
        </div>

        {/* Custom color */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Custom</p>
          <div className="flex items-center gap-2">
            <label className="relative size-9 shrink-0 cursor-pointer">
              <input
                type="color"
                value={HEX_RE.test(draft) ? draft : '#6366f1'}
                onChange={(e) => choose(e.target.value)}
                className="absolute inset-0 size-full opacity-0 cursor-pointer"
              />
              <span
                className="block size-9 rounded-lg border border-border"
                style={{ backgroundColor: HEX_RE.test(draft) ? draft : 'transparent' }}
              />
            </label>
            <input
              value={draft}
              onChange={(e) => {
                let v = e.target.value.trim();
                if (v && !v.startsWith('#')) v = `#${v}`;
                choose(v);
              }}
              placeholder="#6366f1"
              maxLength={7}
              className="h-9 flex-1 rounded-lg border border-input bg-background px-2.5 font-mono text-[13px] uppercase outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Light / dark */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Mode</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(['light', 'dark'] as const).map((m) => {
              const active = (resolvedTheme === 'dark' ? 'dark' : 'light') === m;
              const Icon = m === 'light' ? Sun : Moon;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTheme(m)}
                  className={`flex items-center justify-center gap-1.5 h-8 rounded-lg border text-[12px] font-medium capitalize transition-colors ${
                    active
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
                  }`}
                >
                  <Icon size={13} />
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        {/* Reset */}
        <button
          type="button"
          onClick={reset}
          disabled={!hex}
          className="flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          <RotateCcw size={13} />
          Reset to tenant brand
        </button>

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Preview only — applies to this browser and isn&apos;t saved to the tenant.
        </p>
      </div>
    </div>
  );
}
