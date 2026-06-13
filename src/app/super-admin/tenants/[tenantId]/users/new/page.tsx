'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Check, Loader2 } from 'lucide-react';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Branch = { id: string; name: string };

const emptyForm = {
  firstName: '', lastName: '', email: '',
  contact: '', dob: '', ghanaCard: '', residence: '',
  branchId: '', role: 'PHARMACIST', canCreateUsers: false,
};

export default function CreateUserPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();

  const [form, setForm] = useState(emptyForm);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ email: string; tempPassword: string; firstName: string; lastName: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/super-admin/tenants/${tenantId}/branches`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => setBranches(data.branches ?? []))
      .catch(() => {});
  }, [tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tenantId) {
      setError('Missing tenant ID — please reload the page.');
      return;
    }

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError('First name, last name and email are required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      let data: Record<string, unknown> = {};
      try {
        data = await res.json();
      } catch {
        throw new Error('Server returned an unexpected response. Please try again.');
      }

      if (res.ok) {
        setResult({
          email: (data.user as { email: string }).email,
          tempPassword: data.tempPassword as string,
          firstName: form.firstName,
          lastName: form.lastName,
        });
      } else {
        setError((data.error as string) || `Error ${res.status}: Failed to create user`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const copyCredentials = () => {
    if (!result) return;
    navigator.clipboard.writeText(
      `Name: ${result.firstName} ${result.lastName}\nEmail: ${result.email}\nPassword: ${result.tempPassword}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (result) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={24} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1">User Created</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Share these login credentials with {result.firstName}. The password is shown only once.
          </p>
          <div className="bg-card rounded-xl p-4 text-left space-y-3 border border-border mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Name</p>
              <p className="text-sm font-semibold text-foreground">{result.firstName} {result.lastName}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Email / Username</p>
              <p className="text-sm font-mono font-semibold text-foreground">{result.email}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Temporary Password</p>
              <p className="text-sm font-mono font-bold text-primary">{result.tempPassword}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={copyCredentials} className="w-full mb-3">
            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Credentials</>}
          </Button>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => router.push(`/super-admin/tenants/${tenantId}`)}>
            Back to Business
          </Button>
          <Button className="flex-1" onClick={() => { setResult(null); setForm(emptyForm); }}>
            Add Another User
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/super-admin/tenants/${tenantId}`)}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Create User</h1>
          <p className="text-sm text-muted-foreground">Fill in the user's details and assign them a branch and role.</p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-sm font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-5">

        {/* Personal details */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Personal Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">First Name *</label>
              <Input required placeholder="e.g. Kofi" value={form.firstName}
                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Last Name *</label>
              <Input required placeholder="e.g. Mensah" value={form.lastName}
                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Email Address *</label>
              <Input required type="email" placeholder="kofi@pharmacy.com" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Contact Number</label>
              <Input placeholder="+233 XX XXX XXXX" value={form.contact}
                onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Date of Birth</label>
              <Input type="date" value={form.dob}
                onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Ghana Card Number</label>
              <Input placeholder="GHA-XXXXXXXXX-X" value={form.ghanaCard}
                onChange={e => setForm(f => ({ ...f, ghanaCard: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground">Residence</label>
              <Input placeholder="Residential address" value={form.residence}
                onChange={e => setForm(f => ({ ...f, residence: e.target.value }))} />
            </div>
          </div>
        </div>

        <hr className="border-border" />

        {/* Assignment */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Assignment</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Branch *</label>
              <Select value={form.branchId} onValueChange={v => setForm(f => ({ ...f, branchId: v ?? '' }))}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches.length === 0
                    ? <SelectItem value="none" disabled>No branches available</SelectItem>
                    : branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Role *</label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v ?? 'PHARMACIST', canCreateUsers: false }))}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="PHARMACIST">Pharmacist</SelectItem>
                  <SelectItem value="MCA">MCA</SelectItem>
                  <SelectItem value="AUDIT">Audit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.role === 'MANAGER' && (
            <label className="flex items-center gap-2.5 mt-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.canCreateUsers}
                onChange={e => setForm(f => ({ ...f, canCreateUsers: e.target.checked }))}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm text-foreground font-medium">Allow this manager to create users</span>
              <span className="text-xs text-muted-foreground">(Pharmacist, MCA, Audit only)</span>
            </label>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          A temporary password will be generated. The user must change it on first login.
        </p>

        <Button type="submit" disabled={saving} className="w-full h-11">
          {saving ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : 'Create User'}
        </Button>
      </form>
    </div>
  );
}
