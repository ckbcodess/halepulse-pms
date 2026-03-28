import { NextRequest, NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth/checkRole';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// ── POST /api/inventory/audit-log/revert ─────────────────────────────────────
// Reverts an audit entry by restoring oldValue to the target entity.
// Only MANAGER role can revert. Uses optimistic locking to prevent stale reverts.
export async function POST(request: NextRequest) {
  try {
    const { tenantId, userId } = await checkRole('MANAGER');
    const body = await request.json();

    const auditLogId = parseInt(body.auditLogId, 10);
    if (isNaN(auditLogId)) {
      return NextResponse.json({ error: 'Invalid audit log ID' }, { status: 400 });
    }

    const revertNote = (body.revertNote ?? '').trim().slice(0, 500);

    // Fetch audit entry — scoped by tenantId (BOLA protection)
    const entry = await prisma.inventoryAuditLog.findFirst({
      where: { id: auditLogId, tenantId },
      include: {
        product: { select: { id: true, name: true, costPrice: true, markupPercent: true, price: true, stockQty: true, isActive: true } },
        supplier: { select: { id: true, name: true, isActive: true } },
      },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Audit entry not found' }, { status: 404 });
    }

    if (entry.revertedAt) {
      return NextResponse.json({ error: 'This entry has already been reverted' }, { status: 409 });
    }

    if (!entry.oldValue) {
      return NextResponse.json({ error: 'No previous state to revert to — this was a creation event' }, { status: 422 });
    }

    const oldValue = entry.oldValue as Record<string, any>;
    const newValue = (entry.newValue ?? {}) as Record<string, any>;

    // ── Optimistic locking: verify current state matches newValue ─────────
    // For product-related actions
    if (entry.productId && entry.product) {
      const current = entry.product;
      const mismatchFields: string[] = [];

      // Check fields that were changed (present in newValue)
      for (const key of Object.keys(newValue)) {
        if (key in current) {
          const currentVal = (current as any)[key];
          const expectedVal = newValue[key];
          // Loose comparison for numeric precision
          if (String(currentVal) !== String(expectedVal)) {
            mismatchFields.push(key);
          }
        }
      }

      if (mismatchFields.length > 0) {
        return NextResponse.json({
          error: `Product has been modified since this audit entry. Changed fields: ${mismatchFields.join(', ')}. Revert is no longer safe.`,
          mismatchFields,
        }, { status: 409 });
      }

      // Build update data from oldValue — only whitelisted product fields
      const PRODUCT_FIELDS = ['name', 'brand', 'category', 'unit', 'sku', 'price', 'costPrice', 'markupPercent', 'stockQty', 'lowStockThreshold', 'isActive'];
      const updateData: Record<string, any> = {};
      for (const key of PRODUCT_FIELDS) {
        if (key in oldValue) {
          updateData[key] = oldValue[key];
        }
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.product.update({
          where: { id: entry.productId, tenantId },
          data: updateData,
        });
      }
    }

    // For supplier-related actions
    if (entry.supplierId && entry.supplier && !entry.productId) {
      const SUPPLIER_FIELDS = ['name', 'contactName', 'phone', 'email', 'address', 'notes', 'isActive'];
      const updateData: Record<string, any> = {};
      for (const key of SUPPLIER_FIELDS) {
        if (key in oldValue) {
          updateData[key] = oldValue[key];
        }
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.supplier.update({
          where: { id: entry.supplierId, tenantId },
          data: updateData,
        });
      }
    }

    // Mark entry as reverted
    const reverted = await prisma.inventoryAuditLog.update({
      where: { id: auditLogId, tenantId },
      data: {
        revertedAt: new Date(),
        revertedBy: parseInt(userId, 10),
        revertNote: revertNote || null,
      },
    });

    // Create a new audit entry for the revert action itself
    await prisma.inventoryAuditLog.create({
      data: {
        actionType: entry.productId ? 'PRODUCT_REVERTED' : 'SUPPLIER_REVERTED',
        productId: entry.productId,
        supplierId: entry.supplierId,
        performedBy: parseInt(userId, 10),
        oldValue: entry.newValue as Prisma.InputJsonValue ?? undefined,
        newValue: entry.oldValue as Prisma.InputJsonValue ?? undefined,
        notes: `Reverted audit entry #${auditLogId}${revertNote ? `: ${revertNote}` : ''}`,
        tenantId,
      },
    });

    return NextResponse.json({
      success: true,
      revertedAt: reverted.revertedAt?.toISOString(),
    });
  } catch (err: any) {
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Audit revert error:', err);
    return NextResponse.json({ error: 'Failed to revert audit entry' }, { status: 500 });
  }
}
