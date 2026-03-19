import prisma from '@/lib/prisma';
import Link from 'next/link';
import { Building2, Users, Activity, Eye, Settings, Plus, ArrowRight, GitBranch, Circle } from 'lucide-react';

export default async function SuperAdminOverview() {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  const [totalTenants, totalUsers, onlineUsers, totalAuditLogs, recentLogs, tenants] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count({ where: { saasRole: { not: null } } }),
    prisma.user.count({ where: { saasRole: { not: null }, lastActiveAt: { gte: fiveMinAgo } } }),
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      take:    10,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { users: true } },
        branches: { select: { id: true, name: true, isActive: true } },
        users: { where: { lastActiveAt: { gte: fiveMinAgo } }, select: { id: true } },
      },
    }),
  ]);

  const activeTenants = tenants.filter(t => t.isActive).length;

  const stats = [
    { label: 'Total Tenants',  value: totalTenants,   icon: Building2, sub: `${activeTenants} active` },
    { label: 'SaaS Users',     value: totalUsers,     icon: Users,     sub: 'across all tenants' },
    { label: 'Online Now',     value: onlineUsers,    icon: Circle,    sub: 'active in last 5 min' },
    { label: 'Audit Events',   value: totalAuditLogs, icon: Activity,  sub: 'total logged' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Overview</h1>
          <p className="text-muted-foreground mt-1">Monitor all tenants, users, and system activity.</p>
        </div>
        <Link
          href="/super-admin/tenants/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus size={16} /> New Tenant
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-6">
            <s.icon size={20} className="text-primary mb-3" />
            <p className="text-xs font-semibold text-muted-foreground mb-1">{s.label}</p>
            <p className="text-3xl font-bold text-foreground">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Tenants Overview */}
      <div className="bg-card border border-border rounded-2xl">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Tenants You Manage</h2>
          <Link
            href="/super-admin/tenants"
            className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
          >
            View all <ArrowRight size={12} />
          </Link>
        </div>
        {tenants.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 size={32} className="text-muted-foreground dark:text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No tenants yet. Create your first tenant to get started.</p>
            <Link
              href="/super-admin/tenants/new"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg transition-colors"
            >
              <Plus size={16} /> Create Tenant
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tenants.map(tenant => (
              <Link key={tenant.id} href={`/super-admin/tenants/${tenant.id}`} className="px-6 py-4 flex items-center gap-4 hover:bg-muted/30 transition-colors cursor-pointer block">
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ background: tenant.primaryColor || '#6366f1' }}
                >
                  {tenant.name.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{tenant.name}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      tenant.isActive
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400'
                    }`}>
                      {tenant.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <code className="text-[11px] text-muted-foreground">{tenant.subdomain}</code>
                    <span className="text-[11px] text-muted-foreground">{tenant._count.users} user{tenant._count.users !== 1 ? 's' : ''}</span>
                    {tenant.users.length > 0 && (
                      <span className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {tenant.users.length} online
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <ArrowRight size={16} className="text-muted-foreground flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Audit Logs */}
      <div className="bg-card border border-border rounded-2xl">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Recent Audit Events</h2>
        </div>
        {recentLogs.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No audit events yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {recentLogs.map(log => (
              <div key={log.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {log.action}
                  </span>
                  <span className="text-xs text-muted-foreground ml-3">user:{log.userId}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
