import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { logAction } from '@/lib/audit/logAction';

function isManager(ctx: { role: string }): boolean {
  return ctx.role === 'MANAGER' || ctx.role === 'SUPER_ADMIN' || ctx.role === 'tenant_admin' || ctx.role === 'branch_manager';
}

// POST /api/team/[userId]/assign — assign a person to a role credential
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const ctx = await getTenantContext();
    if (!isManager(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId: userIdStr } = await params;
    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });

    const body = await request.json();
    const personName: string = (body.personName ?? '').trim();
    if (!personName) return NextResponse.json({ error: 'personName is required' }, { status: 400 });

    // Verify the credential belongs to this tenant (and branch when scoped)
    const credential = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: ctx.tenantId,
        isRoleCredential: true,
        ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
      },
      select: { id: true, branchId: true, tenantId: true },
    });
    if (!credential || !credential.branchId) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Deactivate existing active assignments for this credential
      await tx.personAssignment.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });

      return tx.personAssignment.create({
        data: {
          userId,
          branchId: credential.branchId!,
          tenantId: credential.tenantId!,
          personName,
          personPhone: (body.personPhone ?? '').trim() || null,
          personNotes: (body.personNotes ?? '').trim() || null,
          assignedBy: parseInt(ctx.userId, 10),
          isActive: true,
        },
      });
    });

    await logAction(ctx.userId, ctx.tenantId, 'PERSON_ASSIGNED', {
      credentialUserId: userId,
      personName,
    });

    return NextResponse.json({ assignment: result }, { status: 201 });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message?.startsWith('No tenant')) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to assign person' }, { status: 500 });
  }
}

// DELETE /api/team/[userId]/assign — clear the active assignment
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const ctx = await getTenantContext();
    if (!isManager(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId: userIdStr } = await params;
    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });

    const credential = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: ctx.tenantId,
        isRoleCredential: true,
        ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
      },
      select: { id: true },
    });
    if (!credential) return NextResponse.json({ error: 'Credential not found' }, { status: 404 });

    await prisma.personAssignment.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    await logAction(ctx.userId, ctx.tenantId, 'PERSON_CLEARED', { credentialUserId: userId });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message?.startsWith('No tenant')) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to clear assignment' }, { status: 500 });
  }
}
