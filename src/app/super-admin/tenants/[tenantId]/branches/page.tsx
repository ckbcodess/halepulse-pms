'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Building2, Plus, Edit3, Check, Loader2, Phone, MapPin, Power, Key } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/layout/PageHeader';

type Branch = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  _count: { users: number };
};

type Credential = { userId: number; credentialCode: string | null; role: string; roleName: string; password?: string };

// Stable form component — defined outside the page so it never re-mounts on parent state changes
const BranchForm = ({
  initialValues,
  onSubmit,
  onCancel,
  saving,
  error,
}: {
  initialValues: { name: string; address: string; phone: string };
  onSubmit: (values: { name: string; address: string; phone: string }) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
}) => {
  const [name, setName] = useState(initialValues.name);
  const [address, setAddress] = useState(initialValues.address);
  const [phone, setPhone] = useState(initialValues.phone);

  // Sync when parent resets (e.g. opening a different edit)
  const prevInitial = useRef(initialValues);
  useEffect(() => {
    if (prevInitial.current !== initialValues) {
      setName(initialValues.name);
      setAddress(initialValues.address);
      setPhone(initialValues.phone);
      prevInitial.current = initialValues;
    }
  }, [initialValues]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, address, phone });
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4 border-b border-border bg-muted/30">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-muted-foreground">Branch Name <span className="text-destructive">*</span></label>
          <Input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Main Branch" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-muted-foreground">Phone</label>
          <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+233 XX XXX XXXX" className="h-10" />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <label className="block text-xs font-semibold text-muted-foreground">Address</label>
          <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Full branch address" className="h-10" />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

// Credentials modal
const CredentialsModal = ({
  branch,
  tenantId,
  onClose,
}: {
  branch: Branch;
  tenantId: string;
  onClose: () => void;
}) => {
  const [creds, setCreds] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/super-admin/tenants/${tenantId}/branches/${branch.id}/credentials`)
      .then(r => r.json())
      .then(d => setCreds(d.credentials ?? []))
      .finally(() => setLoading(false));
  }, [branch.id, tenantId]);

  const resetCred = async (userId: number) => {
    const res = await fetch(`/api/super-admin/tenants/${tenantId}/branches/${branch.id}/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (res.ok) {
      setCreds(prev => prev.map(c => c.userId === userId ? { ...c, password: data.password } : c));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl mx-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Credentials — {branch.name}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Password</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creds.map(c => (
                <TableRow key={c.userId}>
                  <TableCell className="font-mono text-xs">{c.userId}</TableCell>
                  <TableCell className="font-mono text-xs">{c.credentialCode}</TableCell>
                  <TableCell>{c.roleName}</TableCell>
                  <TableCell className="font-mono text-xs">{c.password ?? '••••••'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => resetCred(c.userId)}>
                      <Key size={12} /> Reset
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {creds.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground">No credentials found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

const emptyForm = { name: '', address: '', phone: '' };

export default function BranchesPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [credsModalBranch, setCredsModalBranch] = useState<Branch | null>(null);

  const [createInitial, setCreateInitial] = useState(emptyForm);
  const [editInitial, setEditInitial] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/super-admin/tenants/${tenantId}/branches`);
    const data = await res.json();
    setBranches(data.branches ?? []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setCreateInitial(emptyForm);
    setShowCreate(true);
    setEditingBranch(null);
    setError('');
  };

  const openEdit = (b: Branch) => {
    const vals = { name: b.name, address: b.address ?? '', phone: b.phone ?? '' };
    setEditInitial(vals);
    setEditingBranch(b);
    setShowCreate(false);
    setError('');
  };

  const handleCreate = async (values: { name: string; address: string; phone: string }) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      setShowCreate(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (values: { name: string; address: string; phone: string }) => {
    if (!editingBranch) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/branches/${editingBranch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      setEditingBranch(null);
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

  return (
    <div className="space-y-6">
      <PageHeader title="Branches" description={`${branches.length} branch${branches.length !== 1 ? 'es' : ''}`}>
        <Button onClick={openCreate}>
          <Plus size={14} /> New Branch
        </Button>
      </PageHeader>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {showCreate && (
          <BranchForm
            key="create"
            initialValues={createInitial}
            onSubmit={handleCreate}
            onCancel={() => { setShowCreate(false); setError(''); }}
            saving={saving}
            error={error}
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
          <div className="divide-y divide-border">
            {branches.map(branch => (
              <div key={branch.id}>
                {editingBranch?.id === branch.id ? (
                  <BranchForm
                    key={`edit-${branch.id}`}
                    initialValues={editInitial}
                    onSubmit={handleEdit}
                    onCancel={() => { setEditingBranch(null); setError(''); }}
                    saving={saving}
                    error={error}
                  />
                ) : (
                  <div className="flex items-center gap-4 px-6 py-4 hover:bg-muted dark:hover:bg-white/[0.02] group">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <Building2 size={16} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{branch.name}</p>
                        <Badge variant={branch.isActive ? 'success' : 'secondary'}>
                          {branch.isActive ? 'Active' : 'Inactive'}
                        </Badge>
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
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => setCredsModalBranch(branch)}>
                        View Credentials
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(branch)}>
                        <Edit3 size={14} />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => toggleActive(branch)}>
                        <Power size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {credsModalBranch && (
        <CredentialsModal
          branch={credsModalBranch}
          tenantId={tenantId}
          onClose={() => setCredsModalBranch(null)}
        />
      )}
    </div>
  );
}
