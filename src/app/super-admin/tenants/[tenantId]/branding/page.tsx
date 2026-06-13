'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  Save,
  Palette,
  Sun,
  Moon,
  Check,
  ShoppingCart,
  AlertTriangle,
  Bell,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { generateTheme, PRESET_COLORS, NEUTRAL_PALETTES, type NeutralType, unpackTheme, packTheme, type ThemePalette } from '@/lib/theme/theme-utils';

// ---------------------------------------------------------------------------
// Component preview rendered inside a scoped CSS-var container
// ---------------------------------------------------------------------------

function ThemePreview({
  palette,
  mode,
  label,
}: {
  palette: ThemePalette;
  mode: 'light' | 'dark';
  label: string;
}) {
  const vars = palette[mode];
  const style = Object.entries(vars).reduce(
    (acc, [k, v]) => ({ ...acc, [k]: v }),
    {} as React.CSSProperties
  );

  // The wrapper sets all CSS vars so children inherit the generated palette
  return (
    <div
      className={mode === 'dark' ? 'dark' : ''}
      style={style}
    >
      <div
        className="rounded-xl p-5 flex flex-col gap-4 border transition-colors"
        style={{
          background: vars['--background'],
          color: vars['--foreground'],
          borderColor: mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
        }}
      >
        {/* Mode label */}
        <div className="flex items-center gap-2 mb-1">
          {mode === 'light' ? <Sun size={14} /> : <Moon size={14} />}
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: vars['--muted-foreground'] }}>
            {label}
          </span>
        </div>

        {/* Card sample */}
        <div
          className="rounded-lg p-4 flex flex-col gap-3 border"
          style={{
            background: vars['--card'],
            color: vars['--card-foreground'],
            borderColor: mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">Dashboard</span>
            <span
              className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border"
              style={{
                background: vars['--secondary'],
                color: vars['--secondary-foreground'],
                borderColor: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              }}
            >
              Badge
            </span>
          </div>

          {/* Stat row */}
          <div className="grid grid-cols-3 gap-2">
            {['Revenue', 'Sales', 'Stock'].map((label) => (
              <div
                key={label}
                className="rounded-md p-2 text-center border"
                style={{
                  background: vars['--muted'],
                  borderColor: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                }}
              >
                <p className="text-lg font-black" style={{ color: vars['--foreground'] }}>
                  42
                </p>
                <p className="text-[10px] font-medium" style={{ color: vars['--muted-foreground'] }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Button row */}
        <div className="flex gap-2">
          <button
            className="flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors"
            style={{
              background: vars['--primary'],
              color: vars['--primary-foreground'],
            }}
          >
            Primary
          </button>
          <button
            className="flex-1 px-3 py-2 rounded-lg text-xs font-bold border transition-colors"
            style={{
              background: vars['--secondary'],
              color: vars['--secondary-foreground'],
              borderColor: mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
            }}
          >
            Secondary
          </button>
          <button
            className="px-3 py-2 rounded-lg text-xs font-bold transition-colors"
            style={{
              background: vars['--destructive'],
              color: '#fff',
            }}
          >
            Danger
          </button>
        </div>

        {/* Input sample */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg border"
          style={{
            background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
            borderColor: mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <Search size={14} style={{ color: vars['--muted-foreground'] }} />
          <span className="text-sm" style={{ color: vars['--muted-foreground'] }}>
            Search products...
          </span>
        </div>

        {/* Alert sample */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg border"
          style={{
            background: vars['--accent'],
            borderColor: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }}
        >
          <Bell size={14} style={{ color: vars['--primary'] }} />
          <span className="text-xs font-medium" style={{ color: vars['--accent-foreground'] }}>
            3 new notifications
          </span>
        </div>

        {/* Chart colors row */}
        <div className="flex items-center gap-1.5">
          {(['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5'] as const).map((key) => (
            <div
              key={key}
              className="h-3 flex-1 rounded-full"
              style={{ background: vars[key] }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BrandingPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [form, setForm] = useState({
    name: '',
    baseColor: '#6366f1',
    baseNeutral: 'stone' as NeutralType,
    logoUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/logo`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setForm((p) => ({ ...p, logoUrl: data.logoUrl }));
      setSavedMsg('Logo uploaded');
      setTimeout(() => setSavedMsg(''), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logo upload failed');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleLogoRemove() {
    setUploadingLogo(true);
    setError('');
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/logo`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Remove failed');
      setForm((p) => ({ ...p, logoUrl: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logo removal failed');
    } finally {
      setUploadingLogo(false);
    }
  }

  // Fetch existing branding
  useEffect(() => {
    fetch(`/api/super-admin/tenants/${tenantId}/detail`)
      .then((r) => r.json())
      .then((t: any) => {
        if (!t || t.error) return;
        const rawColor = t.baseColor ?? t.primaryColor ?? '#6366f1';
        const { hex, neutral } = unpackTheme(rawColor);
        setForm({
          name: t.name,
          baseColor: hex,
          baseNeutral: neutral,
          logoUrl: t.logoUrl ?? '',
        });
        setLoading(false);
      });
  }, [tenantId]);

  // Generate palette from current base color (memoised)
  const palette = useMemo(() => generateTheme(form.baseColor, form.baseNeutral), [form.baseColor, form.baseNeutral]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const packedColor = packTheme(form.baseColor, form.baseNeutral);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/branding`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          baseColor: packedColor,
          primaryColor: form.baseColor,
          secondaryColor: form.baseNeutral,
          logoUrl: form.logoUrl,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ? `Save failed: ${body.error}` : `Save failed (${res.status})`);
        return;
      }

      // We do NOT refresh the page or update the DynamicThemeProvider here.
      // The super-admin should keep their own theme while editing tenants.
      // Tenant users will see the new branding on their next page load
      // (the cookie was set by the API response).

      setSavedMsg('Saved!');
      setTimeout(() => setSavedMsg(''), 2000);
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Palette size={20} /> Tenant Branding
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Pick a single brand color — the system generates a full palette for light &amp; dark modes.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6">
        {/* ── Left column: Controls ── */}
        <form onSubmit={handleSave} className="flex flex-col gap-6">
          {/* Base Color Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Brand Color</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Color picker + hex input */}
              <div className="flex items-center gap-3">
                <label className="relative cursor-pointer group">
                  <input
                    type="color"
                    value={form.baseColor}
                    onChange={(e) => setForm((p) => ({ ...p, baseColor: e.target.value }))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div
                    className="w-12 h-12 rounded-xl border-2 border-border shadow-sm transition-transform group-hover:scale-105"
                    style={{ backgroundColor: form.baseColor }}
                  />
                </label>
                <Input
                  value={form.baseColor}
                  onChange={(e) => {
                    let v = e.target.value;
                    if (!v.startsWith('#')) v = '#' + v;
                    setForm((p) => ({ ...p, baseColor: v }));
                  }}
                  className="font-mono text-sm uppercase w-32"
                  maxLength={7}
                  placeholder="#6366f1"
                />
              </div>

              {/* Preset swatches */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Primary Themes
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((preset) => {
                    const isActive =
                      form.baseColor.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() =>
                          setForm((p) => ({ ...p, baseColor: preset.hex }))
                        }
                        className={`group relative w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 active:scale-95 ${
                          isActive
                            ? 'border-foreground shadow-md scale-110'
                            : 'border-transparent hover:border-border'
                        }`}
                        style={{ backgroundColor: preset.hex }}
                        title={preset.name}
                      >
                        {isActive && (
                          <Check
                            size={12}
                            className="absolute inset-0 m-auto text-white drop-shadow-md"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Neutral Base selection */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Neutral Backdrop (Base)
                </p>
                <div className="flex gap-2">
                  {NEUTRAL_PALETTES.map((key) => {
                    const isActive = form.baseNeutral === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, baseNeutral: key }))}
                        className={`flex-1 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all ${
                          isActive
                            ? 'bg-foreground text-background border-foreground shadow-sm'
                            : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
                        }`}
                      >
                        {key}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Generated palette preview strip */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Generated Palette
                </p>
                <div className="flex gap-1 h-7 rounded-lg overflow-hidden">
                  {[
                    palette.light['--primary'],
                    palette.light['--accent'],
                    palette.light['--secondary'],
                    palette.light['--muted'],
                    palette.light['--ring'],
                    palette.dark['--primary'],
                    palette.dark['--accent'],
                    palette.dark['--card'],
                    palette.dark['--background'],
                  ].map((color, i) => (
                    <div
                      key={i}
                      className="flex-1 transition-colors"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Company Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  required
                  placeholder="Pharmacy Co."
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="logoFile">Logo</Label>
                <div className="flex items-center gap-4">
                  {form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt="Tenant logo preview"
                      className="h-14 w-14 rounded-lg object-contain border border-border bg-card"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground">
                      No logo
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <Input
                      id="logoFile"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      disabled={uploadingLogo}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(file);
                        e.target.value = '';
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">PNG, JPG, WebP or SVG — max 2MB</span>
                      {form.logoUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={uploadingLogo}
                          onClick={handleLogoRemove}
                          className="h-auto py-0.5 px-2 text-[11px] text-destructive hover:text-destructive"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save button */}
          <Button type="submit" disabled={saving} className="w-full">
            <Save size={16} />
            {saving ? 'Saving…' : savedMsg || 'Save Branding'}
          </Button>
        </form>

        {/* ── Right column: Live Previews ── */}
        <div className="flex flex-col gap-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Live Preview
          </p>

          <ThemePreview palette={palette} mode="light" label="Light Mode" />
          <ThemePreview palette={palette} mode="dark" label="Dark Mode" />
        </div>
      </div>
    </div>
  );
}
