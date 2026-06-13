import prisma from '@/lib/prisma';
import Link from 'next/link';
import {
  Building2, Users, Activity, Plus, ArrowRight, GitBranch, Circle, ShoppingCart,
  AlertTriangle, TrendingUp, DollarSign, XCircle, Calendar, BarChart2,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';

function currency(n: number) {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MRR_MAP: Record<string, number> = { free: 0, starter: 99, growth: 299, enterprise: 599 };

export default async function SuperAdminOverview() {
  const fiveMinAgo   = new Date(Date.now() - 5 * 60 * 1000);
  const thirtyDaysAgo  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [
    totalTenants, activeTenants, allTenants, gmvAgg, totalSales, saasUsers,
    newBusinesses, churnedBusinesses, expiringSubscriptions, totalBranches,
    recentLogs, tenants,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { isActive: true } }),
    prisma.tenant.findMany({ select: { subscriptionPlan: true } }),
    prisma.sale.aggregate({ _sum: { totalAmount: true } }),
    prisma.sale.count(),
    prisma.user.count({ where: { isRoleCredential: false, tenantId: { not: null } } }),
    prisma.tenant.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.tenant.count({ where: { isActive: false, NOT: { suspendedAt: null } } }),
    prisma.tenant.count({
      where: { renewalDate: { lte: thirtyDaysFromNow, not: null }, isActive: true },
    }),
    prisma.branch.count(),
    prisma.auditLog.findMany({ take: 10, orderBy: { createdAt: 'desc' } }),
    prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        _count: { select: { users: true } },
        branches: { select: { id: true, name: true, isActive: true } },
        users: { where: { lastActiveAt: { gte: fiveMinAgo } }, select: { id: true } },
      },
    }),
  ]);

  const mrr = allTenants.reduce((sum, t) => sum + (MRR_MAP[t.subscriptionPlan] ?? 0), 0);
  const gmv = gmvAgg._sum.totalAmount ?? 0;

  const stats = [
    { label: 'Total Businesses',       value: totalTenants,            icon: Building2,  sub: `${activeTenants} active`,                  primary: false },
    { label: 'Active Businesses',      value: activeTenants,           icon: Circle,     sub: 'currently active',                         primary: false },
    { label: 'MRR',                    value: currency(mrr),           icon: DollarSign, sub: 'Monthly Recurring Revenue',                primary: true  },
    { label: 'GMV (Transaction Vol.)', value: currency(gmv),           icon: TrendingUp, sub: 'Gross Merchandise Volume',                 primary: true  },
    { label: 'Total Transactions',     value: totalSales,              icon: ShoppingCart, sub: 'POS sales across all tenants',           primary: false },
    { label: 'SaaS Users',             value: saasUsers,               icon: Users,      sub: 'non-credential tenant users',              primary: false },
    { label: 'New Businesses',         value: newBusinesses,           icon: BarChart2,  sub: 'registered in last 30 days',               primary: false },
    { label: 'Churned Businesses',     value: churnedBusinesses,       icon: XCircle,    sub: 'suspended tenants',                        warn: churnedBusinesses > 0 },
    { label: 'Expiring Subscriptions', value: expiringSubscriptions,   icon: AlertTriangle, sub: 'renewing within 30 days',              warn: expiringSubscriptions > 0 },
    { label: 'Total Branches',         value: totalBranches,           icon: GitBranch,  sub: 'across all businesses',                    primary: false },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="System Overview"
        description="Monitor all businesses, branches, users, and system activity."
      >
        <Link
          href="/super-admin/tenants/new"
          className="flex items-center gap-2 px-[13px] py-[9px] rounded-[8px] bg-primary text-primary-foreground text-[12.25px] font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} /> Register Business
        </Link>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((s, i) => (
          <div key={i} className={`bg-card border rounded-2xl p-6 ${
            s.warn
              ? 'border-amber-300 dark:border-amber-500/40'
              : s.primary
              ? 'border-primary/30 bg-primary/5'
              : 'border-border'
          }`}>
            <s.icon size={20} className={`mb-3 ${s.warn ? 'text-amber-500' : s.primary ? 'text-primary' : 'text-primary'}`} />
            <p className="text-xs font-semibold text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.warn ? 'text-amber-600 dark:text-amber-400' : s.primary ? 'text-primary' : 'text-foreground'}`}>
              {s.value}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Tenants Overview */}
      <div className="bg-card border border-border rounded-2xl">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Businesses You Manage</h2>
          <Link
            href="/super-admin/tenants"
            className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
          >
            View all <ArrowRight size={12} />
          </Link>
        </div>
        {tenants.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 size={32} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No businesses yet. Register your first one to get started.</p>
            <Link
              href="/super-admin/tenants/new"
              className="inline-flex items-center gap-2 mt-4 px-[13px] py-[9px] rounded-[8px] bg-primary text-primary-foreground text-[12.25px] font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} /> Register Business
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tenants.map(tenant => (
              <Link key={tenant.id} href={`/super-admin/tenants/${tenant.id}`} className="px-6 py-4 flex items-center gap-4 hover:bg-muted/30 transition-colors cursor-pointer block">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ background: tenant.primaryColor || '#6366f1' }}
                >
                  {tenant.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">{tenant.name}</p>
                    {tenant.businessId && (
                      <code className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                        {tenant.businessId}
                      </code>
                    )}
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
                  <span className="text-xs font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded">
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
