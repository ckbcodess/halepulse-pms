import { NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth/checkRole';
import { resolveBranchId } from '@/lib/auth/branchContext';
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

    // Build all operations in a single transaction
    const operations: any[] = [];
    const results: { name: string; oldQty: number; newQty: number; delta: number }[] = [];

    for (const item of body.items) {
      const product = productMap.get(item.productId);
      if (!product) continue;

      const newQty = product.stockQty + item.quantityReceived;
      let sellingPrice = Math.round(item.costPrice * (1 + item.markupPercent / 100) * 100) / 100;
      if (body.roundToNearest) {
        sellingPrice = Math.round(sellingPrice / body.roundToNearest) * body.roundToNearest;
      }

      // Update product: stock + pricing (or stock only for new_batch_only)
      const updateData: Record<string, any> = { stockQty: newQty };
      if (pricingMode === 'update_all') {
        updateData.costPrice = item.costPrice;
        updateData.markupPercent = item.markupPercent;
        updateData.price = sellingPrice;
      }
      operations.push(
        prisma.product.update({
          where: { id: item.productId },
          data: updateData,
        })
      );

      // Stock adjustment record
      operations.push(
        prisma.stockAdjustment.create({
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
        })
      );

      // Audit log — stock received
      operations.push(
        prisma.inventoryAuditLog.create({
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
        })
      );

      // Audit log — price updated (if price changed and pricing was updated)
      if (pricingMode === 'update_all' && (item.costPrice !== product.costPrice || item.markupPercent !== product.markupPercent)) {
        operations.push(
          prisma.inventoryAuditLog.create({
            data: {
              actionType: 'PRICE_UPDATED',
              productId: item.productId,
              performedBy: userIdNum,
              oldValue: { costPrice: product.costPrice, markupPercent: product.markupPercent, price: product.price },
              newValue: { costPrice: item.costPrice, markupPercent: item.markupPercent, price: sellingPrice },
              tenantId,
            },
          })
        );
      }

      results.push({ name: product.name, oldQty: product.stockQty, newQty, delta: item.quantityReceived });
    }

    // Execute everything atomically
    await prisma.$transaction(operations);

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
