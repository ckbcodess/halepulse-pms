import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/** Current batch-derived quantity of a product at a branch (sum of stock_items). */
export async function branchQty(db: Db, tenantId: string, branchId: string, productId: number): Promise<number> {
  const agg = await db.stockItem.aggregate({
    _sum: { quantity: true },
    where: { tenantId, branchId, productId },
  });
  return agg._sum.quantity ?? 0;
}

/**
 * Applies a signed quantity delta to a product's batch stock at a branch and
 * writes the immutable StockMovement(s). Used by stock-take, transfers, and the
 * legacy adjustment sync.
 *
 *  - delta < 0: deducts oldest batches first (FIFO).
 *  - delta > 0: adds to the newest batch, or creates one if none exists
 *    (using fallback pricing for the opening batch).
 *
 * Best-effort on decrease: if batches can't cover the reduction, it removes what
 * it can (Product.stockQty remains the authority during the transition).
 */
export async function applyStockDelta(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string;
    branchId: string;
    productId: number;
    delta: number;
    movementType: string;
    performedById: number;
    reason?: string | null;
    referenceId?: number | null;
    fallbackCost?: number;
    fallbackMarkup?: number;
    fallbackSelling?: number;
  },
): Promise<void> {
  if (args.delta === 0) return;
  const base = {
    tenantId: args.tenantId,
    branchId: args.branchId,
    movementType: args.movementType,
    reason: args.reason ?? null,
    referenceId: args.referenceId ?? null,
    performedBy: args.performedById,
  };

  if (args.delta < 0) {
    let remaining = -args.delta;
    const batches = await tx.stockItem.findMany({
      where: { tenantId: args.tenantId, branchId: args.branchId, productId: args.productId, quantity: { gt: 0 } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    for (const b of batches) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, b.quantity);
      const after = b.quantity - take;
      await tx.stockItem.update({ where: { id: b.id }, data: { quantity: after } });
      await tx.stockMovement.create({
        data: { ...base, stockItemId: b.id, quantityChange: -take, quantityBefore: b.quantity, quantityAfter: after },
      });
      remaining -= take;
    }
    return;
  }

  // delta > 0
  const newest = await tx.stockItem.findFirst({
    where: { tenantId: args.tenantId, branchId: args.branchId, productId: args.productId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  if (newest) {
    const after = newest.quantity + args.delta;
    await tx.stockItem.update({ where: { id: newest.id }, data: { quantity: after } });
    await tx.stockMovement.create({
      data: { ...base, stockItemId: newest.id, quantityChange: args.delta, quantityBefore: newest.quantity, quantityAfter: after },
    });
  } else {
    const item = await tx.stockItem.create({
      data: {
        tenantId: args.tenantId,
        branchId: args.branchId,
        productId: args.productId,
        quantity: args.delta,
        costPrice: args.fallbackCost ?? 0,
        markupPercent: args.fallbackMarkup ?? 0,
        sellingPrice: args.fallbackSelling ?? 0,
        priceOverridden: false,
      },
    });
    await tx.stockMovement.create({
      data: { ...base, stockItemId: item.id, quantityChange: args.delta, quantityBefore: 0, quantityAfter: args.delta },
    });
  }
}
