import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/requireRole';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try { await requireRole(['SUPER_ADMIN']); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tenantId } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      _count: { select: { users: true, products: true, sales: true, branches: true } },
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(tenant);
}
