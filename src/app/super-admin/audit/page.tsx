import prisma from '@/lib/prisma';
import { Activity } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';

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
      <PageHeader
        title="Audit Log"
        description={`${logs.length} most recent events across all tenants`}
      />

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              {['Action', 'User', 'Tenant', 'IP', 'Time'].map(h => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map(log => (
              <TableRow key={log.id}>
                <TableCell>
                  <Badge variant="secondary" className="font-mono">{log.action}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">
                  {log.userId.slice(0, 12)}...
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {log.tenantId ? (tenantMap[log.tenantId] || log.tenantId.slice(0, 8)) : 'system'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">
                  {log.ipAddress || '-'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        {logs.length === 0 && (
          <div className="p-12 text-center">
            <Activity size={32} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
