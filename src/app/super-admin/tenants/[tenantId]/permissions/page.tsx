'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Save } from 'lucide-react';

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

  if (loading) return <div className="text-slate-400 text-sm p-6">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Permission Matrix</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Toggle which roles have each permission.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Save size={14} /> {saving ? 'Saving…' : savedMsg || 'Save Changes'}
        </button>
      </div>

      <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Permission</th>
              {ROLES.map(r => (
                <th key={r} className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center w-28">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {categories.map(cat => (
              <>
                <tr key={`cat-${cat}`} className="bg-slate-50/50 dark:bg-slate-900/30">
                  <td colSpan={4} className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{cat}</td>
                </tr>
                {permissions.filter(p => p.category === cat).map(perm => (
                  <tr key={perm.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-3">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{perm.label}</p>
                      <p className="text-xs font-mono text-slate-400">{perm.key}</p>
                    </td>
                    {ROLES.map(role => (
                      <td key={role} className="px-6 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePerms[role].has(perm.key)}
                          onChange={() => toggle(role, perm.key)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
