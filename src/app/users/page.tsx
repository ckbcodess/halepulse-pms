import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { getImpersonation } from '@/lib/auth/getImpersonation';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { Users, ShieldCheck, Clock, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

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

  const roleColors: Record<string, string> = {
    MANAGER:    'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
    MCA:        'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    NES:        'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
    SUPER_ADMIN:'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Team</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {tenant?.name ?? 'Your pharmacy'} · {users.length} user{users.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Users',   value: users.length,                                      icon: Users,        color: 'text-indigo-600' },
          { label: 'Online Now',    value: onlineCount,                                        icon: Clock,        color: 'text-emerald-600' },
          { label: 'Active',        value: users.filter(u => u.isActive).length,               icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Inactive',      value: users.filter(u => !u.isActive).length,              icon: XCircle,      color: 'text-rose-600' },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl p-5">
            <s.icon size={18} className={`${s.color} mb-3`} />
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">All Users</h3>
          <ShieldCheck size={16} className="text-slate-400" />
        </div>

        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No users found for this tenant.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">User</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Role</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Branch</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {users.map(user => {
                  const isOnline = user.lastActiveAt && new Date(user.lastActiveAt) >= fiveMinAgo;
                  const initials = (user.email ?? user.username ?? 'U')
                    .split('@')[0]
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                              {initials}
                            </div>
                            {isOnline && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#18181b] rounded-full" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                              {user.email ?? user.username}
                            </p>
                            {user.email && user.username && (
                              <p className="text-xs text-slate-400">{user.username}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${roleColors[user.saasRole ?? ''] ?? 'bg-slate-100 text-slate-600'}`}>
                          {user.saasRole}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {user.branch?.name ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 size={12} /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                            <XCircle size={12} /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-slate-400">
                        {isOnline ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Online now</span>
                        ) : user.lastActiveAt ? (
                          new Date(user.lastActiveAt).toLocaleString()
                        ) : (
                          'Never'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 text-center">
        To create or modify users, contact your system administrator.
      </p>
    </div>
  );
}
