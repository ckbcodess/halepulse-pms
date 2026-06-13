'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Building2, GitBranch, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/layout/PageHeader';

type Tenant = {
  id: string;
  name: string;
  businessId: string | null;
  subdomain: string;
  primaryColor: string;
  isActive: boolean;
  suspendedAt: string | null;
  createdAt: string;
  _count: { users: number; branches: number };
};

function DeleteDialog({ tenant, onClose, onDeleted }: { tenant: Tenant; onClose: () => void; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (confirm !== tenant.name) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      onDeleted();
    } catch (e: any) {
      setError(e.message);
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Delete Business</h2>
        <p className="text-sm text-muted-foreground">
          This will permanently delete <strong>{tenant.name}</strong> and all its data including branches, users, products, and sales. This action cannot be undone.
        </p>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Type <strong>{tenant.name}</strong> to confirm</label>
          <Input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={tenant.name} />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button variant="destructive" disabled={confirm !== tenant.name || deleting} onClick={handleDelete}>
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (statusFilter !== 'all') sp.set('status', statusFilter);
    const res = await fetch(`/api/super-admin/tenants?${sp}`);
    const data = await res.json();
    setTenants(data.tenants ?? []);
    setLoading(false);
  }, [q, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const totalBranches = tenants.reduce((s, t) => s + t._count.branches, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Businesses" description={`${tenants.length} registered businesses`}>
        <Button nativeButton={false} render={<Link href="/super-admin/tenants/new" />}>
          <Plus size={16} /> Register Business
        </Button>
      </PageHeader>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Businesses', value: tenants.length, icon: Building2 },
          { label: 'Total Branches', value: totalBranches, icon: GitBranch },
          { label: 'Active', value: tenants.filter(t => t.isActive).length, icon: Building2 },
          { label: 'Suspended', value: tenants.filter(t => !t.isActive && t.suspendedAt).length, icon: Building2 },
        ].map((c, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search businesses…"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="max-w-xs"
        />
        {['all', 'active', 'suspended', 'inactive'].map(s => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  {['Business', 'Business ID', 'Subdomain', 'Users', 'Branches', 'Status', 'Created', 'Actions'].map(h => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map(tenant => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                          style={{ background: tenant.primaryColor }}
                        >
                          {tenant.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{tenant.name}</p>
                          <p className="text-xs text-muted-foreground">{tenant.id.slice(0, 8)}…</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {tenant.businessId ? (
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono font-bold text-foreground">
                          {tenant.businessId}
                        </code>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded text-foreground">
                        {tenant.subdomain}
                      </code>
                    </TableCell>
                    <TableCell className="text-foreground">{tenant._count.users}</TableCell>
                    <TableCell className="text-foreground">{tenant._count.branches}</TableCell>
                    <TableCell>
                      <Badge variant={tenant.isActive ? 'success' : 'destructive'}>
                        {tenant.isActive ? 'Active' : tenant.suspendedAt ? 'Suspended' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(tenant.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/super-admin/tenants/${tenant.id}`} />}>
                          View
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(tenant)}>
                          <Trash2 size={14} className="text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {!loading && tenants.length === 0 && (
          <div className="p-12 text-center text-muted-foreground text-sm">No businesses match your filters.</div>
        )}
      </div>

      {deleteTarget && (
        <DeleteDialog
          tenant={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); load(); }}
        />
      )}
    </div>
  );
}
