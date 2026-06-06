'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function CreateUserPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MCA');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const res = await fetch(`/api/super-admin/tenants/${tenantId}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });

    if (res.ok) {
      const data = await res.json();
      setResult({ email: data.user.email, tempPassword: data.tempPassword });
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to create user');
    }
    setSaving(false);
  };

  const copyCredentials = () => {
    if (!result) return;
    navigator.clipboard.writeText(`Email: ${result.email}\nPassword: ${result.tempPassword}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (result) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="bg-muted/40 border border-border rounded-2xl p-8 text-center">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={24} className="text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">User Created</h2>
          <p className="text-sm text-muted-foreground mb-6">Share these credentials with the user. The password is shown only once.</p>

          <div className="bg-muted rounded-xl p-4 text-left space-y-2 mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Email</p>
              <p className="text-sm font-mono font-semibold text-foreground">{result.email}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Temporary Password</p>
              <p className="text-sm font-mono font-semibold text-primary">{result.tempPassword}</p>
            </div>
          </div>

          <Button variant="secondary" onClick={copyCredentials} className="mx-auto">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Credentials'}
          </Button>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" nativeButton={false} render={<Link href={`/super-admin/tenants/${tenantId}`} />}>
            Back to Tenant
          </Button>
          <Button className="flex-1" onClick={() => { setResult(null); setEmail(''); }}>
            Create Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" nativeButton={false} render={<Link href={`/super-admin/tenants/${tenantId}`} />}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Create User</h1>
          <p className="text-sm text-muted-foreground">Add a new user to this tenant.</p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-sm font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</label>
          <Input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="h-11"
            placeholder="user@example.com"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Role</label>
          <Select value={role} onValueChange={v => v && setRole(v)}>
            <SelectTrigger className="w-full h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MANAGER">Manager</SelectItem>
              <SelectItem value="MCA">MCA</SelectItem>
              <SelectItem value="NES">NES</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground">A temporary password will be auto-generated and shown once after creation.</p>

        <Button type="submit" disabled={saving} size="lg" className="w-full">
          {saving ? 'Creating...' : 'Create User'}
        </Button>
      </form>
    </div>
  );
}
