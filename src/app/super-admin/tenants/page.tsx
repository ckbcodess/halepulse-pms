import prisma from '@/lib/prisma';
import Link from 'next/link';
import { Plus, Settings, Eye } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';

export default async function TenantsPage() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Tenants" description={`${tenants.length} registered tenants`}>
        <Button render={<Link href="/super-admin/tenants/new" />}>
          <Plus size={16} /> New Tenant
        </Button>
      </PageHeader>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <Table className="min-w-[680px]">
          <TableHeader>
            <TableRow>
              {['Tenant', 'Subdomain', 'Users', 'Status', 'Created', 'Actions'].map(h => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map(tenant => (
              <TableRow key={tenant.id}>
                <TableCell>
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
                </TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-2 py-1 rounded text-foreground">
                    {tenant.subdomain}
                  </code>
                </TableCell>
                <TableCell className="text-foreground">{tenant._count.users}</TableCell>
                <TableCell>
                  <Badge variant={tenant.isActive ? 'success' : 'destructive'}>
                    {tenant.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{new Date(tenant.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" render={<Link href={`/super-admin/tenants/${tenant.id}/branding`} />}>
                      <Eye size={14} />
                    </Button>
                    <Button variant="ghost" size="icon-sm" render={<Link href={`/super-admin/tenants/${tenant.id}/permissions`} />}>
                      <Settings size={14} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        {tenants.length === 0 && (
          <div className="p-12 text-center text-muted-foreground text-sm">No tenants yet. Create your first one.</div>
        )}
      </div>
    </div>
  );
}
