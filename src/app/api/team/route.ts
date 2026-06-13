import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/auth/getTenantContext';

// GET /api/team — real team members for the current manager's tenant.
// Branch managers see their own branch; tenant-wide managers see everyone.
export async function GET() {
  try {
    const ctx = await getTenantContext();
    if (!ctx.tenantId) {
      return NextResponse.json({ error: 'No tenant context' }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      tenantId: ctx.tenantId,
      isRoleCredential: false,            // exclude any legacy role-credential rows
      saasRole: { not: 'SUPER_ADMIN' },
    };
    if (ctx.branchId) where.branchId = ctx.branchId;

    const members = await prisma.user.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }],
      select: {
        id: true, firstName: true, lastName: true, email: true, contact: true,
        saasRole: true, isActive: true, lastActiveAt: true, canCreateUsers: true,
        branch: { select: { name: true } },
      },
    });

    return NextResponse.json({
      members: members.map((m) => ({
        id: m.id,
        name: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || 'Unnamed',
        email: m.email,
        contact: m.contact,
        role: m.saasRole,
        branch: m.branch?.name ?? null,
        isActive: m.isActive,
        canCreateUsers: m.canCreateUsers,
        lastActiveAt: m.lastActiveAt?.toISOString() ?? null,
      })),
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message?.startsWith('No tenant')) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load team' }, { status: 500 });
  }
}
