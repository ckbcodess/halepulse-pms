'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { LayoutDashboard, Loader2, Check, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/layout/PageHeader';
import { DASHBOARD_WIDGETS } from '@/lib/dashboard/widgets';

const ROLES = ['MANAGER', 'PHARMACIST', 'MCA', 'AUDIT', 'NES'] as const;
type RoleKey = typeof ROLES[number];

export default function DashboardVisibilityPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [hidden, setHidden] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/super-admin/tenants/${tenantId}/dashboard-visibility`)
      .then(r => r.ok ? r.json() : { hidden: {} })
      .then(data => { setHidden(data.hidden ?? {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, [tenantId]);

  const isVisible = (role: RoleKey, key: string) => !(hidden[role] ?? []).includes(key);

  const toggle = (role: RoleKey, key: string) => {
    setHidden(prev => {
      const cur = new Set(prev[role] ?? []);
      if (cur.has(key)) cur.delete(key); else cur.add(key);
      return { ...prev, [role]: Array.from(cur) };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/dashboard-visibility`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Visibility"
        description="Choose which dashboard widgets each role can see. A ticked box means the widget is visible to that role."
      >
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
        </Button>
      </PageHeader>

      <div className="bg-card border border-border rounded-2xl overflow-x-auto">
        <table className="min-w-[640px] w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Widget</th>
              {ROLES.map(r => (
                <th key={r} className="px-4 py-3 text-center font-semibold">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DASHBOARD_WIDGETS.map(w => (
              <tr key={w.key} className="border-t border-border">
                <td className="px-4 py-3">
                  <span className="font-medium text-foreground">{w.label}</span>
                  {w.sensitive && <span className="ml-2 text-[10px] font-bold uppercase text-amber-600">Sensitive</span>}
                </td>
                {ROLES.map(role => {
                  const visible = isVisible(role, w.key);
                  return (
                    <td key={role} className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggle(role, w.key)}
                        title={visible ? 'Visible — click to hide' : 'Hidden — click to show'}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
                          visible
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-600'
                            : 'bg-muted border-border text-muted-foreground'
                        }`}
                      >
                        {visible ? <Eye size={15} /> : <EyeOff size={15} />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-2">
        <LayoutDashboard size={13} /> Changes apply the next time the user loads their dashboard.
      </p>
    </div>
  );
}
