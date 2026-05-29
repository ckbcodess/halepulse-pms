'use client';
import { Fragment, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Save } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';

const ROLES = ['MANAGER', 'MCA', 'NES'] as const;
type Role = typeof ROLES[number];

interface Permission { id: string; key: string; label: string; category: string; }
interface RolePermission { role: Role; permissionKey: string; }

export default function PermissionsMatrix() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [permissions,     setPermissions]     = useState<Permission[]>([]);
  const [rolePerms,       setRolePerms]       = useState<Record<Role, Set<string>>>({ MANAGER: new Set(), MCA: new Set(), NES: new Set() });
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [savedMsg,        setSavedMsg]        = useState('');

  useEffect(() => {
    fetch(`/api/super-admin/tenants/${tenantId}/permissions`)
      .then(r => r.json())
      .then(({ permissions: perms, rolePermissions: rp }: { permissions: Permission[]; rolePermissions: RolePermission[] }) => {
        setPermissions(perms);
        const map: Record<Role, Set<string>> = { MANAGER: new Set(), MCA: new Set(), NES: new Set() };
        rp.forEach(r => { if (r.role in map) map[r.role as Role].add(r.permissionKey); });
        setRolePerms(map);
        setLoading(false);
      });
  }, [tenantId]);

  const toggle = (role: Role, key: string) => {
    setRolePerms(prev => {
      const next = { ...prev, [role]: new Set(prev[role]) };
      next[role].has(key) ? next[role].delete(key) : next[role].add(key);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const body = Object.fromEntries(ROLES.map(r => [r, [...rolePerms[r]]]));
    await fetch(`/api/super-admin/tenants/${tenantId}/permissions`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    setSaving(false);
    setSavedMsg('Saved!');
    setTimeout(() => setSavedMsg(''), 2000);
  };

  const categories = [...new Set(permissions.map(p => p.category))];

  if (loading) return <div className="text-muted-foreground text-sm p-6">Loading…</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Permission Matrix" description="Toggle which roles have each permission.">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground text-sm font-semibold rounded-lg transition-colors"
        >
          <Save size={14} /> {saving ? 'Saving…' : savedMsg || 'Save Changes'}
        </button>
      </PageHeader>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[560px]">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Permission</th>
              {ROLES.map(r => (
                <th key={r} className="px-6 py-3 text-sm font-medium text-muted-foreground text-center w-28">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {categories.map(cat => (
              <Fragment key={`cat-${cat}`}>
                <tr className="bg-muted/30">
                  <td colSpan={4} className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{cat}</td>
                </tr>
                {permissions.filter(p => p.category === cat).map(perm => (
                  <tr key={perm.id} className="transition-colors">
                    <td className="px-6 py-3">
                      <p className="text-sm font-medium text-foreground">{perm.label}</p>
                      <p className="text-xs font-mono text-muted-foreground">{perm.key}</p>
                    </td>
                    {ROLES.map(role => (
                      <td key={role} className="px-6 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePerms[role].has(perm.key)}
                          onChange={() => toggle(role, perm.key)}
                          className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
