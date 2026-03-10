import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import {
  TrendingUp, Package, Calendar, AlertCircle,
  ShoppingBag, ArrowUpRight, Download, BarChart2, FileText
} from 'lucide-react';
import Link from 'next/link';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; range?: string }>;
}) {
  const { tenantId } = await getTenantContext();

  const params = await searchParams;
  const tab = params.tab || 'sales';
  const range = params.range || '30';

  // ── Date range ──────────────────────────────────────────────────────────────
  const days = parseInt(range, 10) || 30;
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - days);
  rangeStart.setHours(0, 0, 0, 0);

  const tenantFilter = { tenantId };

  // ── Sales data ───────────────────────────────────────────────────────────────
  const [salesSummary, totalRevenue, recentSales, topProducts, lowStockProducts, expiringProducts] =
    await Promise.all([
      // Daily sales for the range (grouped manually)
      prisma.sale.findMany({
        where: { ...tenantFilter, createdAt: { gte: rangeStart } },
        orderBy: { createdAt: 'asc' },
        include: { customer: true, items: { include: { product: true } } },
      }),
      // Total revenue in range
      prisma.sale.aggregate({
        _sum: { totalAmount: true },
        _count: true,
        where: { ...tenantFilter, createdAt: { gte: rangeStart } },
      }),
      // Last 10 sales
      prisma.sale.findMany({
        where: tenantFilter,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { customer: true, items: true },
      }),
      // Top selling products via SaleItems
      prisma.saleItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true, price: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
        where: {
          sale: { ...tenantFilter, createdAt: { gte: rangeStart } },
        },
      }),
      // Low stock
      prisma.product.findMany({
        where: { ...tenantFilter, stockQty: { lte: 10 } },
        orderBy: { stockQty: 'asc' },
        take: 20,
      }),
      // Expiring within 90 days
      prisma.product.findMany({
        where: {
          ...tenantFilter,
          expiryDate: { lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), gt: new Date() },
        },
        orderBy: { expiryDate: 'asc' },
        take: 20,
      }),
    ]);

  // Enrich top products with names
  const productIds = topProducts.map(tp => tp.productId);
  const productNames = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, category: true },
  });
  const productMap = new Map(productNames.map(p => [p.id, p]));

  const revenue = totalRevenue._sum.totalAmount ?? 0;
  const txCount = totalRevenue._count ?? 0;
  const avgSale = txCount > 0 ? revenue / txCount : 0;

  // Group sales by day
  const salesByDay = new Map<string, number>();
  for (const sale of salesSummary) {
    const day = new Date(sale.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    salesByDay.set(day, (salesByDay.get(day) ?? 0) + sale.totalAmount);
  }
  const dailyData = Array.from(salesByDay.entries()).slice(-14);
  const maxDay = Math.max(...dailyData.map(d => d[1]), 1);

  const tabs = [
    { key: 'sales', label: 'Sales Summary', icon: TrendingUp },
    { key: 'products', label: 'Top Products', icon: BarChart2 },
    { key: 'inventory', label: 'Inventory', icon: Package },
    { key: 'expiry', label: 'Expiry', icon: Calendar },
  ];

  const ranges = [
    { value: '7', label: '7 days' },
    { value: '30', label: '30 days' },
    { value: '90', label: '90 days' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Reports</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Analytics and insights across your pharmacy.</p>
        </div>
        <div className="flex items-center gap-2">
          {ranges.map(r => (
            <Link
              key={r.value}
              href={`/reports?tab=${tab}&range=${r.value}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                range === r.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-800 w-full overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <Link
            key={t.key}
            href={`/reports?tab=${t.key}&range=${range}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex-1 justify-center ${
              tab === t.key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── SALES SUMMARY ──────────────────────────────────────────────────────── */}
      {tab === 'sales' && (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Revenue', value: `₵${revenue.toFixed(2)}`, sub: `Last ${range} days`, icon: TrendingUp, color: 'text-indigo-600' },
              { label: 'Transactions', value: txCount.toString(), sub: `Last ${range} days`, icon: ShoppingBag, color: 'text-emerald-600' },
              { label: 'Avg Sale Value', value: `₵${avgSale.toFixed(2)}`, sub: 'Per transaction', icon: ArrowUpRight, color: 'text-amber-600' },
            ].map((kpi, i) => (
              <div key={i} className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl p-6">
                <kpi.icon size={18} className={`${kpi.color} mb-3`} />
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{kpi.label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{kpi.value}</p>
                <p className="text-xs text-slate-400 mt-1">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Daily bar chart */}
          <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Daily Revenue</h3>
              <span className="text-xs text-slate-400">Last {Math.min(dailyData.length, 14)} days</span>
            </div>
            {dailyData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                <BarChart2 size={32} className="mb-2 opacity-30" />
                <p className="text-sm">No sales data for this period</p>
              </div>
            ) : (
              <div className="flex items-end gap-2 h-40 overflow-x-auto pb-2">
                {dailyData.map(([day, total]) => (
                  <div key={day} className="flex flex-col items-center gap-1 flex-1 min-w-[36px]">
                    <span className="text-[10px] text-slate-500 font-medium">₵{total >= 1000 ? `${(total/1000).toFixed(1)}k` : total.toFixed(0)}</span>
                    <div
                      className="w-full bg-indigo-500 dark:bg-indigo-600 rounded-t-md transition-all hover:bg-indigo-600 dark:hover:bg-indigo-500"
                      style={{ height: `${Math.max((total / maxDay) * 100, 4)}%` }}
                    />
                    <span className="text-[9px] text-slate-400 font-medium">{day}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent transactions */}
          <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Recent Transactions</h3>
              <span className="text-xs text-slate-400">{recentSales.length} shown</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {recentSales.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-slate-400">No transactions yet.</p>
              ) : recentSales.map(sale => (
                <div key={sale.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-500">
                      {(sale.customer?.name ?? 'W')[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{sale.customer?.name ?? 'Walk-in'}</p>
                      <p className="text-xs text-slate-400">{new Date(sale.createdAt).toLocaleString()} · {sale.items.length} items</p>
                    </div>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-white">₵{sale.totalAmount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TOP PRODUCTS ───────────────────────────────────────────────────────── */}
      {tab === 'products' && (
        <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Top Selling Products</h3>
            <p className="text-xs text-slate-400 mt-0.5">Ranked by units sold in the last {range} days</p>
          </div>
          {topProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Package size={32} className="mb-2 opacity-30" />
              <p className="text-sm">No sales data for this period</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {topProducts.map((tp, i) => {
                const product = productMap.get(tp.productId);
                const maxQty = topProducts[0]._sum.quantity ?? 1;
                const pct = ((tp._sum.quantity ?? 0) / maxQty) * 100;
                return (
                  <div key={tp.productId} className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-bold text-slate-400 w-5">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">{product?.name ?? `Product #${tp.productId}`}</p>
                            <p className="text-xs text-slate-400">{product?.category ?? '—'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{tp._sum.quantity ?? 0} units</p>
                            <p className="text-xs text-slate-400">₵{(tp._sum.price ?? 0).toFixed(2)} revenue</p>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── INVENTORY REPORT ───────────────────────────────────────────────────── */}
      {tab === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-6">
              <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 mb-3" />
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">Low Stock</p>
              <p className="text-3xl font-bold text-amber-900 dark:text-amber-300">{lowStockProducts.length}</p>
              <p className="text-xs text-amber-600/70 dark:text-amber-400/60 mt-1">Products at or below 10 units</p>
            </div>
            <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl p-6">
              <Calendar size={20} className="text-rose-600 dark:text-rose-400 mb-3" />
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider mb-1">Expiring Soon</p>
              <p className="text-3xl font-bold text-rose-900 dark:text-rose-300">{expiringProducts.length}</p>
              <p className="text-xs text-rose-600/70 dark:text-rose-400/60 mt-1">Products expiring within 90 days</p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Low Stock Products</h3>
            </div>
            {lowStockProducts.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-slate-400">All products have healthy stock levels.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-white/5">
                  <tr>
                    <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Product</th>
                    <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Category</th>
                    <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {lowStockProducts.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                      <td className="px-6 py-3 text-sm font-medium text-slate-900 dark:text-slate-200">{p.name}</td>
                      <td className="px-6 py-3 text-xs text-slate-500">{p.category}</td>
                      <td className="px-6 py-3 text-right">
                        <span className={`text-sm font-bold ${p.stockQty <= 5 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {p.stockQty}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── EXPIRY REPORT ──────────────────────────────────────────────────────── */}
      {tab === 'expiry' && (
        <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Expiring Within 90 Days</h3>
            <p className="text-xs text-slate-400 mt-0.5">{expiringProducts.length} products require attention</p>
          </div>
          {expiringProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Package size={32} className="mb-2 opacity-30" />
              <p className="text-sm">No products expiring in the next 90 days</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Product</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Category</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Stock</th>
                  <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {expiringProducts.map(p => {
                  const daysLeft = Math.ceil((new Date(p.expiryDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const urgent = daysLeft <= 30;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                      <td className="px-6 py-3 text-sm font-medium text-slate-900 dark:text-slate-200">{p.name}</td>
                      <td className="px-6 py-3 text-xs text-slate-500">{p.category}</td>
                      <td className="px-6 py-3 text-sm text-slate-700 dark:text-slate-300">{p.stockQty}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${urgent ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400' : 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'}`}>
                            {daysLeft}d left
                          </span>
                          <span className="text-xs text-slate-500">{new Date(p.expiryDate!).toLocaleDateString()}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
