'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import Link from 'next/link';

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
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={24} className="text-primary" />
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

          <button
            onClick={copyCredentials}
            className="flex items-center gap-2 mx-auto px-4 py-2 bg-sidebar dark:bg-white dark:text-foreground text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Credentials'}
          </button>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/super-admin/tenants/${tenantId}`}
            className="flex-1 text-center px-4 py-2.5 bg-muted text-sm font-semibold text-muted-foreground rounded-lg hover:opacity-80 transition-opacity"
          >
            Back to Tenant
          </Link>
          <button
            onClick={() => { setResult(null); setEmail(''); }}
            className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg transition-colors"
          >
            Create Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/super-admin/tenants/${tenantId}`} className="p-2 hover:bg-accent rounded-lg transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Create User</h1>
          <p className="text-sm text-muted-foreground">Add a new user to this tenant.</p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 p-4 rounded-xl text-sm font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
            placeholder="user@example.com"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Role</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full px-4 py-3 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          >
            <option value="MANAGER">Manager</option>
            <option value="MCA">MCA</option>
            <option value="NES">NES</option>
          </select>
        </div>

        <p className="text-xs text-muted-foreground">A temporary password will be auto-generated and shown once after creation.</p>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white font-bold py-3 rounded-lg transition-colors"
        >
          {saving ? 'Creating...' : 'Create User'}
        </button>
      </form>
    </div>
  );
}
