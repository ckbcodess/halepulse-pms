import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/requireRole';
import prisma from '@/lib/prisma';
import { logAction } from '@/lib/audit/logAction';
import { generateBranchBusinessId } from '@/lib/utils/generateBranchBusinessId';

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
  const { name, address, phone, subdomain } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Branch name is required' }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { businessId: true, name: true, maxBranches: true },
  });
  if (!tenant?.businessId) {
    return NextResponse.json({ error: 'Business has no business ID — cannot derive branch ID' }, { status: 409 });
  }

  // Subscription limit check
  const branchCount = await prisma.branch.count({ where: { tenantId } });
  if (branchCount >= tenant.maxBranches) {
    return NextResponse.json(
      { error: 'Branch limit reached for your subscription plan' },
      { status: 403 },
    );
  }

  const branchBusinessId = await generateBranchBusinessId(tenant.businessId);

  const branch = await prisma.branch.create({
    data: {
      name:       name.trim(),
      address:    address?.trim() || null,
      phone:      phone?.trim() || null,
      tenantId,
      businessId: branchBusinessId,
    },
  });

  await logAction(
    String(auth.user.id),
    tenantId,
    'CREATE_BRANCH',
    { branchId: branch.id, name: branch.name, businessId: branch.businessId },
  );

  return NextResponse.json({ branch }, { status: 201 });
}
