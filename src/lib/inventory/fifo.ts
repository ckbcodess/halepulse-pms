import type { Prisma } from '@prisma/client';

/**
 * Deducts `quantity` of a product from its batch stock_items at a branch using
 * FIFO (oldest received first), writing an immutable StockMovement per batch
 * touched (blueprint §6.2).
 *
 * Best-effort during the Phase 2 transition: `Product.stockQty` remains the
 * authoritative quantity and is validated/decremented by the caller. If the
 * batch ledger is behind (e.g. stock added via the legacy adjustment path),
 * this deducts what batches allow and reports how much it managed — it never
 * blocks the sale.
 *
 * Returns the amount actually deducted and the first (oldest) batch used, which
 * the caller records on the SaleItem as its batch reference.
 */
export async function deductStockFifo(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string;
    branchId: string;
    productId: number;
    quantity: number;
    performedById: number;
    referenceId?: number | null;
  },
): Promise<{ deducted: number; firstStockItemId: number | null }> {
  let remaining = args.quantity;
  let firstStockItemId: number | null = null;

  const batches = await tx.stockItem.findMany({
    where: {
      tenantId: args.tenantId,
      branchId: args.branchId,
      productId: args.productId,
      quantity: { gt: 0 },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.quantity);
    const before = batch.quantity;
    const after = before - take;

    await tx.stockItem.update({ where: { id: batch.id }, data: { quantity: after } });
    await tx.stockMovement.create({
      data: {
        tenantId: args.tenantId,
        branchId: args.branchId,
        stockItemId: batch.id,
        movementType: 'sale',
        quantityChange: -take,
        quantityBefore: before,
        quantityAfter: after,
        referenceId: args.referenceId ?? null,
        performedBy: args.performedById,
      },
    });

    if (firstStockItemId === null) firstStockItemId = batch.id;
    remaining -= take;
  }

  return { deducted: args.quantity - remaining, firstStockItemId };
}
