import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { getImpersonation } from '@/lib/auth/getImpersonation';
import prisma from '@/lib/prisma';
import { Package, ShoppingCart } from 'lucide-react';
import Link from 'next/link';

export default async function McaDashboard() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const impersonation = await getImpersonation();
  const isImpersonating = !!impersonation;

  if (!isImpersonating && session.user.role !== 'MCA') redirect('/login');

  const tenantId = isImpersonating ? impersonation.tenantId : session.user.tenantId!;

  const [totalProducts, pendingOrders] = await Promise.all([
    prisma.product.count({ where: { tenantId } }),
    prisma.sale.count({ where: { tenantId, status: 'Pending' } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">MCA Dashboard</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Inventory and order management.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl p-6">
          <Package size={20} className="text-indigo-600 mb-3" />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Total Products</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalProducts}</p>
        </div>
        <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl p-6">
          <ShoppingCart size={20} className="text-emerald-600 mb-3" />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Pending Orders</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{pendingOrders}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/inventory" className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-xl p-4 text-sm font-bold text-center hover:opacity-80 transition-opacity">
          Inventory
        </Link>
        <Link href="/pos" className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-xl p-4 text-sm font-bold text-center hover:opacity-80 transition-opacity">
          Point of Sale
        </Link>
      </div>
    </div>
  );
}
