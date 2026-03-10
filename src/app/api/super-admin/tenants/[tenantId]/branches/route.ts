import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/requireRole';
import prisma from '@/lib/prisma';
import { logAction } from '@/lib/audit/logAction';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const auth = await requireRole(['SUPER_ADMIN']);
  if (auth instanceof NextResponse) return auth;

  const { tenantId } = await params;

  const branches = await prisma.branch.findMany({
    where: { tenantId },
    include: { _count: { select: { users: true } } },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ branches });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const auth = await requireRole(['SUPER_ADMIN']);
  if (auth instanceof NextResponse) return auth;

  const { tenantId } = await params;
  const body = await request.json();
  const { name, address, phone } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Branch name is required' }, { status: 400 });
  }

  const branch = await prisma.branch.create({
    data: {
      name:     name.trim(),
      address:  address?.trim() || null,
      phone:    phone?.trim() || null,
      tenantId,
    },
  });

  await logAction(
    String(auth.user.id),
    tenantId,
    'CREATE_BRANCH',
    { branchId: branch.id, name: branch.name },
  );

  return NextResponse.json({ branch }, { status: 201 });
}
