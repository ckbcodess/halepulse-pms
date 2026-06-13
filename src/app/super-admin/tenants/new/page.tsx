'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, Building2, GitBranch } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/layout/PageHeader';

type Kind = 'hq' | 'branch';

interface BusinessOption {
  id: string;
  name: string;
  businessId: string | null;
}

export default function RegisterBusinessPage() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>('hq');
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [parentId, setParentId] = useState('');

  const [form, setForm] = useState({
    name:           '',
    subdomain:      '',
    prefix:         '',
    address:        '',
    phone:          '',
    primaryColor:   '#6366f1',
    secondaryColor: '#8b5cf6',
  });
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [createdCreds, setCreatedCreds] = useState<{
    email?: string;
    password?: string;
    businessId?: string | null;
    credentials?: { credentialCode: string; roleName: string; password: string }[];
  } | null>(null);
  const [copied,       setCopied]       = useState(false);

  // Computed preview for the HQ business ID
  const prefixValid = /^[A-Za-z]{3}$/.test(form.prefix);
  const hqPreview = prefixValid ? `${form.prefix.toUpperCase()}000` : null;

  // Load existing businesses for the "branch of an existing business" picker
  useEffect(() => {
    if (kind !== 'branch') return;
    fetch('/api/super-admin/tenants')
      .then((r) => r.json())
      .then((res: any) => {
        const data: BusinessOption[] = Array.isArray(res) ? res : (res?.tenants ?? []);
        setBusinesses(data);
        if (data.length && !parentId) setParentId(data[0].id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === 'prefix') {
      // Only allow alpha chars, max 3, uppercase
      const clean = value.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
      setForm(prev => ({ ...prev, prefix: clean }));
      return;
    }

    setForm(prev => ({ ...prev, [name]: value }));
    if (name === 'name' && kind === 'hq') {
      setForm(prev => ({ ...prev, name: value, subdomain: value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (kind === 'hq') {
        if (!prefixValid) {
          setError('Business ID Prefix must be exactly 3 letters (e.g. HAL, MED)');
          return;
        }
        const res = await fetch('/api/super-admin/tenants', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ ...form, prefix: form.prefix.toUpperCase() }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? 'Failed'); return; }
        setCreatedCreds({ email: data.managerEmail, password: data.tempPassword, businessId: data.tenant?.businessId, credentials: data.credentials });
      } else {
        if (!parentId) { setError('Select the business this branch belongs to'); return; }
        const res = await fetch(`/api/super-admin/tenants/${parentId}/branches`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ name: form.name, address: form.address, phone: form.phone, subdomain: form.subdomain }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? 'Failed'); return; }
        setCreatedCreds({ businessId: data.branch?.businessId, credentials: data.credentials });
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!createdCreds) return;
    const lines: string[] = [];
    if (createdCreds.email) lines.push(`Email: ${createdCreds.email}`, `Password: ${createdCreds.password}`);
    (createdCreds.credentials ?? []).forEach((c) => lines.push(`${c.credentialCode} (${c.roleName}): ${c.password}`));
    navigator.clipboard.writeText(lines.join('\n'));
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
          <h2 className="text-xl font-bold text-foreground mb-2">
            {kind === 'hq' ? 'Business Registered!' : 'Branch Registered!'}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {kind === 'hq' ? 'The business and its Head Office branch have been created.' : 'The branch has been created.'} You can now add users and assign them roles.
          </p>
          {createdCreds.businessId && (
            <div className="bg-card rounded-xl p-4 text-left border border-border font-mono text-sm mb-4">
              <p className="text-xs text-muted-foreground mb-1">Business ID</p>
              <p className="text-lg font-bold text-foreground">{createdCreds.businessId}</p>
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/super-admin/tenants')} className="flex-1">
              View Businesses
            </Button>
            <Button onClick={() => router.push('/super-admin/tenants')} className="flex-1">
              Add Users →
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Register Business" description="Set up a new business or add a branch to an existing one." />

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg text-sm font-medium">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-5">

        {/* Kind selector: Head Quarters vs Branch */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">What are you registering?</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setKind('hq')}
              className={`flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-colors ${
                kind === 'hq' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
              }`}
            >
              <Building2 size={20} className={kind === 'hq' ? 'text-primary' : 'text-muted-foreground'} />
              <span className="text-sm font-semibold text-foreground">Head Quarters</span>
              <span className="text-xs text-muted-foreground">A new business — gets its own Business ID and main branch.</span>
            </button>
            <button
              type="button"
              onClick={() => setKind('branch')}
              className={`flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-colors ${
                kind === 'branch' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
              }`}
            >
              <GitBranch size={20} className={kind === 'branch' ? 'text-primary' : 'text-muted-foreground'} />
              <span className="text-sm font-semibold text-foreground">Branch</span>
              <span className="text-xs text-muted-foreground">Another location of an existing business — its ID is linked to the HQ.</span>
            </button>
          </div>
        </div>

        {/* Parent business picker — branch only */}
        {kind === 'branch' && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Belongs to business</label>
            {businesses.length === 0 ? (
              <p className="text-xs text-muted-foreground">No businesses registered yet — register a Head Quarters first.</p>
            ) : (
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.businessId ? `(${b.businessId})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Name */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {kind === 'hq' ? 'Company Name' : 'Branch Name'}
          </label>
          <Input
            name="name"
            type="text"
            placeholder={kind === 'hq' ? 'Acme Pharmacy' : 'Acme Pharmacy — Westgate'}
            value={form.name}
            onChange={handleChange}
            required
            className="h-10"
          />
        </div>

        {/* Business ID Prefix — HQ only */}
        {kind === 'hq' && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Business ID Prefix
            </label>
            <Input
              name="prefix"
              type="text"
              placeholder="HAL"
              value={form.prefix}
              onChange={handleChange}
              maxLength={3}
              required
              className="h-10 font-mono uppercase tracking-widest"
            />
            {/* Live preview */}
            {form.prefix.length > 0 && (
              <div className={`text-xs rounded-lg px-3 py-2 ${
                prefixValid
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
              }`}>
                {prefixValid ? (
                  <>
                    HQ Business ID: <span className="font-mono font-bold">{hqPreview}</span>
                    {' '}| Branches will be:{' '}
                    <span className="font-mono font-bold">{form.prefix.toUpperCase()}001</span>,{' '}
                    <span className="font-mono font-bold">{form.prefix.toUpperCase()}002</span>…
                  </>
                ) : (
                  'Enter exactly 3 letters (e.g. HAL, MED, PHX)'
                )}
              </div>
            )}
          </div>
        )}

        {/* Subdomain — HQ only (branches share the business' subdomain) */}
        {kind === 'hq' && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subdomain</label>
            <Input
              name="subdomain"
              type="text"
              placeholder="acme-pharmacy"
              value={form.subdomain}
              onChange={handleChange}
              required
              className="h-10"
            />
          </div>
        )}

        {/* Address / phone — branch only */}
        {kind === 'branch' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</label>
              <Input name="address" type="text" placeholder="Street, City" value={form.address} onChange={handleChange} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</label>
              <Input name="phone" type="text" placeholder="+263…" value={form.phone} onChange={handleChange} className="h-10" />
            </div>
          </div>
        )}

        {/* Brand colors — HQ only */}
        {kind === 'hq' && (
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
        )}

        <p className="text-xs text-muted-foreground -mt-2">
          {kind === 'hq'
            ? 'A "Head Office" branch and a linked Business ID are created automatically, along with a default Manager account.'
            : 'A Business ID linked to the parent HQ and a default Manager account are created automatically.'}
        </p>

        <Button type="submit" disabled={loading || (kind === 'branch' && !parentId)} size="lg" className="w-full">
          {loading ? 'Registering…' : kind === 'hq' ? 'Register Business' : 'Register Branch'}
        </Button>
      </form>
    </div>
  );
}
