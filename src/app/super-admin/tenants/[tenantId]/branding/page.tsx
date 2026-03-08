'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Save } from 'lucide-react';

export default function BrandingPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [form, setForm] = useState({
    name:           '',
    primaryColor:   '#6366f1',
    secondaryColor: '#8b5cf6',
    logoUrl:        '',
  });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [error,    setError]    = useState('');

  useEffect(() => {
    fetch(`/api/super-admin/tenants`)
      .then(r => r.json())
      .then((tenants: any[]) => {
        const t = tenants.find((t: any) => t.id === tenantId);
        if (t) setForm({ name: t.name, primaryColor: t.primaryColor, secondaryColor: t.secondaryColor, logoUrl: t.logoUrl ?? '' });
        setLoading(false);
      });
  }, [tenantId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/branding`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      if (!res.ok) { setError('Save failed'); return; }
      setSavedMsg('Saved!');
      setTimeout(() => setSavedMsg(''), 2000);
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-400 text-sm p-6">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Tenant Branding</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Customise the look and feel for this tenant.</p>
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <form onSubmit={handleSave} className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Company Name</label>
            <input name="name" type="text" value={form.name} onChange={handleChange} required
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-200" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Logo URL</label>
            <input name="logoUrl" type="url" value={form.logoUrl} onChange={handleChange} placeholder="https://…/logo.png"
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-200" />
          </div>
          {[
            { name: 'primaryColor',   label: 'Primary Color'   },
            { name: 'secondaryColor', label: 'Secondary Color' },
          ].map(f => (
            <div key={f.name} className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">{f.label}</label>
              <div className="flex items-center gap-3">
                <input type="color" name={f.name} value={form[f.name as keyof typeof form]} onChange={handleChange}
                  className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer p-1" />
                <input type="text" name={f.name} value={form[f.name as keyof typeof form]} onChange={handleChange}
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 outline-none dark:text-slate-200" />
              </div>
            </div>
          ))}
          <button type="submit" disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl transition-colors">
            <Save size={16} /> {saving ? 'Saving…' : savedMsg || 'Save Branding'}
          </button>
        </form>

        {/* Live Preview */}
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Live Preview</p>
          <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
            {/* Mini sidebar preview */}
            <div className="flex h-48">
              <div className="w-32 flex flex-col p-3" style={{ background: form.primaryColor }}>
                <div className="flex items-center gap-2 mb-4">
                  {form.logoUrl
                    ? <img src={form.logoUrl} alt="logo" className="w-6 h-6 rounded object-cover" />
                    : <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center text-white text-[10px] font-bold">{form.name.charAt(0)}</div>
                  }
                  <span className="text-white text-[10px] font-bold truncate">{form.name || 'Company'}</span>
                </div>
                {['Dashboard', 'Inventory', 'POS'].map(item => (
                  <div key={item} className="text-white/70 text-[9px] px-2 py-1 rounded hover:bg-white/10 cursor-pointer">{item}</div>
                ))}
              </div>
              <div className="flex-1 bg-slate-50 dark:bg-slate-900 p-4">
                <div className="h-3 w-32 rounded" style={{ background: form.primaryColor + '40' }} />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-10 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800" />
                  ))}
                </div>
              </div>
            </div>
            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: form.primaryColor }} />
              <div className="w-3 h-3 rounded-full" style={{ background: form.secondaryColor }} />
              <span className="text-xs text-slate-400 ml-1">{form.primaryColor} · {form.secondaryColor}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
