'use client';
import { Fragment, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Save } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';

const ROLES = ['MANAGER', 'PHARMACIST', 'MCA', 'AUDIT'] as const;
type Role = typeof ROLES[number];

interface Permission { id: string; key: string; label: string; category: string; }
interface RolePermission { role: Role; permissionKey: string; }

export default function PermissionsMatrix() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [permissions,     setPermissions]     = useState<Permission[]>([]);
  const [rolePerms,       setRolePerms]       = useState<Record<Role, Set<string>>>({ MANAGER: new Set(), PHARMACIST: new Set(), MCA: new Set(), AUDIT: new Set() });
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [savedMsg,        setSavedMsg]        = useState('');

  useEffect(() => {
    fetch(`/api/super-admin/tenants/${tenantId}/permissions`)
      .then(r => r.json())
      .then(({ permissions: perms, rolePermissions: rp }: { permissions: Permission[]; rolePermissions: RolePermission[] }) => {
        setPermissions(perms);
        const map: Record<Role, Set<string>> = { MANAGER: new Set(), PHARMACIST: new Set(), MCA: new Set(), AUDIT: new Set() };
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
        <Button onClick={handleSave} disabled={saving}>
          <Save size={14} /> {saving ? 'Saving…' : savedMsg || 'Save Changes'}
        </Button>
      </PageHeader>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow>
              <TableHead>Permission</TableHead>
              {ROLES.map(r => (
                <TableHead key={r} className="text-center w-28">{r}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map(cat => (
              <Fragment key={`cat-${cat}`}>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={4} className="py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{cat}</TableCell>
                </TableRow>
                {permissions.filter(p => p.category === cat).map(perm => (
                  <TableRow key={perm.id}>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">{perm.label}</p>
                      <p className="text-xs font-mono text-muted-foreground">{perm.key}</p>
                    </TableCell>
                    {ROLES.map(role => (
                      <TableCell key={role} className="text-center">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={rolePerms[role].has(perm.key)}
                            onCheckedChange={() => toggle(role, perm.key)}
                          />
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  );
}
