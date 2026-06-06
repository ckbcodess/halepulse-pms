import { NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth/checkRole';
import { resolveBranchId } from '@/lib/auth/branchContext';
import prisma from '@/lib/prisma';

// Roles permitted to run a stock take (blueprint §5.2: TA/BM/Pharmacist + SA bypass).
const STOCK_TAKE_ROLES = ['tenant_admin', 'branch_manager', 'pharmacist', 'MANAGER', 'MCA'];

// ── GET /api/inventory/stock-take — recent sessions for the branch ─────────────
export async function GET() {
  try {
    const ctx = await checkRole(...STOCK_TAKE_ROLES);
    const branchId = await resolveBranchId(ctx);
    const sessions = await prisma.stockTakeSession.findMany({
      where: { tenantId: ctx.tenantId, branchId },
      orderBy: { startedAt: 'desc' },
      take: 20,
      include: {
        initiator: { select: { username: true } },
        completer: { select: { username: true } },
      },
    });
    return NextResponse.json({ sessions });
  } catch (err: any) {
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
  }
}

// ── POST /api/inventory/stock-take — start a session + return the count sheet ──
export async function POST() {
  try {
    const ctx = await checkRole(...STOCK_TAKE_ROLES);
    const branchId = await resolveBranchId(ctx);

    const session = await prisma.stockTakeSession.create({
      data: { tenantId: ctx.tenantId, branchId, status: 'in_progress', initiatedBy: parseInt(ctx.userId, 10) },
    });

    // Count sheet: products stocked at this branch, with current batch quantity.
    const grouped = await prisma.stockItem.groupBy({
      by: ['productId'],
      where: { tenantId: ctx.tenantId, branchId },
      _sum: { quantity: true },
    });
    const productIds = grouped.map((g) => g.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, name: true, sku: true, category: true },
    });
    const nameMap = new Map(products.map((p) => [p.id, p]));
    const qtyMap = new Map(grouped.map((g) => [g.productId, g._sum.quantity ?? 0]));

    const items = products
      .map((p) => ({
        productId: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        systemQty: qtyMap.get(p.id) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ session, items }, { status: 201 });
  } catch (err: any) {
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to start stock take' }, { status: 500 });
  }
}
