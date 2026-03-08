import prisma from '@/lib/prisma';
import { Activity } from 'lucide-react';

export default async function AuditLogPage() {
  const logs = await prisma.auditLog.findMany({
    take: 100,
    orderBy: { createdAt: 'desc' },
  });

  // Resolve tenant names for logs that have tenantId
  const tenantIds = [...new Set(logs.map(l => l.tenantId).filter(Boolean))] as string[];
  const tenants = tenantIds.length > 0
    ? await prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true },
      })
    : [];
  const tenantMap = Object.fromEntries(tenants.map(t => [t.id, t.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit Log</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          {logs.length} most recent events across all tenants
        </p>
      </div>

      <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              {['Action', 'User', 'Tenant', 'IP', 'Time'].map(h => (
                <th key={h} className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-3">
                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded">
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-3 text-xs text-slate-600 dark:text-slate-300 font-mono">
                  {log.userId.slice(0, 12)}...
                </td>
                <td className="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {log.tenantId ? (tenantMap[log.tenantId] || log.tenantId.slice(0, 8)) : <span className="text-slate-300 dark:text-slate-600">system</span>}
                </td>
                <td className="px-6 py-3 text-xs text-slate-400 font-mono">
                  {log.ipAddress || '-'}
                </td>
                <td className="px-6 py-3 text-xs text-slate-400">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && (
          <div className="p-12 text-center">
            <Activity size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No audit events recorded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
