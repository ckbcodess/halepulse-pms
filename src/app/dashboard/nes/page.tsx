import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { getImpersonation } from '@/lib/auth/getImpersonation';
import prisma from '@/lib/prisma';
import { Package, FileText } from 'lucide-react';
import Link from 'next/link';

export default async function NesDashboard() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const impersonation = await getImpersonation();
  const isImpersonating = !!impersonation;

  if (!isImpersonating && session.user.role !== 'NES') redirect('/login');

  const tenantId = isImpersonating ? impersonation.tenantId : session.user.tenantId!;

  const totalProducts = await prisma.product.count({ where: { tenantId } });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">NES Dashboard</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Read-only access — view inventory and reports.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl p-6">
          <Package size={20} className="text-indigo-600 mb-3" />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Products in System</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalProducts}</p>
        </div>
        <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl p-6">
          <FileText size={20} className="text-slate-500 mb-3" />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Access Level</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">Read Only</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/inventory" className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-xl p-4 text-sm font-bold text-center hover:opacity-80 transition-opacity">
          View Inventory
        </Link>
        <Link href="/reports" className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 rounded-xl p-4 text-sm font-bold text-center hover:opacity-80 transition-opacity">
          Reports
        </Link>
      </div>
    </div>
  );
}
