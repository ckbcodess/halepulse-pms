import { NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth/checkRole';
import { resolveBranchId } from '@/lib/auth/branchContext';
import { computeSellingPrice } from '@/lib/inventory/pricing';
import prisma from '@/lib/prisma';

// ── POST /api/inventory/restock — batch restock from CSV ──────────────────────
export async function POST(request: Request) {
  try {
    const ctx = await checkRole('MANAGER');
    const { tenantId, userId } = ctx;
    const branchId = await resolveBranchId(ctx);
    const body: {
      items: {
        productId: number;
        quantityReceived: number;
        costPrice: number;
        markupPercent: number;
      }[];
      supplierId?: number | null;
      invoiceNumber?: string;
      notes?: string;
      pricingMode?: 'update_all' | 'new_batch_only';
      roundToNearest?: 0.50 | 1.00 | null;
    } = await request.json();

    if (!body.items?.length) {
      return NextResponse.json({ error: 'No items to restock' }, { status: 400 });
    }
    if (body.items.length > 5000) {
      return NextResponse.json({ error: 'Maximum 5,000 items per restock' }, { status: 400 });
    }

    // Filter out items with non-positive quantity
    const warnings: string[] = [];
    body.items = body.items.filter((item) => {
      if (item.quantityReceived <= 0) {
        warnings.push(`Skipped productId ${item.productId}: quantityReceived must be > 0`);
        return false;
      }
      if (item.costPrice <= 0) {
        warnings.push(`productId ${item.productId}: costPrice is ${item.costPrice} (free sample?)`);
      }
      return true;
    });

    if (!body.items.length) {
      return NextResponse.json({ error: 'No valid items after filtering (all had quantity <= 0)', warnings }, { status: 400 });
    }

    const pricingMode = body.pricingMode ?? 'update_all';
    const userIdNum = parseInt(userId, 10);

    // Fetch all products in one query
    const productIds = body.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId },
      select: { id: true, name: true, stockQty: true, costPrice: true, markupPercent: true, price: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const results: { name: string; oldQty: number; newQty: number; delta: number }[] = [];

    // Everything is atomic: GRN header + per-item batch (StockItem), immutable
    // StockMovement, the legacy StockAdjustment + audit logs, and the
    // Product.stockQty/price dual-write that existing reads still rely on.
    await prisma.$transaction(async (tx) => {
      const grn = await tx.goodsReceivedNote.create({
        data: {
          tenantId,
          branchId,
          supplierId: body.supplierId ?? null,
          invoiceNumber: body.invoiceNumber ?? null,
          notes: body.notes ?? null,
          receivedBy: userIdNum,
        },
      });

      for (const item of body.items) {
        const product = productMap.get(item.productId);
        if (!product) continue;

        const newQty = product.stockQty + item.quantityReceived;
        const sellingPrice = computeSellingPrice(item.costPrice, item.markupPercent, body.roundToNearest);

        // New batch (StockItem) for this receipt
        const stockItem = await tx.stockItem.create({
          data: {
            tenantId,
            branchId,
            productId: item.productId,
            grnId: grn.id,
            quantity: item.quantityReceived,
            costPrice: item.costPrice,
            markupPercent: item.markupPercent,
            sellingPrice,
            priceOverridden: false,
          },
        });

        // Immutable ledger entry for the receipt
        await tx.stockMovement.create({
          data: {
            tenantId,
            branchId,
            stockItemId: stockItem.id,
            movementType: 'grn',
            quantityChange: item.quantityReceived,
            quantityBefore: 0,
            quantityAfter: item.quantityReceived,
            referenceId: grn.id,
            performedBy: userIdNum,
          },
        });

        // Product dual-write: stock + pricing (or stock only for new_batch_only)
        const updateData: Record<string, any> = { stockQty: newQty };
        if (pricingMode === 'update_all') {
          updateData.costPrice = item.costPrice;
          updateData.markupPercent = item.markupPercent;
          updateData.price = sellingPrice;
        }
        await tx.product.update({ where: { id: item.productId }, data: updateData });

        // Legacy stock adjustment record (keeps the adjustments view populated)
        await tx.stockAdjustment.create({
          data: {
            productId: item.productId,
            adjustedBy: userIdNum,
            oldQuantity: product.stockQty,
            newQuantity: newQty,
            delta: item.quantityReceived,
            reason: 'Batch Restock',
            notes: body.invoiceNumber ? `Invoice: ${body.invoiceNumber}` : null,
            tenantId,
            branchId,
          },
        });

        // Audit log — stock received
        await tx.inventoryAuditLog.create({
          data: {
            actionType: 'STOCK_RECEIVED',
            productId: item.productId,
            supplierId: body.supplierId ?? null,
            performedBy: userIdNum,
            oldValue: { stockQty: product.stockQty, costPrice: product.costPrice, markupPercent: product.markupPercent, price: product.price },
            newValue: { stockQty: newQty, costPrice: item.costPrice, markupPercent: item.markupPercent, price: sellingPrice },
            notes: body.notes || null,
            tenantId,
          },
        });

        // Audit log — price updated (if pricing changed)
        if (pricingMode === 'update_all' && (item.costPrice !== product.costPrice || item.markupPercent !== product.markupPercent)) {
          await tx.inventoryAuditLog.create({
            data: {
              actionType: 'PRICE_UPDATED',
              productId: item.productId,
              performedBy: userIdNum,
              oldValue: { costPrice: product.costPrice, markupPercent: product.markupPercent, price: product.price },
              newValue: { costPrice: item.costPrice, markupPercent: item.markupPercent, price: sellingPrice },
              tenantId,
            },
          });
        }

        results.push({ name: product.name, oldQty: product.stockQty, newQty, delta: item.quantityReceived });
      }
    }, { timeout: 120000, maxWait: 10000 });

    return NextResponse.json({
      success: true,
      restocked: results.length,
      totalUnitsAdded: results.reduce((sum, r) => sum + r.delta, 0),
      items: results,
      ...(warnings.length ? { warnings } : {}),
    }, { status: 201 });
  } catch (err: any) {
    console.error('Restock POST error:', err);
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to process restock' }, { status: 500 });
  }
}
