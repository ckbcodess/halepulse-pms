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
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={24} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">User Created</h2>
          <p className="text-sm text-slate-500 mb-6">Share these credentials with the user. The password is shown only once.</p>

          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 text-left space-y-2 mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Email</p>
              <p className="text-sm font-mono font-semibold text-slate-900 dark:text-white">{result.email}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Temporary Password</p>
              <p className="text-sm font-mono font-semibold text-indigo-600 dark:text-indigo-400">{result.tempPassword}</p>
            </div>
          </div>

          <button
            onClick={copyCredentials}
            className="flex items-center gap-2 mx-auto px-4 py-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Credentials'}
          </button>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/super-admin/tenants/${tenantId}`}
            className="flex-1 text-center px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-300 rounded-lg hover:opacity-80 transition-opacity"
          >
            Back to Tenant
          </Link>
          <button
            onClick={() => { setResult(null); setEmail(''); }}
            className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
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
        <Link href={`/super-admin/tenants/${tenantId}`} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Create User</h1>
          <p className="text-sm text-slate-400">Add a new user to this tenant.</p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 p-4 rounded-xl text-sm font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
            placeholder="user@pharmacy.com"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Role</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
          >
            <option value="MANAGER">Manager — Full access</option>
            <option value="MCA">MCA — Inventory &amp; orders</option>
            <option value="NES">NES — Read only</option>
          </select>
        </div>

        <p className="text-xs text-slate-400">A temporary password will be auto-generated and shown once after creation.</p>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 rounded-lg transition-colors"
        >
          {saving ? 'Creating...' : 'Create User'}
        </button>
      </form>
    </div>
  );
}
