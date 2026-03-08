import prisma from '@/lib/prisma';
import Link from 'next/link';
import { Plus, Settings, Eye } from 'lucide-react';

export default async function TenantsPage() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tenants</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{tenants.length} registered tenants</p>
        </div>
        <Link
          href="/super-admin/tenants/new"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus size={16} /> New Tenant
        </Link>
      </div>

      <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              {['Tenant', 'Subdomain', 'Users', 'Status', 'Created', 'Actions'].map(h => (
                <th key={h} className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {tenants.map(tenant => (
              <tr key={tenant.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: tenant.primaryColor }}
                    >
                      {tenant.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{tenant.name}</p>
                      <p className="text-xs text-slate-400">{tenant.id.slice(0, 8)}…</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-700 dark:text-slate-300">
                    {tenant.subdomain}
                  </code>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{tenant._count.users}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    tenant.isActive
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400'
                  }`}>
                    {tenant.isActive ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-slate-400">{new Date(tenant.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Link href={`/super-admin/tenants/${tenant.id}/branding`} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500">
                      <Eye size={14} />
                    </Link>
                    <Link href={`/super-admin/tenants/${tenant.id}/permissions`} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500">
                      <Settings size={14} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tenants.length === 0 && (
          <div className="p-12 text-center text-slate-400 text-sm">No tenants yet. Create your first one.</div>
        )}
      </div>
    </div>
  );
}
