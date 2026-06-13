import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/requireRole';
import { logAction } from '@/lib/audit/logAction';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  let session: Awaited<ReturnType<typeof requireRole>>;
  try { session = await requireRole(['SUPER_ADMIN']); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tenantId } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // Delete in dependency order
  await prisma.$transaction(async (tx) => {
    // Prescription items (via prescriptions)
    const prescriptions = await tx.prescription.findMany({ where: { tenantId }, select: { id: true } });
    if (prescriptions.length > 0) {
      await tx.prescriptionItem.deleteMany({ where: { prescriptionId: { in: prescriptions.map(p => p.id) } } });
    }
    await tx.prescription.deleteMany({ where: { tenantId } });

    // Refill reminders
    await tx.refillReminder.deleteMany({ where: { tenantId } });

    // Sale items and payments
    const sales = await tx.sale.findMany({ where: { tenantId }, select: { id: true } });
    if (sales.length > 0) {
      const saleIds = sales.map(s => s.id);
      await tx.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
      await tx.salePayment.deleteMany({ where: { saleId: { in: saleIds } } });
    }
    await tx.sale.deleteMany({ where: { tenantId } });

    // EOD reports
    await tx.eodReport.deleteMany({ where: { tenantId } });

    // Stock movements, stock items, GRN
    await tx.stockMovement.deleteMany({ where: { tenantId } });
    await tx.stockItem.deleteMany({ where: { tenantId } });
    await tx.goodsReceivedNote.deleteMany({ where: { tenantId } });

    // Stock take sessions
    await tx.stockTakeSession.deleteMany({ where: { tenantId } });

    // Stock adjustments
    await tx.stockAdjustment.deleteMany({ where: { tenantId } });

    // Inventory audit logs
    await tx.inventoryAuditLog.deleteMany({ where: { tenantId } });

    // Products
    await tx.product.deleteMany({ where: { tenantId } });

    // Suppliers
    await tx.supplier.deleteMany({ where: { tenantId } });

    // Customers
    await tx.customer.deleteMany({ where: { tenantId } });

    // Expenses
    await tx.expense.deleteMany({ where: { tenantId } });

    // Person assignments
    await tx.personAssignment.deleteMany({ where: { tenantId } });

    // Import jobs
    await tx.importJob.deleteMany({ where: { tenantId } });

    // Role permissions, menu configs, dynamic roles
    await tx.rolePermission.deleteMany({ where: { tenantId } });
    await tx.menuConfig.deleteMany({ where: { tenantId } });
    await tx.dynamicMenuConfig.deleteMany({ where: { tenantId } });
    await tx.dynamicRolePermission.deleteMany({ where: { tenantId } });
    await tx.dynamicRole.deleteMany({ where: { tenantId } });

    // Feature flags
    await tx.tenantFeatureFlag.deleteMany({ where: { tenantId } });

    // Login attempts
    await tx.loginAttempt.deleteMany({ where: { tenantId } });

    // Users
    await tx.user.deleteMany({ where: { tenantId } });

    // Branches
    await tx.branch.deleteMany({ where: { tenantId } });

    // Audit logs for this tenant
    await tx.auditLog.deleteMany({ where: { tenantId } });

    // Finally delete the tenant
    await tx.tenant.delete({ where: { id: tenantId } });
  });

  await logAction(session.user.id, null, 'TENANT_DELETED', { tenantId, name: tenant.name });

  return NextResponse.json({ success: true });
}
