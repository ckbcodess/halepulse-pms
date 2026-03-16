import prisma from '@/lib/prisma';
import { Package, AlertCircle, Calendar, ShoppingBag, Plus, TrendingUp, ArrowUpRight } from "lucide-react";
import Link from 'next/link';

export default async function Dashboard() {
  const totalProducts = await prisma.product.count();
  const lowStock = await prisma.product.count({ where: { stockQty: { lte: 5 } } });

  const threeMonthsFromNow = new Date();
  threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

  const expiringSoon = await prisma.product.count({
    where: {
      expiryDate: {
        lte: threeMonthsFromNow,
        gt: new Date(),
      },
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const salesToday = await prisma.sale.aggregate({
    _sum: { totalAmount: true },
    where: { createdAt: { gte: today } }
  });

  const recentSales = await prisma.sale.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { customer: true, items: { include: { product: true } } }
  });

  const totalRevenue = salesToday._sum.totalAmount || 0;

  const stats = [
    { title: "Total Inventory", value: totalProducts.toLocaleString(), icon: Package, accent: false },
    { title: "Low Stock", value: lowStock.toLocaleString(), icon: AlertCircle, accent: lowStock > 0, warning: true },
    { title: "Expiring Soon", value: expiringSoon.toLocaleString(), icon: Calendar, accent: expiringSoon > 0, warning: true },
    { title: "Revenue Today", value: `₵${totalRevenue.toFixed(2)}`, icon: TrendingUp, accent: false, trend: "+12.5%" },
  ];

  return (
    <div className="space-y-6">

      {/* Empty state */}
      {totalProducts === 0 && (
        <div className="border border-dashed border-border rounded-xl p-10 text-center animate-in fade-in duration-300">
          <div className="w-12 h-12 bg-[var(--active-bg)] rounded-lg flex items-center justify-center mx-auto mb-4">
            <Package size={22} className="text-[var(--active-border)]" />
          </div>
          <h3 className="text-[15px] font-medium text-foreground mb-1">Welcome to HalePulse</h3>
          <p className="text-[13px] text-muted-foreground max-w-sm mx-auto mb-6">
            Your pharmacy system is ready. Add your first products to get started.
          </p>
          <Link
            href="/inventory"
            className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-foreground/90"
          >
            <Plus size={15} />
            Add First Product
          </Link>
        </div>
      )}

      {/* Metric cards — single row with internal dividers */}
      {totalProducts > -1 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden border border-border animate-in fade-in slide-in-from-bottom-1 duration-300">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="bg-white dark:bg-[var(--surface-raised)] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[12px] font-medium text-muted-foreground tracking-tight">{stat.title}</span>
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
                      stat.warning && stat.accent
                        ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500'
                        : 'bg-[var(--active-bg)] text-[var(--active-border)]'
                    }`}>
                      <Icon size={14} />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-medium text-foreground tracking-tight leading-none">
                      {stat.value}
                    </span>
                    {stat.trend && (
                      <span className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                        <ArrowUpRight size={12} />
                        {stat.trend}
                      </span>
                    )}
                    {stat.warning && stat.accent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300 delay-100 fill-mode-both">

            {/* Recent Transactions */}
            <div className="lg:col-span-3 border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 flex justify-between items-center border-b border-border">
                <h4 className="text-[13px] font-medium text-foreground">Recent Transactions</h4>
                <Link
                  href="/reports?tab=sales"
                  className="text-[12px] font-medium text-muted-foreground surface-interactive px-2.5 py-1 rounded-md border border-border"
                >
                  View all
                </Link>
              </div>

              {recentSales.length > 0 ? (
                <div className="divide-y divide-border">
                  {recentSales.map((sale) => (
                    <div key={sale.id} className="flex justify-between items-center px-5 py-3.5 surface-interactive">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-md bg-[var(--surface)] dark:bg-[var(--hover)] flex items-center justify-center text-muted-foreground font-medium text-[12px] flex-shrink-0">
                          {(sale.customer?.name || 'W').charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate">{sale.customer?.name || 'Walk-in Customer'}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {sale.items.length} items
                          </p>
                        </div>
                      </div>
                      <span className="text-[13px] font-medium text-foreground flex-shrink-0 ml-3">₵{sale.totalAmount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-10 text-center min-h-[280px]">
                  <div className="w-10 h-10 bg-[var(--surface)] rounded-lg flex items-center justify-center mb-3">
                    <ShoppingBag size={18} className="text-muted-foreground" />
                  </div>
                  <p className="text-[13px] font-medium text-foreground">No transactions today</p>
                  <p className="text-[12px] text-muted-foreground mt-1">Sales will appear here automatically.</p>
                </div>
              )}
            </div>

            {/* Inventory Alerts */}
            <div className="lg:col-span-2 border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 flex justify-between items-center border-b border-border">
                <h4 className="text-[13px] font-medium text-foreground">Inventory Alerts</h4>
                <Link
                  href="/inventory"
                  className="text-[12px] font-medium text-muted-foreground surface-interactive px-2.5 py-1 rounded-md border border-border"
                >
                  View all
                </Link>
              </div>

              <div className="p-3 space-y-1 min-h-[280px] flex flex-col">
                {lowStock > 0 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg surface-interactive cursor-pointer">
                    <div className="w-8 h-8 rounded-md bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertCircle size={15} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground mb-0.5">Low Stock</p>
                      <p className="text-[12px] text-muted-foreground leading-relaxed">{lowStock} products below minimum threshold of 5 units.</p>
                    </div>
                  </div>
                )}

                {expiringSoon > 0 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg surface-interactive cursor-pointer">
                    <div className="w-8 h-8 rounded-md bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Calendar size={15} className="text-rose-600 dark:text-rose-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground mb-0.5">Expiring Items</p>
                      <p className="text-[12px] text-muted-foreground leading-relaxed">{expiringSoon} products expire within 90 days.</p>
                    </div>
                  </div>
                )}

                {lowStock === 0 && expiringSoon === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg flex items-center justify-center mb-3">
                      <Package size={18} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-[13px] font-medium text-foreground">Inventory is healthy</p>
                    <p className="text-[12px] text-muted-foreground mt-1">No alerts at this time.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
