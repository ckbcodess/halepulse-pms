import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/requireRole';
import { logAction } from '@/lib/audit/logAction';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string; userId: string }> }) {
  let session: Awaited<ReturnType<typeof requireRole>>;
  try { session = await requireRole(['SUPER_ADMIN']); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tenantId, userId } = await params;
  const body = await req.json();
  const { role, branchId, isActive } = body;

  const user = await prisma.user.findFirst({
    where: { id: Number(userId), tenantId },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found in this tenant' }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (role !== undefined && ['MANAGER', 'PHARMACIST', 'MCA', 'AUDIT', 'NES'].includes(role)) {
    updateData.saasRole = role;
    updateData.role = role;
  }
  if (branchId !== undefined) updateData.branchId = branchId || null;
  if (isActive !== undefined) updateData.isActive = isActive;

  const updated = await prisma.user.update({
    where: { id: Number(userId) },
    data: updateData,
  });

  await logAction(session.user.id, tenantId, 'USER_UPDATED', {
    userId: updated.id, changes: Object.keys(updateData),
  });

  return NextResponse.json({ id: updated.id, email: updated.email, saasRole: updated.saasRole, isActive: updated.isActive });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ tenantId: string; userId: string }> }) {
  let session: Awaited<ReturnType<typeof requireRole>>;
  try { session = await requireRole(['SUPER_ADMIN']); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tenantId, userId } = await params;

  const user = await prisma.user.findFirst({
    where: { id: Number(userId), tenantId },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found in this tenant' }, { status: 404 });
  }

  // Soft-disable, never hard delete
  await prisma.user.update({
    where: { id: Number(userId) },
    data: { isActive: false },
  });

  await logAction(session.user.id, tenantId, 'USER_DISABLED', {
    userId: user.id, email: user.email,
  });

  return NextResponse.json({ ok: true });
}
