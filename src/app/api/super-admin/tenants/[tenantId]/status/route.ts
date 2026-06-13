import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/requireRole';
import { logAction } from '@/lib/audit/logAction';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  let session: Awaited<ReturnType<typeof requireRole>>;
  try { session = await requireRole(['SUPER_ADMIN']); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tenantId } = await params;
  const body = await req.json();
  const { action, reason } = body;

  if (!['suspend', 'reactivate', 'deactivate'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action. Use suspend | reactivate | deactivate' }, { status: 400 });
  }

  const current = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { isActive: true, suspendedAt: true, suspendReason: true },
  });
  if (!current) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  let updateData: Record<string, unknown> = {};
  if (action === 'suspend') {
    updateData = { isActive: false, suspendedAt: new Date(), suspendReason: reason || null };
  } else if (action === 'reactivate') {
    updateData = { isActive: true, suspendedAt: null, suspendReason: null };
  } else if (action === 'deactivate') {
    updateData = { isActive: false };
  }

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: updateData,
    select: { id: true, isActive: true, suspendedAt: true, suspendReason: true },
  });

  await logAction(
    String(session.user.id),
    tenantId,
    `TENANT_${action.toUpperCase()}`,
    { reason },
    undefined,
    current as Record<string, unknown>,
    updated as Record<string, unknown>,
  );

  return NextResponse.json(updated);
}
