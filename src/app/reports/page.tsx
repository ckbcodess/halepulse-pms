import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import {
  TrendingUp, Package, Calendar, AlertCircle,
  ShoppingBag, ArrowUpRight, Download, BarChart2, FileText
} from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';

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
  // Use `days` (from the selected range param) so 7/30/90-day selector is respected
  const dailyData = Array.from(salesByDay.entries()).slice(-days);
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
      <PageHeader
        title="Reports"
        description="Analytics and insights across your pharmacy."
      >
        {ranges.map(r => (
            <Link
              key={r.value}
              href={`/reports?tab=${tab}&range=${r.value}`}
              className={`px-[13px] py-[9px] rounded-[8px] text-[12.25px] font-medium transition-colors ${
                range === r.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-foreground hover:bg-muted/50'
              }`}
            >
              {r.label}
            </Link>
          ))}
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted dark:bg-sidebar/50 rounded-xl border border-border/50 dark:border-border w-full overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <Link
            key={t.key}
            href={`/reports?tab=${t.key}&range=${range}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex-1 justify-center ${
              tab === t.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
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
              { label: 'Total Revenue', value: `₵${revenue.toFixed(2)}`, sub: `Last ${range} days`, icon: TrendingUp, color: 'text-primary' },
              { label: 'Transactions', value: txCount.toString(), sub: `Last ${range} days`, icon: ShoppingBag, color: 'text-emerald-600' },
              { label: 'Avg Sale Value', value: `₵${avgSale.toFixed(2)}`, sub: 'Per transaction', icon: ArrowUpRight, color: 'text-amber-600' },
            ].map((kpi, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-6">
                <kpi.icon size={18} className={`${kpi.color} mb-3`} />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{kpi.label}</p>
                <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Daily bar chart */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-semibold text-foreground">Daily Revenue</h3>
              <span className="text-xs text-muted-foreground">Last {Math.min(dailyData.length, 14)} days</span>
            </div>
            {dailyData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <BarChart2 size={32} className="mb-2 opacity-30" />
                <p className="text-sm">No sales data for this period</p>
              </div>
            ) : (
              <div className="flex items-end gap-2 h-40 overflow-x-auto pb-2">
                {dailyData.map(([day, total]) => (
                  <div key={day} className="flex flex-col items-center gap-1 flex-1 min-w-[36px]">
                    <span className="text-[10px] text-muted-foreground font-medium">₵{total >= 1000 ? `${(total/1000).toFixed(1)}k` : total.toFixed(0)}</span>
                    <div
                      className="w-full bg-primary dark:bg-primary rounded-t-md transition-all hover:bg-primary dark:hover:bg-primary"
                      style={{ height: `${Math.max((total / maxDay) * 100, 4)}%` }}
                    />
                    <span className="text-[9px] text-muted-foreground font-medium">{day}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent transactions */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Recent Transactions</h3>
              <span className="text-xs text-muted-foreground">{recentSales.length} shown</span>
            </div>
            <div className="divide-y divide-border">
              {recentSales.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-muted-foreground">No transactions yet.</p>
              ) : recentSales.map(sale => (
                <div key={sale.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted dark:hover:bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted dark:bg-sidebar flex items-center justify-center text-sm font-bold text-muted-foreground">
                      {(sale.customer?.name ?? 'W')[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{sale.customer?.name ?? 'Walk-in'}</p>
                      <p className="text-xs text-muted-foreground">{new Date(sale.createdAt).toLocaleString()} · {sale.items.length} items</p>
                    </div>
                  </div>
                  <span className="font-semibold text-foreground">₵{sale.totalAmount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TOP PRODUCTS ───────────────────────────────────────────────────────── */}
      {tab === 'products' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-base font-semibold text-foreground">Top Selling Products</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Ranked by units sold in the last {range} days</p>
          </div>
          {topProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package size={32} className="mb-2 opacity-30" />
              <p className="text-sm">No sales data for this period</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {topProducts.map((tp, i) => {
                const product = productMap.get(tp.productId);
                const maxQty = topProducts[0]._sum.quantity ?? 1;
                const pct = ((tp._sum.quantity ?? 0) / maxQty) * 100;
                return (
                  <div key={tp.productId} className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{product?.name ?? `Product #${tp.productId}`}</p>
                            <p className="text-xs text-muted-foreground">{product?.category ?? '—'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-foreground">{tp._sum.quantity ?? 0} units</p>
                            <p className="text-xs text-muted-foreground">₵{(tp._sum.price ?? 0).toFixed(2)} revenue</p>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted dark:bg-sidebar rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
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

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">Low Stock Products</h3>
            </div>
            {lowStockProducts.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">All products have healthy stock levels.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Product</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Category</th>
                    <th className="px-6 py-3 text-right text-sm font-medium text-muted-foreground">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lowStockProducts.map(p => (
                    <tr key={p.id}>
                      <td className="px-6 py-3 text-sm font-medium text-foreground">{p.name}</td>
                      <td className="px-6 py-3 text-xs text-muted-foreground">{p.category}</td>
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
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-base font-semibold text-foreground">Expiring Within 90 Days</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{expiringProducts.length} products require attention</p>
          </div>
          {expiringProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package size={32} className="mb-2 opacity-30" />
              <p className="text-sm">No products expiring in the next 90 days</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Product</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Category</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Stock</th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-muted-foreground">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {expiringProducts.map(p => {
                  const daysLeft = Math.ceil((new Date(p.expiryDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const urgent = daysLeft <= 30;
                  return (
                    <tr key={p.id}>
                      <td className="px-6 py-3 text-sm font-medium text-foreground">{p.name}</td>
                      <td className="px-6 py-3 text-xs text-muted-foreground">{p.category}</td>
                      <td className="px-6 py-3 text-sm text-foreground">{p.stockQty}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${urgent ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400' : 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'}`}>
                            {daysLeft}d left
                          </span>
                          <span className="text-xs text-muted-foreground">{new Date(p.expiryDate!).toLocaleDateString()}</span>
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
