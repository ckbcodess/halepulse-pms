import prisma from '@/lib/prisma';
import Link from 'next/link';
import { Plus, Settings, Eye } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';

export default async function TenantsPage() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Tenants" description={`${tenants.length} registered tenants`}>
        <Link
          href="/super-admin/tenants/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus size={16} /> New Tenant
        </Link>
      </PageHeader>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[680px]">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              {['Tenant', 'Subdomain', 'Users', 'Status', 'Created', 'Actions'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tenants.map(tenant => (
              <tr key={tenant.id} className="transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: tenant.primaryColor }}
                    >
                      {tenant.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{tenant.name}</p>
                      <p className="text-xs text-muted-foreground">{tenant.id.slice(0, 8)}…</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <code className="text-xs bg-muted px-2 py-1 rounded text-foreground">
                    {tenant.subdomain}
                  </code>
                </td>
                <td className="px-6 py-4 text-sm text-foreground">{tenant._count.users}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    tenant.isActive
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400'
                  }`}>
                    {tenant.isActive ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-muted-foreground">{new Date(tenant.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Link href={`/super-admin/tenants/${tenant.id}/branding`} className="p-1.5 hover:bg-muted dark:hover:bg-sidebar rounded-lg transition-colors text-muted-foreground">
                      <Eye size={14} />
                    </Link>
                    <Link href={`/super-admin/tenants/${tenant.id}/permissions`} className="p-1.5 hover:bg-muted dark:hover:bg-sidebar rounded-lg transition-colors text-muted-foreground">
                      <Settings size={14} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {tenants.length === 0 && (
          <div className="p-12 text-center text-muted-foreground text-sm">No tenants yet. Create your first one.</div>
        )}
      </div>
    </div>
  );
}
