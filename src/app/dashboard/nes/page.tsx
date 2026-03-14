import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { getImpersonation } from '@/lib/auth/getImpersonation';
import prisma from '@/lib/prisma';
import { Package, AlertCircle, Clock, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';

export default async function NesDashboard() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const impersonation = await getImpersonation();
  const isImpersonating = !!impersonation;

  if (!isImpersonating && session.user.role !== 'NES') redirect('/login');

  const tenantId = isImpersonating ? impersonation.tenantId : session.user.tenantId!;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [totalProducts, lowStock, expiringSoon, salesToday] = await Promise.all([
    prisma.product.count({ where: { tenantId } }),
    prisma.product.count({ where: { tenantId, stockQty: { lte: 5 } } }),
    prisma.product.count({
      where: { tenantId, expiryDate: { gt: new Date(), lte: in30Days } },
    }),
    prisma.sale.aggregate({
      _sum:   { totalAmount: true },
      _count: true,
      where:  { tenantId, createdAt: { gte: todayStart } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold text-card-foreground">NES Dashboard</h2>
        <p className="text-muted-foreground mt-1">Read-only access — view inventory and reports.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="py-0 gap-0">
          <div className="p-6">
            <Package className="size-5 text-indigo-600 mb-3" />
            <p className="text-xs font-semibold text-muted-foreground mb-1">Products in System</p>
            <p className="text-2xl font-bold text-card-foreground">{totalProducts}</p>
          </div>
        </Card>
        <Card className="py-0 gap-0">
          <div className="p-6">
            <AlertCircle className="size-5 text-amber-600 mb-3" />
            <p className="text-xs font-semibold text-muted-foreground mb-1">Low Stock</p>
            <p className="text-2xl font-bold text-card-foreground">{lowStock}</p>
          </div>
        </Card>
        <Card className="py-0 gap-0">
          <div className="p-6">
            <Clock className="size-5 text-rose-600 mb-3" />
            <p className="text-xs font-semibold text-muted-foreground mb-1">Expiring Soon</p>
            <p className="text-2xl font-bold text-card-foreground">{expiringSoon}</p>
          </div>
        </Card>
        <Card className="py-0 gap-0">
          <div className="p-6">
            <ShoppingBag className="size-5 text-emerald-600 mb-3" />
            <p className="text-xs font-semibold text-muted-foreground mb-1">Sales Today</p>
            <p className="text-2xl font-bold text-card-foreground">
              ₵{(salesToday._sum.totalAmount ?? 0).toFixed(2)}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/inventory" className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-xl p-4 text-sm font-bold text-center hover:opacity-80 transition-opacity">
          View Inventory
        </Link>
        <Link href="/reports" className="bg-muted text-muted-foreground rounded-xl p-4 text-sm font-bold text-center hover:opacity-80 transition-opacity">
          Reports
        </Link>
      </div>
    </div>
  );
}
