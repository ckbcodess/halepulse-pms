'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Plus, Loader2, Check, Copy, UserCog, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import PageHeader from '@/components/layout/PageHeader';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';

interface Member {
  id: number;
  name: string;
  email: string | null;
  contact: string | null;
  role: string | null;
  branch: string | null;
  isActive: boolean;
  canCreateUsers: boolean;
  lastActiveAt: string | null;
}

const emptyForm = {
  firstName: '', lastName: '', email: '', contact: '',
  dob: '', ghanaCard: '', residence: '', role: 'MCA',
};

export default function TeamView() {
  const { data: session } = useSession();
  const canCreate = !!session?.user?.canCreateUsers;

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [creds, setCreds] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/team');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setMembers(data.members ?? []);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setCreateError('');
    try {
      const res = await fetch('/api/team/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create member');
      setCreds({ email: data.user?.email ?? form.email, tempPassword: data.tempPassword });
      setShowCreate(false);
      setForm(emptyForm);
      await load();
    } catch (e: any) {
      setCreateError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Loading team…</div>;
  }
  if (error) return <div className="p-6 text-destructive">{error}</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader title="Team" description="Your team members and their access.">
        {canCreate && (
          <Button onClick={() => { setShowCreate(true); setCreateError(''); }}>
            <Plus size={14} /> Add Team Member
          </Button>
        )}
      </PageHeader>

      {!canCreate && (
        <p className="text-xs text-muted-foreground -mt-2">
          You can view team members. Adding new members is managed by your administrator.
        </p>
      )}

      {/* Members table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <UserCog size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No team members yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{m.role ?? '—'}</Badge>
                      {m.canCreateUsers && <span className="ml-1.5 text-[10px] text-emerald-600 font-bold">CAN ADD USERS</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.contact ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.branch ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={m.isActive ? 'success' : 'destructive'}>{m.isActive ? 'Active' : 'Disabled'}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.lastActiveAt ? new Date(m.lastActiveAt).toLocaleString() : 'Never'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Add Team Member</h3>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowCreate(false)}><X size={16} /></Button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">First Name *</label>
                  <Input required value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Last Name *</label>
                  <Input required value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Email *</label>
                  <Input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Contact</label>
                  <Input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Date of Birth</label>
                  <DatePicker value={form.dob} onChange={v => setForm(f => ({ ...f, dob: v }))} placeholder="Select date" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Ghana Card</label>
                  <Input value={form.ghanaCard} onChange={e => setForm(f => ({ ...f, ghanaCard: e.target.value }))} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">Residence</label>
                  <Input value={form.residence} onChange={e => setForm(f => ({ ...f, residence: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Role *</label>
                  <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v ?? 'MCA' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PHARMACIST">Pharmacist</SelectItem>
                      <SelectItem value="MCA">MCA</SelectItem>
                      <SelectItem value="AUDIT">Audit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {createError && <p className="text-xs text-destructive">{createError}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {saving ? 'Creating…' : 'Create Member'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials modal */}
      {creds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-semibold">Member Created</h3>
            <p className="text-xs text-muted-foreground">Share these login details. The password is shown once.</p>
            <div className="bg-muted rounded-xl p-4 space-y-2">
              <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Email / Username</p><p className="text-sm font-mono">{creds.email}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Temporary Password</p><p className="text-sm font-mono font-bold text-primary">{creds.tempPassword}</p></div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => {
                navigator.clipboard.writeText(`Email: ${creds.email}\nPassword: ${creds.tempPassword}`);
                setCopied(true); setTimeout(() => setCopied(false), 2000);
              }}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button variant="outline" onClick={() => setCreds(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
