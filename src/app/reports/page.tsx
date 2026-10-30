import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { branchWhere } from '@/lib/auth/branchScope';
import {
  TrendingUp, Package, Calendar, AlertCircle,
  ShoppingBag, ArrowUpRight, Download, BarChart2, FileText, ArrowRightLeft
} from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent
} from '@/components/ui/card';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import MonthlyAiSummary from './MonthlyAiSummary';
import ReportControls from './ReportControls';
import ReportsTabs from './ReportsTabs';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string; range?: string;
    from?: string; to?: string;
    product?: string; paymentMethod?: string; status?: string;
    minAmount?: string; maxAmount?: string;
    branchId?: string; category?: string; supplier?: string;
    minStock?: string; maxStock?: string;
    expiryDays?: string; sortBy?: string;
    month?: string; year?: string;
  }>;
}) {
  const ctx = await getTenantContext();
  const { tenantId } = ctx;
  const branchFilter = await branchWhere(ctx);

  const params = await searchParams;
  const tab    = params.tab    || 'sales';
  const range  = params.range  || '30';

  // Date range — from/to override the range quick buttons
  let rangeStart: Date;
  if (params.from) {
    rangeStart = new Date(params.from);
    rangeStart.setHours(0, 0, 0, 0);
  } else {
    const days = parseInt(range, 10) || 30;
    rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - days);
    rangeStart.setHours(0, 0, 0, 0);
  }
  const rangeEnd = params.to ? new Date(params.to + 'T23:59:59') : new Date();

  const tenantFilter  = { tenantId };
  const baseBranchFilter = params.branchId
    ? { branchId: params.branchId }
    : branchFilter;
  const saleFilter = { tenantId, ...baseBranchFilter };

  // Build dynamic where clauses from filters
  const dateRangeFilter = { gte: rangeStart, lte: rangeEnd };

  const saleWhereBase: Record<string, unknown> = {
    ...saleFilter,
    createdAt: dateRangeFilter,
  };
  if (params.status)        saleWhereBase.status = params.status;
  if (params.minAmount || params.maxAmount) {
    saleWhereBase.totalAmount = {
      ...(params.minAmount ? { gte: parseFloat(params.minAmount) } : {}),
      ...(params.maxAmount ? { lte: parseFloat(params.maxAmount) } : {}),
    };
  }
  if (params.product) {
    saleWhereBase.items = {
      some: { product: { name: { contains: params.product, mode: 'insensitive' } } },
    };
  }
  if (params.paymentMethod) {
    saleWhereBase.payments = {
      some: { paymentMethod: params.paymentMethod },
    };
  }

  // Product filters for inventory / expiry / top products
  const productWhereBase: Record<string, unknown> = { ...tenantFilter };
  if (params.category) productWhereBase.category = { contains: params.category, mode: 'insensitive' };
  if (params.product)  productWhereBase.name = { contains: params.product, mode: 'insensitive' };
  if (params.supplier) {
    productWhereBase.supplier = { name: { contains: params.supplier, mode: 'insensitive' } };
  }
  if (params.minStock || params.maxStock) {
    productWhereBase.stockQty = {
      ...(params.minStock ? { gte: parseInt(params.minStock) } : {}),
      ...(params.maxStock ? { lte: parseInt(params.maxStock) } : {}),
    };
  }

  // Sale item base filter for top products / frequency
  const saleItemSaleFilter: Record<string, unknown> = { ...saleFilter, createdAt: dateRangeFilter };
  if (params.status) saleItemSaleFilter.status = params.status;
  const saleItemProductFilter: Record<string, unknown> = {};
  if (params.product)  saleItemProductFilter.name = { contains: params.product, mode: 'insensitive' };
  if (params.category) saleItemProductFilter.category = { contains: params.category, mode: 'insensitive' };

  const topProductsOrderBy = params.sortBy === 'revenue'
    ? { _sum: { price: 'desc' as const } }
    : { _sum: { quantity: 'desc' as const } };

  // ── Sales data ───────────────────────────────────────────────────────────────
  const [salesSummary, totalRevenue, recentSales, topProducts, lowStockProducts, expiringProducts] =
    await Promise.all([
      prisma.sale.findMany({
        where: saleWhereBase as any,
        orderBy: { createdAt: 'asc' },
        include: { customer: true, items: { include: { product: true } } },
      }),
      prisma.sale.aggregate({
        _sum: { totalAmount: true },
        _count: true,
        where: saleWhereBase as any,
      }),
      prisma.sale.findMany({
        where: saleFilter,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { customer: true, items: true },
      }),
      prisma.saleItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true, price: true },
        orderBy: topProductsOrderBy,
        take: 10,
        where: {
          sale: saleItemSaleFilter as any,
          ...(Object.keys(saleItemProductFilter).length > 0 ? { product: saleItemProductFilter as any } : {}),
        },
      }),
      prisma.product.findMany({
        where: { ...tenantFilter, ...productWhereBase, stockQty: { lte: 10 } } as any,
        orderBy: { stockQty: 'asc' },
        take: 20,
      }),
      prisma.product.findMany({
        where: {
          ...tenantFilter,
          ...productWhereBase,
          expiryDate: {
            lte: new Date(Date.now() + (parseInt(params.expiryDays ?? '90', 10)) * 24 * 60 * 60 * 1000),
            gt: new Date(),
          },
        } as any,
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

  const revenue  = totalRevenue._sum.totalAmount ?? 0;
  const txCount  = totalRevenue._count ?? 0;
  const avgSale  = txCount > 0 ? revenue / txCount : 0;

  // Group sales by day
  const salesByDay = new Map<string, number>();
  for (const sale of salesSummary) {
    const day = new Date(sale.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    salesByDay.set(day, (salesByDay.get(day) ?? 0) + sale.totalAmount);
  }
  const days = parseInt(range, 10) || 30;
  const dailyData = Array.from(salesByDay.entries()).slice(-days);
  const maxDay = Math.max(...dailyData.map(d => d[1]), 1);

  // ── Payments tab ─────────────────────────────────────────────────────────────
  const paymentWhereBase: Record<string, unknown> = {
    ...saleFilter,
    createdAt: dateRangeFilter,
    sale: { status: { not: 'voided' } },
  };
  if (params.paymentMethod) paymentWhereBase.paymentMethod = params.paymentMethod;

  const paymentBreakdown = tab === 'sales'
    ? await prisma.salePayment.groupBy({
        by: ['paymentMethod'],
        _sum: { amount: true },
        _count: true,
        where: paymentWhereBase as any,
      })
    : [];
  const paymentTotal = paymentBreakdown.reduce((s, p) => s + (p._sum.amount ?? 0), 0);

  // ── Frequency tab ─────────────────────────────────────────────────────────────
  const frequencyWhere: Record<string, unknown> = {
    sale: { ...saleFilter, status: { not: 'voided' }, createdAt: dateRangeFilter },
  };
  if (Object.keys(saleItemProductFilter).length > 0) {
    frequencyWhere.product = saleItemProductFilter;
  }
  const frequency = tab === 'products'
    ? await prisma.saleItem.groupBy({
        by: ['productId'],
        _count: { _all: true },
        _sum: { quantity: true },
        orderBy: { _count: { productId: 'desc' } },
        take: 25,
        where: frequencyWhere as any,
      })
    : [];
  const freqNames = frequency.length
    ? await prisma.product.findMany({
        where: { id: { in: frequency.map(f => f.productId) } },
        select: { id: true, name: true, category: true },
      })
    : [];
  const freqMap = new Map(freqNames.map(p => [p.id, p]));

  const PAYMENT_LABEL: Record<string, string> = { cash: 'Cash', mobile_money: 'Mobile Money', card: 'Card', credit: 'Credit' };

  // ── Monthly tab ──────────────────────────────────────────────────────────────
  const now = new Date();
  const selMonth = params.month ? parseInt(params.month, 10) - 1 : now.getMonth();
  const selYear  = params.year  ? parseInt(params.year, 10)  : now.getFullYear();
  const monthStart = new Date(selYear, selMonth, 1);
  const monthEnd   = new Date(selYear, selMonth + 1, 0, 23, 59, 59);
  const prevMonthStart = new Date(selYear, selMonth - 1, 1);
  const prevMonthEnd   = new Date(selYear, selMonth, 0, 23, 59, 59);

  let monthly: null | {
    thisRevenue: number; lastRevenue: number; changePct: number | null; saleCount: number;
    topProducts: { name: string; quantity: number; revenue: number }[];
    topCustomers: { name: string; visits: number; spent: number }[];
    byMethod: { method: string; amount: number }[];
    stockCost: number; stockSelling: number;
  } = null;

  if (tab === 'sales') {
    const [thisRev, lastRev, topQty, topCust, methodRev, stockProducts] = await Promise.all([
      prisma.sale.aggregate({ _sum: { totalAmount: true }, _count: true, where: { ...saleFilter, status: { not: 'voided' }, createdAt: { gte: monthStart, lte: monthEnd } } }),
      prisma.sale.aggregate({ _sum: { totalAmount: true }, where: { ...saleFilter, status: { not: 'voided' }, createdAt: { gte: prevMonthStart, lte: prevMonthEnd } } }),
      prisma.saleItem.groupBy({ by: ['productId'], _sum: { quantity: true, price: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 10, where: { sale: { ...saleFilter, status: { not: 'voided' }, createdAt: { gte: monthStart, lte: monthEnd } } } }),
      prisma.sale.groupBy({ by: ['customerId'], _count: true, _sum: { totalAmount: true }, orderBy: { _count: { customerId: 'desc' } }, take: 10, where: { ...saleFilter, status: { not: 'voided' }, createdAt: { gte: monthStart, lte: monthEnd }, customerId: { not: null } } }),
      prisma.salePayment.groupBy({ by: ['paymentMethod'], _sum: { amount: true }, where: { ...saleFilter, createdAt: { gte: monthStart, lte: monthEnd }, sale: { status: { not: 'voided' } } } }),
      prisma.product.findMany({ where: { tenantId, isActive: true }, select: { stockQty: true, costPrice: true, price: true } }),
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
      stockCost: stockProducts.reduce((s, i) => s + (i.costPrice ?? 0) * i.stockQty, 0),
      stockSelling: stockProducts.reduce((s, i) => s + i.price * i.stockQty, 0),
    };
  }

  // ── Stock Valuation tab ──────────────────────────────────────────────────────
  let valuation: null | {
    rows: { id: number; name: string; category: string; quantity: number; costPrice: number; sellingPrice: number; costValue: number; sellingValue: number; profit: number }[];
    totalProducts: number; totalQty: number; totalCost: number; totalSelling: number; totalProfit: number;
  } = null;

  if (tab === 'inventory') {
    const valProducts = await prisma.product.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, category: true, stockQty: true, costPrice: true, price: true },
    });
    const valRows = valProducts.map((p) => {
      const costPrice = p.costPrice ?? 0;
      const sellingPrice = p.price;
      const costValue = costPrice * p.stockQty;
      const sellingValue = sellingPrice * p.stockQty;
      return {
        id: p.id, name: p.name, category: p.category, quantity: p.stockQty,
        costPrice, sellingPrice, costValue, sellingValue, profit: sellingValue - costValue,
      };
    });
    valRows.sort((a, b) => b.sellingValue - a.sellingValue);
    const totalCost = valRows.reduce((a, r) => a + r.costValue, 0);
    const totalSelling = valRows.reduce((a, r) => a + r.sellingValue, 0);
    valuation = {
      rows: valRows,
      totalProducts: valProducts.length,
      totalQty: valRows.reduce((a, r) => a + r.quantity, 0),
      totalCost,
      totalSelling,
      totalProfit: totalSelling - totalCost,
    };
  }

  const expiryDays = parseInt(params.expiryDays ?? '90', 10);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Pick a report type and date range, view the details, then export."
      />

      <ReportsTabs tab={tab} />

      <ReportControls
        type={tab}
        from={params.from ?? rangeStart.toISOString().slice(0, 10)}
        to={params.to ?? rangeEnd.toISOString().slice(0, 10)}
      />

      {/* ── SALES & FINANCE TAB ───────────────────────────────────────────────── */}
      {tab === 'sales' && (
        <div className="space-y-6">
          {/* KPI Stat Cards (Dashboard StatCard style) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Revenue', value: `₵${revenue.toFixed(2)}`, sub: `Last ${range} days`, change: null },
              { label: 'Transactions', value: txCount.toLocaleString(), sub: `Last ${range} days`, change: null },
              { label: 'Avg Sale Value', value: `₵${avgSale.toFixed(2)}`, sub: 'Per transaction', change: null },
              { 
                label: 'MoM Change', 
                value: monthly?.changePct !== undefined && monthly.changePct !== null 
                  ? `${monthly.changePct >= 0 ? '+' : ''}${monthly.changePct.toFixed(1)}%` 
                  : '—', 
                sub: monthly ? `Last Mo: ₵${monthly.lastRevenue.toFixed(0)}` : 'No comparison data',
                change: monthly?.changePct ?? null
              },
            ].map((kpi, i) => (
              <Card key={i} className="p-6 py-6 gap-0">
                <div className="flex items-center gap-1.5 mb-4">
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <p className="text-3xl font-medium text-card-foreground leading-none tracking-tight">
                    {kpi.value}
                  </p>
                  {kpi.change !== null && (
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                        kpi.change >= 0
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                          : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600'
                      }`}
                    >
                      {kpi.change >= 0 ? '+' : ''}
                      {kpi.change.toFixed(1)}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">{kpi.sub}</p>
              </Card>
            ))}
          </div>

          {/* Daily Revenue Chart Card */}
          <Card className="gap-0">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4">
              <div>
                <CardTitle className="text-base font-medium text-foreground">Daily Revenue</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Last {Math.min(dailyData.length, 14)} days</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
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
                        className="w-full bg-primary rounded-t-md transition-all hover:bg-primary/90"
                        style={{ height: `${Math.max((total / maxDay) * 100, 4)}%` }}
                      />
                      <span className="text-[9px] text-muted-foreground font-medium">{day}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Total Collected Payment Breakdown Card */}
          <Card className="gap-0">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4">
              <div>
                <CardTitle className="text-base font-medium text-foreground">Total collected</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Last {range} days · excludes voided sales</CardDescription>
              </div>
              <span className="text-2xl font-semibold text-card-foreground">₵{paymentTotal.toFixed(2)}</span>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex h-3 rounded-full overflow-hidden bg-muted my-3">
                {['cash', 'mobile_money', 'card', 'credit'].map((m, i) => {
                  const amt = paymentBreakdown.find((p) => p.paymentMethod === m)?._sum.amount ?? 0;
                  const pct = paymentTotal > 0 ? (amt / paymentTotal) * 100 : 0;
                  const colors = ['bg-primary', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
                  return pct > 0 ? (
                    <div 
                      key={m} 
                      className={`${colors[i]} transition-all duration-500`} 
                      style={{ width: `${pct}%` }} 
                      title={`${PAYMENT_LABEL[m]} ${pct.toFixed(1)}%`} 
                    />
                  ) : null;
                })}
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 pt-4 border-t border-border/40">
                {['cash', 'mobile_money', 'card', 'credit'].map((m, i) => {
                  const row = paymentBreakdown.find((p) => p.paymentMethod === m);
                  const amt = row?._sum.amount ?? 0;
                  const pct = paymentTotal > 0 ? (amt / paymentTotal) * 100 : 0;
                  const bulletColors = ['bg-primary', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
                  return (
                    <div key={m} className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${bulletColors[i]}`} />
                      <span className="text-xs font-semibold text-foreground">{PAYMENT_LABEL[m]}</span>
                      <span className="text-xs text-muted-foreground">({pct.toFixed(1)}% · ₵{amt.toFixed(2)})</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AI Summary */}
            {monthly && <MonthlyAiSummary data={monthly} />}

            {/* Recent transactions */}
            <Card className="gap-0">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4">
                <div>
                  <CardTitle className="text-base font-medium text-foreground">Recent Transactions</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">{recentSales.length} shown</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/40">
                {recentSales.length === 0 ? (
                  <p className="px-6 py-10 text-center text-sm text-muted-foreground">No transactions yet.</p>
                ) : recentSales.map(sale => (
                  <div key={sale.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                        {(sale.customer?.name ?? 'W')[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{sale.customer?.name ?? 'Walk-in'}</p>
                        <p className="text-xs text-muted-foreground">{new Date(sale.createdAt).toLocaleString()} · {sale.items.length} items</p>
                      </div>
                    </div>
                    <span className="font-semibold text-foreground text-sm">₵{sale.totalAmount.toFixed(2)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── INVENTORY HEALTH TAB ──────────────────────────────────────────────── */}
      {tab === 'inventory' && valuation && (
        <div className="space-y-6">
          {/* Main Stock Value KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: 'Total Products', value: valuation.totalProducts.toLocaleString() },
              { label: 'Total Quantity', value: valuation.totalQty.toLocaleString() },
              { label: 'Total Cost Value', value: `₵${valuation.totalCost.toFixed(2)}` },
              { label: 'Total Selling Value', value: `₵${valuation.totalSelling.toFixed(2)}` },
              { label: 'Potential Profit', value: `₵${valuation.totalProfit.toFixed(2)}` },
            ].map((kpi, i) => (
              <Card key={i} className="p-6 py-6 gap-0">
                <p className="text-sm text-muted-foreground mb-4">{kpi.label}</p>
                <p className="text-3xl font-medium text-card-foreground leading-none tracking-tight">{kpi.value}</p>
              </Card>
            ))}
          </div>

          {/* Quick Alert Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-6 py-6 gap-0">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">Low Stock Alerts</p>
                <AlertCircle size={18} className="text-amber-500" />
              </div>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-medium text-card-foreground leading-none tracking-tight">{lowStockProducts.length}</p>
                {lowStockProducts.length > 0 && <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mb-1" />}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Products at or below threshold (10 units)</p>
            </Card>

            <Card className="p-6 py-6 gap-0">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">Expiring Soon</p>
                <Calendar size={18} className="text-rose-500" />
              </div>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-medium text-card-foreground leading-none tracking-tight">{expiringProducts.length}</p>
                {expiringProducts.length > 0 && <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mb-1" />}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Products expiring within {expiryDays} days</p>
            </Card>
          </div>

          {/* Stock Valuation Table Card */}
          <Card className="gap-0">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4">
              <div>
                <CardTitle className="text-base font-medium text-foreground">Stock Valuation</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Point-in-time snapshot of active products · sorted by selling value</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {valuation.rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Package size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">No stock items</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Cost Price</TableHead>
                      <TableHead className="text-right">Selling Price</TableHead>
                      <TableHead className="text-right">Cost Value</TableHead>
                      <TableHead className="text-right">Selling Value</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {valuation.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.category || '—'}</TableCell>
                        <TableCell className="text-right">{r.quantity}</TableCell>
                        <TableCell className="text-right">₵{r.costPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right">₵{r.sellingPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right">₵{r.costValue.toFixed(2)}</TableCell>
                        <TableCell className="text-right">₵{r.sellingValue.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">₵{r.profit.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Sub Alert Tables Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low Stock Alerts */}
            <Card className="gap-0">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4">
                <div>
                  <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-500" /> Low Stock Details
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">{lowStockProducts.length} items requiring restock</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {lowStockProducts.length === 0 ? (
                  <p className="px-6 py-8 text-center text-sm text-muted-foreground">All products have healthy stock levels.</p>
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
              </CardContent>
            </Card>

            {/* Expiring Soon */}
            <Card className="gap-0">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4">
                <div>
                  <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                    <Calendar size={16} className="text-rose-500" /> Expiry Log
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">{expiringProducts.length} items within {expiryDays} days</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {expiringProducts.length === 0 ? (
                  <p className="px-6 py-8 text-center text-sm text-muted-foreground">No expiring items in the next {expiryDays} days.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
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
                            <TableCell className="text-foreground">{p.stockQty}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Badge variant={urgent ? 'destructive' : 'warning'}>{daysLeft}d left</Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── PRODUCT PERFORMANCE TAB ───────────────────────────────────────────── */}
      {tab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Selling Products */}
          <Card className="gap-0">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4">
              <div>
                <CardTitle className="text-base font-medium text-foreground">Top Selling Products</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Ranked by {params.sortBy === 'revenue' ? 'revenue' : 'units sold'} in the last {range} days</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {topProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Package size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">No sales data for this period</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {topProducts.map((tp, i) => {
                    const product = productMap.get(tp.productId);
                    const maxQty = (topProducts[0]?._sum?.quantity ?? 1) || 1;
                    const pct = (((tp._sum?.quantity ?? 0) as number) / maxQty) * 100;
                    return (
                      <div key={tp.productId} className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}</span>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1.5">
                              <div>
                                <p className="text-sm font-medium text-foreground">{product?.name ?? `Product #${tp.productId}`}</p>
                                <p className="text-xs text-muted-foreground">{product?.category ?? '—'}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-foreground">{(tp._sum?.quantity ?? 0) as number} units</p>
                                <p className="text-xs text-muted-foreground">₵{((tp._sum?.price ?? 0) as number).toFixed(2)} revenue</p>
                              </div>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Purchase Frequency */}
          <Card className="gap-0">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4">
              <div>
                <CardTitle className="text-base font-medium text-foreground">Most Frequently Sold</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Ranked by number of transactions in the last {range} days</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
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
                          <TableCell className="text-right font-bold">{f._count._all}</TableCell>
                          <TableCell className="text-right">{f._sum.quantity ?? 0}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
