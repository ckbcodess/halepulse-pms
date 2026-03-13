import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { getImpersonation } from '@/lib/auth/getImpersonation';
import prisma from '@/lib/prisma';
import { Package, AlertCircle, Calendar, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default async function ManagerDashboard() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const impersonation = await getImpersonation();
  const isImpersonating = !!impersonation;

  if (!isImpersonating && session.user.role !== 'MANAGER') redirect('/login');

  const tenantId = isImpersonating ? impersonation.tenantId : session.user.tenantId!;

  const [totalProducts, lowStock, salesToday] = await Promise.all([
    prisma.product.count({ where: { tenantId } }),
    prisma.product.count({ where: { tenantId, stockQty: { lte: 5 } } }),
    prisma.sale.aggregate({
      _sum:  { totalAmount: true },
      where: { tenantId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
  ]);

  const recentSales = await prisma.sale.findMany({
    where:   { tenantId },
    take:    5,
    orderBy: { createdAt: 'desc' },
    include: { customer: true, items: true },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold text-card-foreground">Manager Dashboard</h2>
        <p className="text-muted-foreground mt-1">Full access — all modules available.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Products', value: totalProducts, icon: Package,     color: 'text-indigo-600' },
          { label: 'Low Stock',      value: lowStock,      icon: AlertCircle, color: 'text-amber-600'  },
          { label: 'Sales Today',    value: `₵${(salesToday._sum.totalAmount ?? 0).toFixed(2)}`, icon: ShoppingBag, color: 'text-emerald-600' },
          { label: 'Active Alerts',  value: lowStock,      icon: Calendar,    color: 'text-rose-600'   },
        ].map((s, i) => (
          <Card key={i} className="py-0 gap-0">
            <div className="p-6">
              <s.icon className={`size-5 ${s.color} mb-3`} />
              <p className="text-xs font-semibold text-muted-foreground mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-card-foreground">{s.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Point of Sale',  href: '/pos',       bg: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' },
          { label: 'Inventory',      href: '/inventory', bg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
          { label: 'Customers',      href: '/customers', bg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300' },
          { label: 'Users',          href: '/users',     bg: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300' },
        ].map((link) => (
          <Link key={link.href} href={link.href} className={`${link.bg} rounded-xl p-4 text-sm font-bold text-center hover:opacity-80 transition-opacity`}>
            {link.label}
          </Link>
        ))}
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {recentSales.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="flex flex-col">
              {recentSales.map((sale, idx) => (
                <div key={sale.id}>
                  {idx > 0 && <Separator />}
                  <div className="flex justify-between items-center py-3">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">
                        {sale.customer?.name ?? 'Walk-in'}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(sale.createdAt).toLocaleTimeString()} · {sale.items.length} items</p>
                    </div>
                    <p className="font-semibold text-card-foreground">₵{sale.totalAmount.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
