import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireRole } from '@/lib/auth/requireRole';
import { logAction } from '@/lib/audit/logAction';
import { generateBusinessId } from '@/lib/utils/generateBusinessId';


export async function GET(req: NextRequest) {
  try {
    await requireRole(['SUPER_ADMIN']);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const q = sp.get('q')?.trim() ?? '';
  const statusFilter = sp.get('status') ?? 'all';

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { businessId: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (statusFilter === 'active') where.isActive = true;
  else if (statusFilter === 'suspended') { where.isActive = false; where.NOT = { suspendedAt: null }; }
  else if (statusFilter === 'inactive') { where.isActive = false; where.suspendedAt = null; }

  const tenants = await prisma.tenant.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true, branches: true } } },
  });
  return NextResponse.json({ tenants });
}

export async function POST(req: NextRequest) {
  let session: Awaited<ReturnType<typeof requireRole>>;
  try {
    session = await requireRole(['SUPER_ADMIN']);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { name, subdomain, primaryColor, secondaryColor, logoUrl, prefix } = body;

  if (!name || !subdomain) {
    return NextResponse.json({ error: 'name and subdomain are required' }, { status: 400 });
  }

  if (!prefix || !/^[A-Za-z]{3}$/.test(prefix)) {
    return NextResponse.json({ error: 'prefix must be exactly 3 alphabetic characters (e.g. HAL, MED)' }, { status: 400 });
  }

  const existing = await prisma.tenant.findUnique({ where: { subdomain } });
  if (existing) {
    return NextResponse.json({ error: 'Subdomain already taken' }, { status: 409 });
  }

  let businessId: string;
  try {
    businessId = await generateBusinessId(prefix);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to generate business ID' }, { status: 409 });
  }

  const tenant = await prisma.tenant.create({
    data: { name, subdomain, primaryColor, secondaryColor, logoUrl: logoUrl || null, businessId },
  });

  // HQ branch shares the same businessId as the tenant
  const hqBranch = await prisma.branch.create({
    data: {
      name: 'Head Office',
      tenantId: tenant.id,
      isHeadquarters: true,
      businessId: businessId,
    },
  });

  await logAction(session.user.id, null, 'TENANT_CREATED', { tenantId: tenant.id, name, businessId });

  return NextResponse.json({ tenant, hqBranch }, { status: 201 });
}
