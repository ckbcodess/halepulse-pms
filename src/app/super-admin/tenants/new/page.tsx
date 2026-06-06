'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/layout/PageHeader';

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
          <h2 className="text-xl font-bold text-foreground mb-2">Tenant Created!</h2>
          <p className="text-sm text-muted-foreground mb-6">
            A default Manager account was created. Share these credentials once — they won't be shown again.
          </p>
          <div className="bg-card rounded-xl p-4 text-left space-y-2 border border-border font-mono text-sm mb-4">
            <p className="text-muted-foreground">Email: <span className="font-bold text-foreground">{createdCreds.email}</span></p>
            <p className="text-muted-foreground">Password: <span className="font-bold text-foreground">{createdCreds.password}</span></p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={copyToClipboard} className="flex-1">
              {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
            </Button>
            <Button onClick={() => router.push('/super-admin/tenants')} className="flex-1">
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="New Tenant" description="Creates the tenant and a default Manager account." />

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg text-sm font-medium">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-5">
        {[
          { name: 'name',     label: 'Company Name', type: 'text',  placeholder: 'Acme Pharmacy'     },
          { name: 'subdomain', label: 'Subdomain',   type: 'text',  placeholder: 'acme-pharmacy'      },
          { name: 'logoUrl',  label: 'Logo URL',     type: 'url',   placeholder: 'https://…/logo.png' },
        ].map(f => (
          <div key={f.name} className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</label>
            <Input
              name={f.name}
              type={f.type}
              placeholder={f.placeholder}
              value={form[f.name as keyof typeof form]}
              onChange={handleChange}
              required={f.name !== 'logoUrl'}
              className="h-10"
            />
          </div>
        ))}

        <div className="grid grid-cols-2 gap-4">
          {[
            { name: 'primaryColor',   label: 'Primary Color'   },
            { name: 'secondaryColor', label: 'Secondary Color' },
          ].map(f => (
            <div key={f.name} className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  name={f.name}
                  value={form[f.name as keyof typeof form]}
                  onChange={handleChange}
                  className="w-10 h-10 rounded-lg border border-input bg-transparent cursor-pointer p-1"
                />
                <Input
                  type="text"
                  name={f.name}
                  value={form[f.name as keyof typeof form]}
                  onChange={handleChange}
                  className="h-10 flex-1 font-mono"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Live preview */}
        <div className="rounded-xl p-4 border border-border dark:border-border" style={{ background: form.primaryColor + '15' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Preview</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ background: form.primaryColor }}>
              {form.name.charAt(0) || '?'}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{form.name || 'Company Name'}</p>
              <p className="text-xs font-mono text-muted-foreground">{form.subdomain || 'subdomain'}.halepulse.app</p>
            </div>
          </div>
        </div>

        <Button type="submit" disabled={loading} size="lg" className="w-full">
          {loading ? 'Creating…' : 'Create Tenant'}
        </Button>
      </form>
    </div>
  );
}
