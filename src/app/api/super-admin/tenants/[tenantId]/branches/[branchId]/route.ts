import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/requireRole';
import prisma from '@/lib/prisma';
import { logAction } from '@/lib/audit/logAction';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; branchId: string }> },
) {
  const auth = await requireRole(['SUPER_ADMIN']);
  if (auth instanceof NextResponse) return auth;

  const { tenantId, branchId } = await params;
  const body = await request.json();
  const { name, address, phone, isActive } = body;

  const branch = await prisma.branch.update({
    where: { id: branchId, tenantId },
    data: {
      ...(name     !== undefined ? { name: name.trim() }               : {}),
      ...(address  !== undefined ? { address: address?.trim() || null } : {}),
      ...(phone    !== undefined ? { phone: phone?.trim() || null }     : {}),
      ...(isActive !== undefined ? { isActive }                         : {}),
    },
  });

  await logAction(
    String(auth.user.id),
    tenantId,
    'UPDATE_BRANCH',
    { branchId, changes: body },
  );

  return NextResponse.json({ branch });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string; branchId: string }> },
) {
  const auth = await requireRole(['SUPER_ADMIN']);
  if (auth instanceof NextResponse) return auth;

  const { tenantId, branchId } = await params;

  // Soft delete — set inactive rather than hard delete
  const branch = await prisma.branch.update({
    where: { id: branchId, tenantId },
    data:  { isActive: false },
  });

  await logAction(
    String(auth.user.id),
    tenantId,
    'DISABLE_BRANCH',
    { branchId },
  );

  return NextResponse.json({ branch });
}
