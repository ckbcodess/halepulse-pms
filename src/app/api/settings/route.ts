import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import prisma from '@/lib/prisma';
import { updateSettingsSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

export async function PUT(request: Request) {
  try {
    const { tenantId, role } = await getTenantContext();

    // Only MANAGER (or super admin impersonating) can update settings
    if (role !== 'MANAGER' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateSettingsSchema.parse(body);

    // Fetch current values for audit
    const current = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, legalName: true, address: true, primaryPhone: true, primaryEmail: true, primaryContact: true, licenceNumber: true, taxVatNumber: true },
    });

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(parsed.name           ? { name: parsed.name }                                 : {}),
        ...(parsed.legalName      !== undefined ? { legalName: parsed.legalName || null }           : {}),
        ...(parsed.address        !== undefined ? { address: parsed.address || null }               : {}),
        ...(parsed.primaryPhone   !== undefined ? { primaryPhone: parsed.primaryPhone || null }     : {}),
        ...(parsed.primaryEmail   !== undefined ? { primaryEmail: parsed.primaryEmail || null }     : {}),
        ...(parsed.primaryContact !== undefined ? { primaryContact: parsed.primaryContact || null } : {}),
        ...(parsed.licenceNumber  !== undefined ? { licenceNumber: parsed.licenceNumber || null }   : {}),
        ...(parsed.taxVatNumber   !== undefined ? { taxVatNumber: parsed.taxVatNumber || null }     : {}),
      },
    });

    // Audit log for settings change
    const { userId } = await getTenantContext();
    await prisma.inventoryAuditLog.create({
      data: {
        actionType: 'SETTINGS_UPDATED',
        performedBy: parseInt(userId, 10),
        oldValue: current as any,
        newValue: parsed as any,
        notes: 'Tenant settings updated',
        tenantId,
      },
    }).catch(() => {});

    return NextResponse.json({ tenant: updated });
  } catch (err: any) {
    console.error('Settings API error:', err);
    if (err instanceof ZodError) {
      const message = err.issues.map((e: { message: string }) => e.message).join(', ');
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
