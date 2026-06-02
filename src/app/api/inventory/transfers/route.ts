import { NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth/checkRole';
import { resolveBranchId } from '@/lib/auth/branchContext';
import { applyStockDelta, branchQty } from '@/lib/inventory/stock';
import prisma from '@/lib/prisma';

// Transfers: tenant_admin / branch_manager (+ super_admin bypass), blueprint §5.2.
const TRANSFER_ROLES = ['tenant_admin', 'branch_manager', 'MANAGER'];

// ── POST /api/inventory/transfers ─────────────────────────────────────────────
// Body: { destinationBranchId, productId, quantity }
// Direct transfer: deducts the source branch, adds the destination, recording
// paired transfer_out / transfer_in movements. Product.stockQty (tenant-global)
// is unchanged — only the branch distribution moves.
export async function POST(request: Request) {
  try {
    const ctx = await checkRole(...TRANSFER_ROLES);
    const userId = parseInt(ctx.userId, 10);
    const sourceBranchId = await resolveBranchId(ctx);

    const body = (await request.json()) as {
      destinationBranchId?: string;
      productId?: number;
      quantity?: number;
    };
    const { destinationBranchId, productId, quantity } = body;

    if (!destinationBranchId || !productId || !quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      return NextResponse.json({ error: 'destinationBranchId, productId and a positive integer quantity are required' }, { status: 400 });
    }
    if (destinationBranchId === sourceBranchId) {
      return NextResponse.json({ error: 'Source and destination branches must differ' }, { status: 400 });
    }

    const [source, dest, product] = await Promise.all([
      prisma.branch.findFirst({ where: { id: sourceBranchId, tenantId: ctx.tenantId }, select: { id: true, name: true } }),
      prisma.branch.findFirst({ where: { id: destinationBranchId, tenantId: ctx.tenantId, isActive: true }, select: { id: true, name: true } }),
      prisma.product.findFirst({ where: { id: productId, tenantId: ctx.tenantId }, select: { id: true, name: true, costPrice: true, markupPercent: true, price: true } }),
    ]);
    if (!source) return NextResponse.json({ error: 'Source branch not found' }, { status: 404 });
    if (!dest) return NextResponse.json({ error: 'Destination branch not found' }, { status: 404 });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const available = await branchQty(prisma, ctx.tenantId, sourceBranchId, productId);
    if (available < quantity) {
      return NextResponse.json({ error: `Insufficient stock at ${source.name}: ${available} available` }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      await applyStockDelta(tx, {
        tenantId: ctx.tenantId, branchId: sourceBranchId, productId, delta: -quantity,
        movementType: 'transfer_out', performedById: userId, reason: `Transfer to ${dest.name}`,
      });
      await applyStockDelta(tx, {
        tenantId: ctx.tenantId, branchId: destinationBranchId, productId, delta: quantity,
        movementType: 'transfer_in', performedById: userId, reason: `Transfer from ${source.name}`,
        fallbackCost: product.costPrice ?? 0, fallbackMarkup: product.markupPercent, fallbackSelling: product.price,
      });
      await tx.inventoryAuditLog.create({
        data: {
          actionType: 'STOCK_TRANSFERRED',
          productId,
          performedBy: userId,
          newValue: { productId, quantity, from: source.name, to: dest.name },
          tenantId: ctx.tenantId,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      product: product.name,
      quantity,
      from: source.name,
      to: dest.name,
    }, { status: 201 });
  } catch (err: any) {
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Transfer error:', err);
    return NextResponse.json({ error: 'Failed to transfer stock' }, { status: 500 });
  }
}
