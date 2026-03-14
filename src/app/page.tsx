import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { getImpersonation } from '@/lib/auth/getImpersonation';
import DashboardView from './dashboard/manager/DashboardView';

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  const impersonation = await getImpersonation();

  // Resolve tenant context — impersonation overrides session
  const tenantId = impersonation?.tenantId ?? session?.user?.tenantId ?? null;

  // ── Date boundaries ──
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const yearStart = new Date(todayStart.getFullYear(), 0, 1);

  // Build optional tenant filter
  const tenantFilter = tenantId ? { tenantId } : {};

  // ── Parallel data fetching ──
  const [
    totalProducts,
    lowStock,
    expiringSoon,
    salesTodayAgg,
    salesYesterdayAgg,
    yearSales,
    todaySalesByPayment,
    recentSales,
  ] = await Promise.all([
    prisma.product.count({ where: tenantFilter }),
    prisma.product.count({ where: { ...tenantFilter, stockQty: { lte: 5 } } }),
    prisma.product.count({
      where: { ...tenantFilter, expiryDate: { gt: new Date(), lte: in30Days } },
    }),
    prisma.sale.aggregate({
      _sum: { totalAmount: true },
      _count: true,
      where: { ...tenantFilter, createdAt: { gte: todayStart } },
    }),
    prisma.sale.aggregate({
      _sum: { totalAmount: true },
      where: { ...tenantFilter, createdAt: { gte: yesterdayStart, lt: todayStart } },
    }),
    prisma.sale.findMany({
      where: { ...tenantFilter, createdAt: { gte: yearStart } },
      select: { totalAmount: true, createdAt: true },
    }),
    prisma.sale.groupBy({
      by: ['paymentType'],
      _sum: { totalAmount: true },
      where: { ...tenantFilter, createdAt: { gte: todayStart } },
    }),
    prisma.sale.findMany({
      where: tenantFilter,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { customer: true, items: true },
    }),
  ]);

  // ── Derived data ──

  // Sales change percentage (today vs yesterday)
  const todayTotal = salesTodayAgg._sum.totalAmount ?? 0;
  const yesterdayTotal = salesYesterdayAgg._sum.totalAmount ?? 0;
  const salesChange =
    yesterdayTotal > 0
      ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100
      : todayTotal > 0
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

  const userName = session?.user?.email ?? 'User';

  return (
    <DashboardView
      userName={userName}
      stats={{
        totalProducts,
        lowStock,
        expiringSoon,
        salesToday: todayTotal,
        salesChange,
      }}
      monthlySales={monthlySales}
      todayByPayment={todayByPayment}
      recentSales={formattedSales}
      alerts={{
        lowStockCount: lowStock,
        expiringCount: expiringSoon,
      }}
    />
  );
}
