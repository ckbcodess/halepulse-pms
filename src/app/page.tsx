import prisma from '@/lib/prisma';
import { Package, AlertCircle, Calendar, ShoppingBag, ArrowUpRight, Clock, TrendingUp, Info, Plus } from "lucide-react";
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
    { title: "Total Inventory", value: totalProducts.toLocaleString(), icon: Package, hasTrend: false },
    { title: "Low Stock Alerts", value: lowStock.toLocaleString(), icon: AlertCircle, hasTrend: false, isWarning: lowStock > 0 },
    { title: "Expiring Soon", value: expiringSoon.toLocaleString(), icon: Calendar, hasTrend: false, isWarning: expiringSoon > 0 },
    { title: "Sales Today", value: `₵${totalRevenue.toFixed(2)}`, icon: ShoppingBag, hasTrend: true, trend: "12.5%" },
  ];

  return (
    <div className="space-y-8">

      {/* Filter Header */}
      <div className="animate-in slide-in-from-bottom-2 fade-in duration-500 ease-out-expo flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <button className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
            <Calendar size={14} className="text-slate-400" />
            Last 30 days
            <span className="text-[10px] ml-1 text-slate-400">▼</span>
          </button>
          <button className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors hidden sm:flex">
            <Clock size={14} className="text-slate-400" />
            Compare: Previous period
            <span className="text-[10px] ml-1 text-slate-400">▼</span>
          </button>
        </div>
        <button className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
          <span className="text-[10px] text-slate-400 font-bold">⤢</span>
          Full-screen
        </button>
      </div>

      {/* Empty State specifically when NO products exist in the database */}
      {totalProducts === 0 && (
        <div className="bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl p-8 sm:p-12 text-center animate-in zoom-in-95 fade-in duration-500 delay-100 fill-mode-both">
          <div className="w-16 h-16 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Package size={32} className="text-indigo-500 dark:text-indigo-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Welcome to PharmNext</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8 font-medium">
            Your pharmacy system is ready to go. Get started by adding your first products to the inventory database.
          </p>
          <Link href="/inventory" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-all">
            <Plus size={18} />
            Add First Product
          </Link>
        </div>
      )}

      {/* Metric Cards */}
      {totalProducts > -1 && (
        <>
          <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-white/5 animate-in slide-in-from-bottom-3 fade-in duration-500 ease-out-expo fill-mode-both" style={{ animationDelay: '150ms' }}>
            {stats.map((stat, i) => (
              <div key={i} className="flex-1 p-6 sm:p-8">
                <div className="flex items-center gap-1.5 mb-4">
                  <p className="text-[13px] font-semibold text-slate-600 dark:text-slate-400">{stat.title}</p>
                  <Info size={12} className="text-slate-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-[32px] sm:text-[36px] font-medium tracking-tight text-slate-900 dark:text-white leading-none">
                    {stat.value}
                  </h3>
                  {stat.hasTrend && stat.trend && (
                    <span className="text-[15px] font-medium text-slate-900 dark:text-white ml-1">{stat.trend}</span>
                  )}
                  {stat.isWarning && (
                    <div className="w-2 h-2 rounded-full bg-rose-500 ml-1 mb-1"></div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8 animate-in slide-in-from-bottom-4 fade-in duration-500 ease-out-expo fill-mode-both" style={{ animationDelay: '250ms' }}>

            {/* Sales Overview / Recent Transactions */}
            <div className="lg:col-span-3 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl flex flex-col">
              <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-4 flex justify-between items-center">
                <h4 className="text-[17px] font-semibold text-slate-900 dark:text-white tracking-tight">Recent Transactions</h4>
                <Link href="/reports?tab=sales" className="bg-slate-50 dark:bg-transparent border border-slate-200 dark:border-white/5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">View report</Link>
              </div>

              <div className="flex-1 flex flex-col px-2 pb-4">
                {recentSales.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-white/5">
                    {recentSales.map((sale) => (
                      <div key={sale.id} className="flex justify-between items-center px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 font-medium text-sm">
                            {(sale.customer?.name || 'W').charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-slate-900 dark:text-slate-200">{sale.customer?.name || 'Walk-in Customer'}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                              {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {sale.items.length} items
                            </p>
                          </div>
                        </div>
                        <p className="font-semibold text-slate-900 dark:text-white">₵{sale.totalAmount.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[300px]">
                    <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                      <ShoppingBag size={20} className="text-slate-400 dark:text-slate-500" />
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-200">No transactions today</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sales will appear here automatically.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Inventory Alerts */}
            <div className="lg:col-span-2 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl flex flex-col">
              <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-4 flex justify-between items-center">
                <h4 className="text-[17px] font-semibold text-slate-900 dark:text-white tracking-tight">Inventory Alerts</h4>
                <Link href="/reports?tab=sales" className="bg-slate-50 dark:bg-transparent border border-slate-200 dark:border-white/5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">View report</Link>
              </div>

              <div className="p-4 space-y-1 min-h-[300px] flex flex-col">
                {lowStock > 0 && (
                  <div className="flex items-start gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors group cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <AlertCircle size={18} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 pr-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-0.5">Low Stock Remaining</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{lowStock} products have dropped below the minimum stock threshold of 5 units.</p>
                    </div>
                  </div>
                )}

                {expiringSoon > 0 && (
                  <div className="flex items-start gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors group cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                      <Calendar size={18} className="text-rose-600 dark:text-rose-400" />
                    </div>
                    <div className="flex-1 pr-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-0.5">Expiring Items</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{expiringSoon} products will expire within the next 90 days. Please review inventory.</p>
                    </div>
                  </div>
                )}

                {lowStock === 0 && expiringSoon === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-slate-800/50 m-2">
                    <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-200 dark:border-slate-800">
                      <Package size={20} className="text-emerald-500 dark:text-emerald-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">Inventory is healthy</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-[200px] mx-auto">No low stock or expiring items detected.</p>
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
