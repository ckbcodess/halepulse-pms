import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { branchWhere } from '@/lib/auth/branchScope';
import {
  TrendingUp, Package, Calendar, AlertCircle,
  ShoppingBag, ArrowUpRight, Download, BarChart2, FileText
} from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { ReportsTabs } from './ReportsTabs';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; range?: string }>;
}) {
  const ctx = await getTenantContext();
  const { tenantId } = ctx;
  const branchFilter = await branchWhere(ctx);

  const params = await searchParams;
  const tab = params.tab || 'sales';
  const range = params.range || '30';

  // ── Date range ──────────────────────────────────────────────────────────────
  const days = parseInt(range, 10) || 30;
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - days);
  rangeStart.setHours(0, 0, 0, 0);

  const tenantFilter = { tenantId };              // products are tenant-wide
  const saleFilter = { tenantId, ...branchFilter }; // sales are branch-scoped

  // ── Sales data ───────────────────────────────────────────────────────────────
  const [salesSummary, totalRevenue, recentSales, topProducts, lowStockProducts, expiringProducts] =
    await Promise.all([
      // Daily sales for the range (grouped manually)
      prisma.sale.findMany({
        where: { ...saleFilter, createdAt: { gte: rangeStart } },
        orderBy: { createdAt: 'asc' },
        include: { customer: true, items: { include: { product: true } } },
      }),
      // Total revenue in range
      prisma.sale.aggregate({
        _sum: { totalAmount: true },
        _count: true,
        where: { ...saleFilter, createdAt: { gte: rangeStart } },
      }),
      // Last 10 sales
      prisma.sale.findMany({
        where: saleFilter,
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
          sale: { ...saleFilter, createdAt: { gte: rangeStart } },
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

  // ── Payments tab: revenue by payment method over the range ───────────────────
  const paymentBreakdown = tab === 'payments'
    ? await prisma.salePayment.groupBy({
        by: ['paymentMethod'],
        _sum: { amount: true },
        _count: true,
        where: { ...saleFilter, createdAt: { gte: rangeStart }, sale: { status: { not: 'voided' } } },
      })
    : [];
  const paymentTotal = paymentBreakdown.reduce((s, p) => s + (p._sum.amount ?? 0), 0);

  // ── Frequency tab: products ranked by number of sale lines (transactions) ────
  const frequency = tab === 'frequency'
    ? await prisma.saleItem.groupBy({
        by: ['productId'],
        _count: { _all: true },
        _sum: { quantity: true },
        orderBy: { _count: { productId: 'desc' } },
        take: 25,
        where: { sale: { ...saleFilter, status: { not: 'voided' }, createdAt: { gte: rangeStart } } },
      })
    : [];
  const freqNames = frequency.length
    ? await prisma.product.findMany({ where: { id: { in: frequency.map(f => f.productId) } }, select: { id: true, name: true, category: true } })
    : [];
  const freqMap = new Map(freqNames.map(p => [p.id, p]));

  const PAYMENT_LABEL: Record<string, string> = { cash: 'Cash', mobile_money: 'Mobile Money', card: 'Card', credit: 'Credit' };

  // ── Monthly tab: month-over-month statistical summary ────────────────────────
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  let monthly: null | {
    thisRevenue: number; lastRevenue: number; changePct: number | null; saleCount: number;
    topProducts: { name: string; quantity: number; revenue: number }[];
    topCustomers: { name: string; visits: number; spent: number }[];
    byMethod: { method: string; amount: number }[];
    stockCost: number; stockSelling: number;
  } = null;

  if (tab === 'monthly') {
    const [thisRev, lastRev, topQty, topCust, methodRev, stockItems] = await Promise.all([
      prisma.sale.aggregate({ _sum: { totalAmount: true }, _count: true, where: { ...saleFilter, status: { not: 'voided' }, createdAt: { gte: monthStart } } }),
      prisma.sale.aggregate({ _sum: { totalAmount: true }, where: { ...saleFilter, status: { not: 'voided' }, createdAt: { gte: prevMonthStart, lt: monthStart } } }),
      prisma.saleItem.groupBy({ by: ['productId'], _sum: { quantity: true, price: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 10, where: { sale: { ...saleFilter, status: { not: 'voided' }, createdAt: { gte: monthStart } } } }),
      prisma.sale.groupBy({ by: ['customerId'], _count: true, _sum: { totalAmount: true }, orderBy: { _count: { customerId: 'desc' } }, take: 10, where: { ...saleFilter, status: { not: 'voided' }, createdAt: { gte: monthStart }, customerId: { not: null } } }),
      prisma.salePayment.groupBy({ by: ['paymentMethod'], _sum: { amount: true }, where: { ...saleFilter, createdAt: { gte: monthStart }, sale: { status: { not: 'voided' } } } }),
      prisma.stockItem.findMany({ where: { tenantId, ...branchFilter }, select: { quantity: true, costPrice: true, sellingPrice: true } }),
    ]);

    const [prodNames, custNames] = await Promise.all([
      topQty.length ? prisma.product.findMany({ where: { id: { in: topQty.map(t => t.productId) } }, select: { id: true, name: true } }) : [],
      topCust.length ? prisma.customer.findMany({ where: { id: { in: topCust.map(c => c.customerId!).filter(Boolean) } }, select: { id: true, name: true } }) : [],
    ]);
    const pMap = new Map(prodNames.map(p => [p.id, p.name]));
    const cMap = new Map(custNames.map(c => [c.id, c.name]));

    const thisRevenue = thisRev._sum.totalAmount ?? 0;
    const lastRevenue = lastRev._sum.totalAmount ?? 0;

    monthly = {
      thisRevenue,
      lastRevenue,
      changePct: lastRevenue > 0 ? ((thisRevenue - lastRevenue) / lastRevenue) * 100 : (thisRevenue > 0 ? 100 : null),
      saleCount: thisRev._count ?? 0,
      topProducts: topQty.map(t => ({ name: pMap.get(t.productId) ?? `#${t.productId}`, quantity: t._sum.quantity ?? 0, revenue: t._sum.price ?? 0 })),
      topCustomers: topCust.map(c => ({ name: cMap.get(c.customerId!) ?? 'Unknown', visits: c._count, spent: c._sum.totalAmount ?? 0 })),
      byMethod: methodRev.map(m => ({ method: m.paymentMethod, amount: m._sum.amount ?? 0 })),
      stockCost: stockItems.reduce((s, i) => s + i.quantity * i.costPrice, 0),
      stockSelling: stockItems.reduce((s, i) => s + i.quantity * i.sellingPrice, 0),
    };
  }

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
          <Button
            key={r.value}
            variant={range === r.value ? 'default' : 'outline'}
            size="sm"
            nativeButton={false}
            render={<Link href={`/reports?tab=${tab}&range=${r.value}`} />}
          >
            {r.label}
          </Button>
        ))}
        {['sales', 'frequency', 'inventory'].includes(tab) && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={`/api/reports/export?type=${tab}&range=${range}`} />}
          >
            <Download size={14} /> Export CSV
          </Button>
        )}
      </PageHeader>

      {/* Tabs */}
      <ReportsTabs tab={tab} range={range} />

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

      {/* ── MONTHLY SUMMARY ────────────────────────────────────────────────────── */}
      {tab === 'monthly' && monthly && (
        <div className="space-y-6">
          {/* Revenue vs last month */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-2xl p-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">This Month</p>
              <p className="text-2xl font-bold text-foreground">₵{monthly.thisRevenue.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">{monthly.saleCount} sales</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Last Month</p>
              <p className="text-2xl font-bold text-foreground">₵{monthly.lastRevenue.toFixed(2)}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Change</p>
              <p className={`text-2xl font-bold ${monthly.changePct === null ? 'text-muted-foreground' : monthly.changePct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {monthly.changePct === null ? '—' : `${monthly.changePct >= 0 ? '+' : ''}${monthly.changePct.toFixed(1)}%`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">₵{(monthly.thisRevenue - monthly.lastRevenue).toFixed(2)} vs last</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stock Value</p>
              <p className="text-2xl font-bold text-foreground">₵{monthly.stockSelling.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Cost ₵{monthly.stockCost.toFixed(2)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top products */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border"><h3 className="text-base font-semibold text-foreground">Top Products (this month)</h3></div>
              {monthly.topProducts.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">No sales yet this month.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {monthly.topProducts.map((p, i) => (
                      <TableRow key={i}><TableCell className="font-medium text-foreground">{p.name}</TableCell><TableCell className="text-right">{p.quantity}</TableCell><TableCell className="text-right">₵{p.revenue.toFixed(2)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Top customers */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border"><h3 className="text-base font-semibold text-foreground">Top Customers (this month)</h3></div>
              {monthly.topCustomers.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">No customer sales yet this month.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Visits</TableHead><TableHead className="text-right">Spent</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {monthly.topCustomers.map((c, i) => (
                      <TableRow key={i}><TableCell className="font-medium text-foreground">{c.name}</TableCell><TableCell className="text-right">{c.visits}</TableCell><TableCell className="text-right">₵{c.spent.toFixed(2)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          {/* Revenue by method this month */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Revenue by Payment Method</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {['cash', 'mobile_money', 'card', 'credit'].map((m) => (
                <div key={m}>
                  <p className="text-xs text-muted-foreground">{PAYMENT_LABEL[m]}</p>
                  <p className="text-lg font-bold text-foreground">₵{(monthly!.byMethod.find(x => x.method === m)?.amount ?? 0).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENTS BREAKDOWN ─────────────────────────────────────────────────── */}
      {tab === 'payments' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {['cash', 'mobile_money', 'card', 'credit'].map((m) => {
              const row = paymentBreakdown.find((p) => p.paymentMethod === m);
              const amt = row?._sum.amount ?? 0;
              const pct = paymentTotal > 0 ? (amt / paymentTotal) * 100 : 0;
              return (
                <div key={m} className="bg-card border border-border rounded-2xl p-6">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{PAYMENT_LABEL[m]}</p>
                  <p className="text-2xl font-bold text-foreground">₵{amt.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{pct.toFixed(1)}% · {row?._count ?? 0} payments</p>
                </div>
              );
            })}
          </div>
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold text-foreground">Total collected</h3>
              <span className="text-lg font-bold text-foreground">₵{paymentTotal.toFixed(2)}</span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden bg-muted">
              {['cash', 'mobile_money', 'card', 'credit'].map((m, i) => {
                const amt = paymentBreakdown.find((p) => p.paymentMethod === m)?._sum.amount ?? 0;
                const pct = paymentTotal > 0 ? (amt / paymentTotal) * 100 : 0;
                const colors = ['bg-primary', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
                return pct > 0 ? <div key={m} className={colors[i]} style={{ width: `${pct}%` }} title={`${PAYMENT_LABEL[m]} ${pct.toFixed(1)}%`} /> : null;
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Last {range} days · excludes voided sales</p>
          </div>
        </div>
      )}

      {/* ── PURCHASE FREQUENCY ─────────────────────────────────────────────────── */}
      {tab === 'frequency' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-base font-semibold text-foreground">Most Frequently Sold</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Ranked by number of transactions in the last {range} days</p>
          </div>
          {frequency.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package size={32} className="mb-2 opacity-30" />
              <p className="text-sm">No sales data for this period</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {frequency.map((f, i) => {
                  const p = freqMap.get(f.productId);
                  return (
                    <TableRow key={f.productId}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium text-foreground">{p?.name ?? `Product #${f.productId}`}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p?.category ?? '—'}</TableCell>
                      <TableCell className="text-right font-bold">{f._count._all}</TableCell>
                      <TableCell className="text-right">{f._sum.quantity ?? 0}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.category}</TableCell>
                      <TableCell className="text-right">
                        <span className={`text-sm font-bold ${p.stockQty <= 5 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {p.stockQty}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiringProducts.map(p => {
                  const daysLeft = Math.ceil((new Date(p.expiryDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const urgent = daysLeft <= 30;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.category}</TableCell>
                      <TableCell className="text-foreground">{p.stockQty}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Badge variant={urgent ? 'destructive' : 'warning'}>{daysLeft}d left</Badge>
                          <span className="text-xs text-muted-foreground">{new Date(p.expiryDate!).toLocaleDateString()}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
