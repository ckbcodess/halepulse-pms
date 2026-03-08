'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';

export default function NewTenantPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name:           '',
    subdomain:      '',
    primaryColor:   '#6366f1',
    secondaryColor: '#8b5cf6',
    logoUrl:        '',
  });
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);
  const [copied,       setCopied]       = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    // Auto-derive subdomain from name
    if (name === 'name') {
      setForm(prev => ({ ...prev, name: value, subdomain: value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/super-admin/tenants', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed'); return; }
      setCreatedCreds({ email: data.managerEmail, password: data.tempPassword });
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!createdCreds) return;
    navigator.clipboard.writeText(`Email: ${createdCreds.email}\nPassword: ${createdCreds.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (createdCreds) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={24} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Tenant Created!</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            A default Manager account was created. Share these credentials once — they won't be shown again.
          </p>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 text-left space-y-2 border border-slate-200 dark:border-slate-800 font-mono text-sm mb-4">
            <p className="text-slate-700 dark:text-slate-300">Email: <span className="font-bold">{createdCreds.email}</span></p>
            <p className="text-slate-700 dark:text-slate-300">Password: <span className="font-bold">{createdCreds.password}</span></p>
          </div>
          <div className="flex gap-3">
            <button onClick={copyToClipboard} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
            </button>
            <button onClick={() => router.push('/super-admin/tenants')} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New Tenant</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Creates the tenant and a default Manager account.</p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-lg text-sm font-medium">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
        {[
          { name: 'name',     label: 'Company Name', type: 'text',  placeholder: 'Acme Pharmacy'     },
          { name: 'subdomain', label: 'Subdomain',   type: 'text',  placeholder: 'acme-pharmacy'      },
          { name: 'logoUrl',  label: 'Logo URL',     type: 'url',   placeholder: 'https://…/logo.png' },
        ].map(f => (
          <div key={f.name} className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">{f.label}</label>
            <input
              name={f.name}
              type={f.type}
              placeholder={f.placeholder}
              value={form[f.name as keyof typeof form]}
              onChange={handleChange}
              required={f.name !== 'logoUrl'}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all dark:text-slate-200"
            />
          </div>
        ))}

        <div className="grid grid-cols-2 gap-4">
          {[
            { name: 'primaryColor',   label: 'Primary Color'   },
            { name: 'secondaryColor', label: 'Secondary Color' },
          ].map(f => (
            <div key={f.name} className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">{f.label}</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  name={f.name}
                  value={form[f.name as keyof typeof form]}
                  onChange={handleChange}
                  className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer p-1"
                />
                <input
                  type="text"
                  name={f.name}
                  value={form[f.name as keyof typeof form]}
                  onChange={handleChange}
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-200"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Live preview */}
        <div className="rounded-xl p-4 border border-slate-200 dark:border-slate-700" style={{ background: form.primaryColor + '15' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Preview</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ background: form.primaryColor }}>
              {form.name.charAt(0) || '?'}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{form.name || 'Company Name'}</p>
              <p className="text-xs font-mono text-slate-400">{form.subdomain || 'subdomain'}.pharmNext.app</p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl transition-colors"
        >
          {loading ? 'Creating…' : 'Create Tenant'}
        </button>
      </form>
    </div>
  );
}
