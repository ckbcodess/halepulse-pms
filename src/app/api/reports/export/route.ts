import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { branchWhere } from '@/lib/auth/branchScope';
import prisma from '@/lib/prisma';

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

// ── GET /api/reports/export?type=sales|frequency|inventory&range=N ─────────────
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantContext();
    const bf = await branchWhere(ctx);
    const sp = request.nextUrl.searchParams;
    const type = sp.get('type') ?? 'sales';
    const fromParam = sp.get('from');
    const toParam = sp.get('to');

    let rangeStart: Date;
    if (fromParam) {
      rangeStart = new Date(fromParam);
      rangeStart.setHours(0, 0, 0, 0);
    } else {
      const days = parseInt(sp.get('range') ?? '30', 10) || 30;
      rangeStart = new Date();
      rangeStart.setDate(rangeStart.getDate() - days);
      rangeStart.setHours(0, 0, 0, 0);
    }
    const rangeEnd = toParam ? new Date(toParam + 'T23:59:59') : new Date();
    const dateRange = { gte: rangeStart, lte: rangeEnd };

    const filename = `${type}-report.csv`;
    let csv = '';

    if (type === 'sales') {
      const sales = await prisma.sale.findMany({
        where: { tenantId: ctx.tenantId, ...bf, createdAt: dateRange },
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } }, payments: { select: { paymentMethod: true, amount: true } }, _count: { select: { items: true } } },
      });
      csv = toCsv(
        ['Sale ID', 'Date', 'Customer', 'Items', 'Total', 'Status', 'Payments'],
        sales.map((s) => [
          s.id,
          s.createdAt.toISOString(),
          s.customer?.name ?? 'Walk-in',
          s._count.items,
          s.totalAmount.toFixed(2),
          s.status,
          s.payments.map((p) => `${p.paymentMethod}:${p.amount.toFixed(2)}`).join(' | '),
        ]),
      );
    } else if (type === 'frequency') {
      const freq = await prisma.saleItem.groupBy({
        by: ['productId'],
        _count: { _all: true },
        _sum: { quantity: true },
        orderBy: { _count: { productId: 'desc' } },
        take: 500,
        where: { sale: { tenantId: ctx.tenantId, ...bf, status: { not: 'voided' }, createdAt: dateRange } },
      });
      const names = new Map((await prisma.product.findMany({ where: { id: { in: freq.map((f) => f.productId) } }, select: { id: true, name: true, category: true } })).map((p) => [p.id, p]));
      csv = toCsv(
        ['Product', 'Category', 'Transactions', 'Units'],
        freq.map((f) => [names.get(f.productId)?.name ?? `#${f.productId}`, names.get(f.productId)?.category ?? '', f._count._all, f._sum.quantity ?? 0]),
      );
    } else if (type === 'products') {
      const top = await prisma.saleItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true, price: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 500,
        where: { sale: { tenantId: ctx.tenantId, ...bf, status: { not: 'voided' }, createdAt: dateRange } },
      });
      const names = new Map((await prisma.product.findMany({ where: { id: { in: top.map((t) => t.productId) } }, select: { id: true, name: true, category: true } })).map((p) => [p.id, p]));
      csv = toCsv(
        ['Product', 'Category', 'Units Sold', 'Revenue'],
        top.map((t) => [names.get(t.productId)?.name ?? `#${t.productId}`, names.get(t.productId)?.category ?? '', t._sum.quantity ?? 0, (t._sum.price ?? 0).toFixed(2)]),
      );
    } else if (type === 'payments') {
      const pays = await prisma.salePayment.groupBy({
        by: ['paymentMethod'],
        _sum: { amount: true },
        _count: true,
        where: { tenantId: ctx.tenantId, ...bf, createdAt: dateRange, sale: { status: { not: 'voided' } } },
      });
      csv = toCsv(
        ['Payment Method', 'Count', 'Total Collected'],
        pays.map((p) => [p.paymentMethod, p._count, (p._sum.amount ?? 0).toFixed(2)]),
      );
    } else if (type === 'inventory') {
      const products = await prisma.product.findMany({
        where: { tenantId: ctx.tenantId, isActive: true },
        orderBy: { name: 'asc' },
        select: { name: true, category: true, sku: true, stockQty: true, lowStockThreshold: true, costPrice: true, price: true, expiryDate: true },
      });
      csv = toCsv(
        ['Product', 'Category', 'SKU', 'Stock', 'Low Stock Threshold', 'Status', 'Cost', 'Selling', 'Expiry'],
        products.map((p) => {
          const status = p.stockQty <= 0 ? 'OUT' : p.stockQty <= p.lowStockThreshold ? 'LOW' : 'OK';
          return [p.name, p.category, p.sku ?? '', p.stockQty, p.lowStockThreshold, status, (p.costPrice ?? 0).toFixed(2), p.price.toFixed(2), p.expiryDate ? p.expiryDate.toISOString().slice(0, 10) : ''];
        }),
      );
    } else if (type === 'expiry') {
      const products = await prisma.product.findMany({
        where: { tenantId: ctx.tenantId, isActive: true, expiryDate: { not: null, gt: new Date() } },
        orderBy: { expiryDate: 'asc' },
        select: { name: true, category: true, stockQty: true, expiryDate: true },
      });
      csv = toCsv(
        ['Product', 'Category', 'Stock', 'Expiry Date', 'Days Left'],
        products.map((p) => {
          const daysLeft = Math.ceil((new Date(p.expiryDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return [p.name, p.category, p.stockQty, p.expiryDate!.toISOString().slice(0, 10), daysLeft];
        }),
      );
    } else {
      return NextResponse.json({ error: 'Unknown export type' }, { status: 400 });
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
