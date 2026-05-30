'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Users, Package, ShoppingBag, GitBranch, Paintbrush, Shield, Menu,
  UserPlus, Eye, EyeOff, ChevronRight, Circle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';

interface TenantUser {
  id: number;
  email: string | null;
  username: string;
  saasRole: string | null;
  isActive: boolean;
  lastActiveAt: string | null;
  createdAt: string;
  branch: { id: string; name: string } | null;
}

interface TenantDetail {
  id: string;
  name: string;
  subdomain: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { users: number; products: number; sales: number; branches: number };
}

function isOnline(lastActiveAt: string | null) {
  if (!lastActiveAt) return false;
  return Date.now() - new Date(lastActiveAt).getTime() < 5 * 60 * 1000;
}

export default function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/super-admin/tenants/${tenantId}/detail`).then(r => r.json()),
      fetch(`/api/super-admin/tenants/${tenantId}/users`).then(r => r.json()),
    ]).then(([t, u]) => {
      setTenant(t);
      setUsers(Array.isArray(u) ? u : []);
      setLoading(false);
    });
  }, [tenantId]);

  const toggleUser = async (userId: number, isActive: boolean) => {
    await fetch(`/api/super-admin/tenants/${tenantId}/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: !isActive } : u));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading tenant...</div>;
  }

  if (!tenant) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Tenant not found.</div>;
  }

  const onlineCount = users.filter(u => u.isActive && isOnline(u.lastActiveAt)).length;

  const stats = [
    { label: 'Users', value: tenant._count.users, icon: Users, color: 'text-primary' },
    { label: 'Online Now', value: onlineCount, icon: Circle, color: 'text-emerald-500' },
    { label: 'Products', value: tenant._count.products, icon: Package, color: 'text-amber-500' },
    { label: 'Sales', value: tenant._count.sales, icon: ShoppingBag, color: 'text-destructive' },
    { label: 'Branches', value: tenant._count.branches, icon: GitBranch, color: 'text-sky-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold"
            style={{ background: tenant.primaryColor }}
          >
            {tenant.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{tenant.name}</h1>
              <Badge variant={tenant.isActive ? 'success' : 'destructive'}>
                {tenant.isActive ? 'Active' : 'Disabled'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              <code>{tenant.subdomain}</code> &middot; Created {new Date(tenant.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <s.icon size={16} className={`${s.color} mb-2`} />
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Branding', href: `/super-admin/tenants/${tenantId}/branding`, icon: Paintbrush, bg: 'bg-muted text-muted-foreground' },
          { label: 'Permissions', href: `/super-admin/tenants/${tenantId}/permissions`, icon: Shield, bg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
          { label: 'Menus', href: `/super-admin/tenants/${tenantId}/menus`, icon: Menu, bg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300' },
          { label: 'Create User', href: `/super-admin/tenants/${tenantId}/users/new`, icon: UserPlus, bg: 'bg-destructive/10 text-destructive' },
        ].map(a => (
          <Link key={a.href} href={a.href} className={`${a.bg} rounded-xl p-4 flex items-center gap-3 hover:opacity-80 transition-opacity`}>
            <a.icon size={18} />
            <span className="text-sm font-bold">{a.label}</span>
            <ChevronRight size={14} className="ml-auto opacity-50" />
          </Link>
        ))}
      </div>

      {/* View As (Impersonation) */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-bold text-foreground mb-3">View Dashboard As</h3>
        <p className="text-xs text-muted-foreground mb-4">Preview what each role sees in this tenant&apos;s dashboard.</p>
        <div className="flex flex-wrap gap-3">
          {(['MANAGER', 'MCA', 'NES'] as const).map(role => (
            <Button
              key={role}
              variant="secondary"
              nativeButton={false}
              render={<Link href={`/super-admin/impersonate?tenantId=${tenantId}&role=${role}`} />}
            >
              View as {role}
            </Button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Users ({users.length})</h3>
          <Button size="sm" nativeButton={false} render={<Link href={`/super-admin/tenants/${tenantId}/users/new`} />}>
            <UserPlus size={13} /> Add User
          </Button>
        </div>
        <div className="overflow-x-auto">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              {['User', 'Role', 'Branch', 'Status', 'Activity', 'Actions'].map(h => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(user => {
              const online = isOnline(user.lastActiveAt);
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <p className="text-sm font-medium text-foreground">{user.email || user.username}</p>
                    <p className="text-[11px] text-muted-foreground">ID: {user.id}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{user.saasRole || user.username}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {user.branch?.name || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? 'success' : 'destructive'}>
                      {user.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {online ? (
                      <Badge variant="success" className="gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Online
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : 'Never'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleUser(user.id, user.isActive)}
                      title={user.isActive ? 'Disable user' : 'Enable user'}
                    >
                      {user.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
        {users.length === 0 && (
          <div className="p-12 text-center text-muted-foreground text-sm">No users in this tenant yet.</div>
        )}
      </div>
    </div>
  );
}
