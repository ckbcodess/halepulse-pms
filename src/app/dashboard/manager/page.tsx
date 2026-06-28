import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { getImpersonation } from '@/lib/auth/getImpersonation';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { branchWhere } from '@/lib/auth/branchScope';
import prisma from '@/lib/prisma';
import DashboardView from './DashboardView';
import { getHiddenWidgets } from '@/lib/dashboard/widgets';

export default async function ManagerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; compare?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const impersonation = await getImpersonation();
  const isImpersonating = !!impersonation;

  if (!isImpersonating && session.user.role !== 'MANAGER') redirect('/login');

  const tenantId = isImpersonating ? impersonation.tenantId : session.user.tenantId!;

  const ctx = await getTenantContext();
  const branchFilter = await branchWhere(ctx); // {} for tenant-wide, { branchId } when scoped
  const effectiveRole = isImpersonating ? impersonation.role : session.user.role;
  const hiddenWidgets = Array.from(await getHiddenWidgets(tenantId, effectiveRole));

  // ── Date boundaries ──
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const yearStart = new Date(todayStart.getFullYear(), 0, 1);

  // ── Period filter (range + compare) ──
  const RANGE_DAYS: Record<string, number> = { 'today': 1, '7': 7, '30': 30, '90': 90, '365': 365 };
  const RANGE_LABEL: Record<string, string> = {
    'today': 'Today', '7': 'Last 7 days', '30': 'Last 30 days', '90': 'Last 90 days', '365': 'Last 12 months',
  };
  const sp = await searchParams;
  const range = sp.range && RANGE_DAYS[sp.range] ? sp.range : '30';
  const rangeDays = RANGE_DAYS[range];
  const rangeLabel = RANGE_LABEL[range];
  const compare = (sp.compare ?? '1') !== '0';

  // Current window starts at `rangeStart`; the comparison window is the equal
  // span immediately before it. "Today" compares against yesterday.
  const rangeStart = new Date(todayStart);
  const prevStart = new Date(todayStart);
  if (range === 'today') {
    prevStart.setDate(prevStart.getDate() - 1);
  } else {
    rangeStart.setDate(rangeStart.getDate() - rangeDays);
    prevStart.setDate(prevStart.getDate() - rangeDays * 2);
  }

  // ── Parallel data fetching ──
  const [
    totalProducts,
    lowStock,
    expiringSoon,
    salesRangeAgg,
    salesPrevAgg,
    yearSales,
    todaySalesByPayment,
    recentSales,
  ] = await Promise.all([
    prisma.product.count({ where: { tenantId } }),
    prisma.product.count({ where: { tenantId, stockQty: { lte: 5 } } }),
    prisma.product.count({
      where: { tenantId, expiryDate: { gt: new Date(), lte: in30Days } },
    }),
    prisma.sale.aggregate({
      _sum: { totalAmount: true },
      _count: true,
      where: { tenantId, ...branchFilter, createdAt: { gte: rangeStart } },
    }),
    prisma.sale.aggregate({
      _sum: { totalAmount: true },
      where: { tenantId, ...branchFilter, createdAt: { gte: prevStart, lt: rangeStart } },
    }),
    prisma.sale.findMany({
      where: { tenantId, ...branchFilter, createdAt: { gte: yearStart } },
      select: { totalAmount: true, createdAt: true },
    }),
    prisma.sale.groupBy({
      by: ['paymentType'],
      _sum: { totalAmount: true },
      where: { tenantId, ...branchFilter, createdAt: { gte: todayStart } },
    }),
    prisma.sale.findMany({
      where: { tenantId, ...branchFilter },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { customer: true, items: true },
    }),
  ]);

  // ── Derived data ──

  // Sales total for the selected range, with change vs the previous equal period
  const rangeTotal = salesRangeAgg._sum.totalAmount ?? 0;
  const prevTotal = salesPrevAgg._sum.totalAmount ?? 0;
  const salesChange = !compare
    ? null
    : prevTotal > 0
      ? ((rangeTotal - prevTotal) / prevTotal) * 100
      : rangeTotal > 0
        ? 100
        : null;

  // Monthly sales for bar chart
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyMap = new Map<number, number>();
  for (const sale of yearSales) {
    const month = new Date(sale.createdAt).getMonth();
    monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + sale.totalAmount);
  }
  const monthlySales = months.map((name, i) => ({
    month: name,
    amount: Math.round((monthlyMap.get(i) ?? 0) * 100) / 100,
  }));

  // Today's sales by payment type for donut chart
  const todayByPayment = todaySalesByPayment.map((g) => ({
    name: g.paymentType || 'Other',
    value: g._sum.totalAmount ?? 0,
  }));

  // Recent sales formatted for client
  const formattedSales = recentSales.map((s) => ({
    id: s.id,
    customerName: s.customer?.name ?? 'Walk-in Customer',
    time: new Date(s.createdAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    itemCount: s.items.length,
    amount: s.totalAmount,
  }));

  return (
    <DashboardView
      userName={session.user.email}
      firstName={session.user.firstName}
      stats={{
        totalProducts,
        lowStock,
        expiringSoon,
        salesToday: rangeTotal,
        salesChange,
      }}
      monthlySales={monthlySales}
      todayByPayment={todayByPayment}
      recentSales={formattedSales}
      alerts={{
        lowStockCount: lowStock,
        expiringCount: expiringSoon,
      }}
      hiddenWidgets={hiddenWidgets}
      range={range}
      compare={compare}
      salesLabel={rangeLabel}
    />
  );
}
