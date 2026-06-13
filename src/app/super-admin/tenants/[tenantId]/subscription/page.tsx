'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CreditCard, RefreshCw, ShieldOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/layout/PageHeader';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';

interface SubscriptionData {
  subscriptionPlan: string;
  maxBranches: number;
  maxUsers: number;
  renewalDate: string | null;
  suspendedAt: string | null;
  suspendReason: string | null;
  isActive: boolean;
}

const PLANS = ['starter', 'growth', 'enterprise'] as const;
const PLAN_LABELS: Record<string, string> = { starter: 'Starter', growth: 'Growth', enterprise: 'Enterprise' };
const PLAN_COLORS: Record<string, string> = {
  starter: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300',
  growth: 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300',
  enterprise: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
};

export default function SubscriptionPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [suspendReason, setSuspendReason] = useState('');

  const [form, setForm] = useState({
    plan: 'starter',
    maxBranches: 1,
    maxUsers: 5,
    renewalDate: '',
  });

  useEffect(() => {
    fetch(`/api/super-admin/tenants/${tenantId}/subscription`)
      .then(r => r.json())
      .then((d: SubscriptionData) => {
        setData(d);
        setForm({
          plan: d.subscriptionPlan,
          maxBranches: d.maxBranches,
          maxUsers: d.maxUsers,
          renewalDate: d.renewalDate ? d.renewalDate.slice(0, 10) : '',
        });
        setLoading(false);
      });
  }, [tenantId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    const res = await fetch(`/api/super-admin/tenants/${tenantId}/subscription`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: form.plan,
        maxBranches: form.maxBranches,
        maxUsers: form.maxUsers,
        renewalDate: form.renewalDate || null,
      }),
    });
    const updated = await res.json();
    if (!res.ok) { setError(updated.error ?? 'Failed to save'); }
    else { setSuccess('Subscription updated successfully.'); setData(prev => prev ? { ...prev, subscriptionPlan: updated.subscriptionPlan ?? prev.subscriptionPlan, maxBranches: updated.maxBranches ?? prev.maxBranches, maxUsers: updated.maxUsers ?? prev.maxUsers, renewalDate: updated.renewalDate ?? prev.renewalDate } : prev); }
    setSaving(false);
  };

  const handleSuspend = async () => {
    if (!data) return;
    setSuspending(true);
    setError('');
    setSuccess('');
    const action = data.isActive ? 'suspend' : 'reactivate';
    const res = await fetch(`/api/super-admin/tenants/${tenantId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason: suspendReason || undefined }),
    });
    const result = await res.json();
    if (!res.ok) { setError(result.error ?? 'Failed'); }
    else {
      setSuccess(`Business ${action === 'suspend' ? 'suspended' : 'reactivated'} successfully.`);
      setData(prev => prev ? { ...prev, isActive: result.isActive, suspendedAt: result.suspendedAt, suspendReason: result.suspendReason } : prev);
      setSuspendReason('');
    }
    setSuspending(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!data) return <div className="p-8 text-muted-foreground">Subscription data not found.</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Subscription" description="Manage plan, limits, and account status." />

      {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 p-4 rounded-lg text-sm">{success}</div>}

      {/* Current Status */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <CreditCard size={20} className="text-primary" />
          <h3 className="text-base font-semibold text-foreground">Current Subscription</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Plan</p>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${PLAN_COLORS[data.subscriptionPlan] ?? 'bg-muted text-muted-foreground'}`}>
              {PLAN_LABELS[data.subscriptionPlan] ?? data.subscriptionPlan}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Max Branches</p>
            <p className="text-2xl font-bold text-foreground">{data.maxBranches}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Max Users</p>
            <p className="text-2xl font-bold text-foreground">{data.maxUsers}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            <Badge variant={data.isActive ? 'success' : 'destructive'}>
              {data.isActive ? 'Active' : data.suspendedAt ? 'Suspended' : 'Inactive'}
            </Badge>
          </div>
        </div>
        {data.renewalDate && (
          <p className="text-xs text-muted-foreground">
            Renewal Date: <span className="font-medium text-foreground">{new Date(data.renewalDate).toLocaleDateString()}</span>
          </p>
        )}
        {data.suspendedAt && (
          <p className="text-xs text-rose-600 dark:text-rose-400">
            Suspended: {new Date(data.suspendedAt).toLocaleString()}{data.suspendReason ? ` — ${data.suspendReason}` : ''}
          </p>
        )}
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSave} className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <h3 className="text-sm font-semibold text-foreground">Update Plan &amp; Limits</h3>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan</label>
          <Select value={form.plan} onValueChange={(v) => setForm(p => ({ ...p, plan: v ?? p.plan }))}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLANS.map(p => (
                <SelectItem key={p} value={p}>{PLAN_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Max Branches</label>
            <Input
              type="number"
              min={1}
              value={form.maxBranches}
              onChange={e => setForm(p => ({ ...p, maxBranches: parseInt(e.target.value) || 1 }))}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Max Users</label>
            <Input
              type="number"
              min={1}
              value={form.maxUsers}
              onChange={e => setForm(p => ({ ...p, maxUsers: parseInt(e.target.value) || 1 }))}
              className="h-10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Renewal Date</label>
          <Input
            type="date"
            value={form.renewalDate}
            onChange={e => setForm(p => ({ ...p, renewalDate: e.target.value }))}
            className="h-10"
          />
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          <RefreshCw size={14} className={saving ? 'animate-spin' : ''} />
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </form>

      {/* Suspend / Reactivate */}
      <div className={`bg-card border rounded-2xl p-6 space-y-4 ${data.isActive ? 'border-rose-200 dark:border-rose-500/30' : 'border-emerald-200 dark:border-emerald-500/30'}`}>
        <h3 className="text-sm font-semibold text-foreground">
          {data.isActive ? 'Suspend Business' : 'Reactivate Business'}
        </h3>
        {data.isActive && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reason (optional)</label>
            <Input
              value={suspendReason}
              onChange={e => setSuspendReason(e.target.value)}
              placeholder="Non-payment, violation, etc."
              className="h-10"
            />
          </div>
        )}
        <Button
          type="button"
          variant={data.isActive ? 'destructive' : 'default'}
          disabled={suspending}
          onClick={handleSuspend}
          className="w-full"
        >
          {data.isActive ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
          {suspending ? 'Processing…' : data.isActive ? 'Suspend Business' : 'Reactivate Business'}
        </Button>
      </div>
    </div>
  );
}
