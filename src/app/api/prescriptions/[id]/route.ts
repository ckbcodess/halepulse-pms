import { NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth/checkRole';
import prisma from '@/lib/prisma';

const RX_ROLES = ['tenant_admin', 'pharmacist', 'MANAGER', 'MCA'];
const RX_VOID_ROLES = ['tenant_admin', 'branch_manager', 'MANAGER'];

// ── PATCH /api/prescriptions/[id] ─────────────────────────────────────────────
// Body: { action: 'verify' | 'dispense' | 'void', reason? }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const rxId = parseInt(id, 10);
    if (isNaN(rxId)) return NextResponse.json({ error: 'Invalid prescription' }, { status: 400 });

    const body = (await request.json()) as { action?: string; reason?: string };
    const action = body.action;

    // Void has a different permission set than the clinical transitions.
    const ctx = action === 'void' ? await checkRole(...RX_VOID_ROLES) : await checkRole(...RX_ROLES);
    const userId = parseInt(ctx.userId, 10);

    const rx = await prisma.prescription.findFirst({
      where: { id: rxId, tenantId: ctx.tenantId },
      include: { items: { include: { product: { select: { name: true, isControlled: true } } } } },
    });
    if (!rx) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });

    if (action === 'verify') {
      if (rx.status !== 'issued') return NextResponse.json({ error: `Cannot verify a ${rx.status} prescription` }, { status: 409 });
      const updated = await prisma.prescription.update({
        where: { id: rxId },
        data: { status: 'verified', verifiedBy: userId, verifiedAt: new Date() },
      });
      return NextResponse.json({ prescription: updated });
    }

    if (action === 'dispense') {
      if (rx.status !== 'verified') return NextResponse.json({ error: `Prescription must be verified before dispensing (currently ${rx.status})` }, { status: 409 });

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.prescription.update({
          where: { id: rxId },
          data: { status: 'dispensed', dispensedBy: userId, dispensedAt: new Date() },
        });
        // Controlled-substance logging — extra audit entry per blueprint §6.2.
        const controlled = rx.items.filter((it) => it.product?.isControlled);
        if (controlled.length > 0) {
          await tx.inventoryAuditLog.create({
            data: {
              actionType: 'CONTROLLED_DISPENSED',
              performedBy: userId,
              newValue: {
                prescriptionId: rxId,
                patientId: rx.patientId,
                drugs: controlled.map((c) => ({ name: c.product?.name ?? c.drugName, quantity: c.quantity })),
              },
              tenantId: ctx.tenantId,
            },
          });
        }
        return u;
      });
      return NextResponse.json({ prescription: updated });
    }

    if (action === 'void') {
      if (rx.status === 'dispensed') return NextResponse.json({ error: 'Cannot void a dispensed prescription' }, { status: 409 });
      const reason = (body.reason ?? '').trim();
      if (!reason) return NextResponse.json({ error: 'A void reason is required' }, { status: 400 });
      const updated = await prisma.prescription.update({
        where: { id: rxId },
        data: { status: 'voided', voidReason: reason },
      });
      return NextResponse.json({ prescription: updated });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'You do not have permission for this action' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Prescription action error:', err);
    return NextResponse.json({ error: 'Failed to update prescription' }, { status: 500 });
  }
}
