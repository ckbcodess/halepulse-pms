import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { getImpersonation } from '@/lib/auth/getImpersonation';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { Users, ShieldCheck, Clock, CheckCircle2, XCircle } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const impersonation = await getImpersonation();
  const isImpersonating = !!impersonation;

  const role = session.user.role;
  if (!isImpersonating && role !== 'MANAGER' && role !== 'SUPER_ADMIN') {
    redirect('/');
  }

  const tenantId = impersonation?.tenantId ?? session.user.tenantId ?? null;
  if (!tenantId) redirect('/');

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: { tenantId, saasRole: { not: null } },
    include: { branch: { select: { name: true } } },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
  });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });

  const onlineCount = users.filter(
    u => u.lastActiveAt && new Date(u.lastActiveAt) >= fiveMinAgo
  ).length;

  const roleBadgeClass: Record<string, string> = {
    MANAGER:    'border-indigo-200/50 bg-indigo-50/50 text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400',
    PHARMACIST: 'border-sky-200/50 bg-sky-50/50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-400',
    MCA:        'border-emerald-200/50 bg-emerald-50/50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400',
    AUDIT:      'border-amber-200/50 bg-amber-50/50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400',
    NES:        'border-amber-200/50 bg-amber-50/50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400',
    SUPER_ADMIN:'border-purple-200/50 bg-purple-50/50 text-purple-700 dark:border-purple-500/20 dark:bg-purple-500/10 dark:text-purple-400',
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Team"
        description={`${tenant?.name ?? 'Your pharmacy'} · ${users.length} user${users.length !== 1 ? 's' : ''}`}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Users',   value: users.length,                             icon: Users,        color: 'text-primary' },
          { label: 'Online Now',    value: onlineCount,                               icon: Clock,        color: 'text-emerald-600' },
          { label: 'Active',        value: users.filter(u => u.isActive).length,      icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Inactive',      value: users.filter(u => !u.isActive).length,     icon: XCircle,      color: 'text-destructive' },
        ].map((s, i) => (
          <Card key={i} className="py-0 gap-0">
            <div className="p-5">
              <s.icon className={`size-4 ${s.color} mb-3`} />
              <p className="text-xs font-semibold text-muted-foreground mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-card-foreground">{s.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>All Users</CardTitle>
          <ShieldCheck className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="px-0">
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground px-4">
              <Users className="size-8 mb-2 opacity-30" />
              <p className="text-sm">No users found for this tenant.</p>
            </div>
          ) : (
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6">User</TableHead>
                  <TableHead className="px-6">Role</TableHead>
                  <TableHead className="px-6">Branch</TableHead>
                  <TableHead className="px-6">Status</TableHead>
                  <TableHead className="px-6 text-right">Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => {
                  const isOnline = user.lastActiveAt && new Date(user.lastActiveAt) >= fiveMinAgo;
                  const initials = (user.email ?? user.username ?? 'U')
                    .split('@')[0]
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar>
                              <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            {isOnline && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-background rounded-full" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-card-foreground">
                              {user.email ?? user.username}
                            </p>
                            {user.email && user.username && (
                              <p className="text-xs text-muted-foreground">{user.username}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold uppercase tracking-wider ${roleBadgeClass[user.saasRole ?? ''] ?? 'border-border bg-muted text-muted-foreground'}`}
                        >
                          {user.saasRole}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                        {user.branch?.name ?? <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                            <XCircle className="size-3" /> Inactive
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right text-xs text-muted-foreground">
                        {isOnline ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Online now</span>
                        ) : user.lastActiveAt ? (
                          new Date(user.lastActiveAt).toLocaleString()
                        ) : (
                          'Never'
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        To create or modify users, contact your system administrator.
      </p>
    </div>
  );
}
