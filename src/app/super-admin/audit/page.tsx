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
        <h1 className="text-2xl font-bold text-foreground dark:text-white">Audit Log</h1>
        <p className="text-muted-foreground dark:text-muted-foreground mt-1">
          {logs.length} most recent events across all tenants
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#f9f9f9] dark:bg-muted/50 border-b border-border">
            <tr>
              {['Action', 'User', 'Tenant', 'IP', 'Time'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.map(log => (
              <tr key={log.id} className="transition-colors">
                <td className="px-6 py-3">
                  <span className="text-xs font-mono font-bold text-primary dark:text-primary/80 bg-indigo-50 dark:bg-primary/10 px-2 py-0.5 rounded">
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-3 text-xs text-muted-foreground dark:text-muted-foreground font-mono">
                  {log.userId.slice(0, 12)}...
                </td>
                <td className="px-6 py-3 text-xs text-muted-foreground dark:text-muted-foreground">
                  {log.tenantId ? (tenantMap[log.tenantId] || log.tenantId.slice(0, 8)) : <span className="text-muted-foreground dark:text-muted-foreground">system</span>}
                </td>
                <td className="px-6 py-3 text-xs text-muted-foreground font-mono">
                  {log.ipAddress || '-'}
                </td>
                <td className="px-6 py-3 text-xs text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && (
          <div className="p-12 text-center">
            <Activity size={32} className="text-muted-foreground dark:text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
