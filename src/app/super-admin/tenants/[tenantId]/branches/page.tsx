'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Building2, Plus, Edit3, X, Check, Loader2, Phone, MapPin, Power } from 'lucide-react';

type Branch = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  _count: { users: number };
};

export default function BranchesPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const [branches, setBranches]           = useState<Branch[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showCreate, setShowCreate]       = useState(false);
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [saving, setSaving]              = useState(false);
  const [error, setError]               = useState('');

  const emptyForm = { name: '', address: '', phone: '' };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/super-admin/tenants/${tenantId}/branches`);
    const data = await res.json();
    setBranches(data.branches ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const openEdit = (b: Branch) => {
    setEditingId(b.id);
    setForm({ name: b.name, address: b.address ?? '', phone: b.phone ?? '' });
    setShowCreate(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      setShowCreate(false);
      setForm(emptyForm);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/branches/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      setEditingId(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (b: Branch) => {
    await fetch(`/api/super-admin/tenants/${tenantId}/branches/${b.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !b.isActive }),
    });
    await load();
  };

  const FormFields = ({ onSubmit, onCancel }: { onSubmit: (e: React.FormEvent) => void; onCancel: () => void }) => (
    <form onSubmit={onSubmit} className="p-6 space-y-4 border-b border-border dark:border-white/5 bg-muted/30 dark:bg-muted/20">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-muted-foreground dark:text-muted-foreground">Branch Name <span className="text-rose-500">*</span></label>
          <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Main Branch"
            className="w-full px-3 py-2.5 bg-white dark:bg-sidebar border border-border dark:border-border rounded-lg text-sm font-medium dark:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-muted-foreground dark:text-muted-foreground">Phone</label>
          <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+233 XX XXX XXXX"
            className="w-full px-3 py-2.5 bg-white dark:bg-sidebar border border-border dark:border-border rounded-lg text-sm font-medium dark:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <label className="block text-xs font-semibold text-muted-foreground dark:text-muted-foreground">Address</label>
          <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Full branch address"
            className="w-full px-3 py-2.5 bg-white dark:bg-sidebar border border-border dark:border-border rounded-lg text-sm font-medium dark:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
        </div>
      </div>
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold transition-colors disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 border border-border dark:border-white/10 rounded-lg text-sm font-semibold text-muted-foreground dark:text-muted-foreground hover:bg-muted dark:hover:bg-white/5 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground dark:text-white">Branches</h2>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">{branches.length} branch{branches.length !== 1 ? 'es' : ''}</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setEditingId(null); setForm(emptyForm); setError(''); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus size={14} /> New Branch
        </button>
      </div>

      <div className="bg-white dark:bg-[#18181b] border border-border dark:border-white/5 rounded-2xl overflow-hidden">
        {showCreate && (
          <FormFields
            onSubmit={handleCreate}
            onCancel={() => { setShowCreate(false); setError(''); }}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : branches.length === 0 && !showCreate ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Building2 size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No branches yet. Create your first branch.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {branches.map(branch => (
              <div key={branch.id}>
                {editingId === branch.id ? (
                  <FormFields
                    onSubmit={handleEdit}
                    onCancel={() => { setEditingId(null); setError(''); }}
                  />
                ) : (
                  <div className="flex items-center gap-4 px-6 py-4 hover:bg-muted dark:hover:bg-white/[0.02] group">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <Building2 size={16} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground dark:text-muted-foreground">{branch.name}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${branch.isActive ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted dark:bg-sidebar text-muted-foreground'}`}>
                          {branch.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {branch.address && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MapPin size={9} /> {branch.address}
                          </span>
                        )}
                        {branch.phone && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Phone size={9} /> {branch.phone}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {branch._count.users} user{branch._count.users !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(branch)}
                        className="p-2 rounded-lg hover:bg-muted dark:hover:bg-sidebar text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground transition-colors">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => toggleActive(branch)}
                        className={`p-2 rounded-lg transition-colors ${branch.isActive ? 'hover:bg-rose-50 dark:hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600' : 'hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600'}`}>
                        <Power size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
