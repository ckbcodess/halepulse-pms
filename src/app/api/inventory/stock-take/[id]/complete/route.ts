import { NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth/checkRole';
import { applyStockDelta, branchQty } from '@/lib/inventory/stock';
import prisma from '@/lib/prisma';

const STOCK_TAKE_ROLES = ['tenant_admin', 'branch_manager', 'pharmacist', 'MANAGER', 'MCA'];

// ── POST /api/inventory/stock-take/[id]/complete ──────────────────────────────
// Body: { counts: [{ productId, physicalCount }] }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await checkRole(...STOCK_TAKE_ROLES);
    const userId = parseInt(ctx.userId, 10);
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (isNaN(sessionId)) return NextResponse.json({ error: 'Invalid session' }, { status: 400 });

    const session = await prisma.stockTakeSession.findFirst({
      where: { id: sessionId, tenantId: ctx.tenantId },
    });
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (session.status !== 'in_progress') {
      return NextResponse.json({ error: 'Session is not in progress' }, { status: 409 });
    }

    const body = (await request.json()) as { counts: { productId: number; physicalCount: number }[] };
    const counts = (body.counts ?? []).filter(
      (c) => Number.isInteger(c.productId) && Number.isInteger(c.physicalCount) && c.physicalCount >= 0,
    );

    const branchId = session.branchId;
    let itemsChecked = 0;
    let discrepanciesFound = 0;
    const adjustments: { productId: number; systemQty: number; physicalCount: number; delta: number }[] = [];

    await prisma.$transaction(async (tx) => {
      for (const c of counts) {
        itemsChecked++;
        const systemQty = await branchQty(tx, ctx.tenantId, branchId, c.productId);
        const delta = c.physicalCount - systemQty;
        if (delta === 0) continue;

        discrepanciesFound++;
        const product = await tx.product.findFirst({
          where: { id: c.productId, tenantId: ctx.tenantId },
          select: { stockQty: true, costPrice: true, markupPercent: true, price: true },
        });
        if (!product) continue;

        await applyStockDelta(tx, {
          tenantId: ctx.tenantId,
          branchId,
          productId: c.productId,
          delta,
          movementType: 'stock_take',
          performedById: userId,
          reason: 'Stock take reconciliation',
          referenceId: sessionId,
          fallbackCost: product.costPrice ?? 0,
          fallbackMarkup: product.markupPercent,
          fallbackSelling: product.price,
        });

        // Dual-write the legacy authority + adjustments view + audit trail.
        await tx.product.update({ where: { id: c.productId }, data: { stockQty: { increment: delta } } });
        await tx.stockAdjustment.create({
          data: {
            productId: c.productId,
            adjustedBy: userId,
            oldQuantity: product.stockQty,
            newQuantity: product.stockQty + delta,
            delta,
            reason: 'Stock Take',
            tenantId: ctx.tenantId,
            branchId,
          },
        });
        await tx.inventoryAuditLog.create({
          data: {
            actionType: 'STOCK_TAKE_ADJUSTED',
            productId: c.productId,
            performedBy: userId,
            oldValue: { stockQty: product.stockQty },
            newValue: { stockQty: product.stockQty + delta, delta, systemQty, physicalCount: c.physicalCount, sessionId },
            tenantId: ctx.tenantId,
          },
        });

        adjustments.push({ productId: c.productId, systemQty, physicalCount: c.physicalCount, delta });
      }

      await tx.stockTakeSession.update({
        where: { id: sessionId },
        data: { status: 'completed', itemsChecked, discrepanciesFound, completedBy: userId, completedAt: new Date() },
      });
    }, { timeout: 120000, maxWait: 10000 });

    return NextResponse.json({ ok: true, itemsChecked, discrepanciesFound, adjustments });
  } catch (err: any) {
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Stock take complete error:', err);
    return NextResponse.json({ error: 'Failed to complete stock take' }, { status: 500 });
  }
}
