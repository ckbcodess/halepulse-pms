import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/requireRole';
import { logAction } from '@/lib/audit/logAction';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  try { await requireRole(['SUPER_ADMIN']); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tenantId } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      subscriptionPlan: true,
      maxBranches: true,
      maxUsers: true,
      renewalDate: true,
      suspendedAt: true,
      suspendReason: true,
      isActive: true,
    },
  });
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  return NextResponse.json(tenant);
}

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
  const { plan, maxBranches, maxUsers, renewalDate, suspendedAt, suspendReason } = body;

  const current = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { subscriptionPlan: true, maxBranches: true, maxUsers: true, renewalDate: true, suspendedAt: true, suspendReason: true },
  });
  if (!current) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      ...(plan !== undefined && { subscriptionPlan: plan }),
      ...(maxBranches !== undefined && { maxBranches: Number(maxBranches) }),
      ...(maxUsers !== undefined && { maxUsers: Number(maxUsers) }),
      ...(renewalDate !== undefined && { renewalDate: renewalDate ? new Date(renewalDate) : null }),
      ...(suspendedAt !== undefined && { suspendedAt: suspendedAt ? new Date(suspendedAt) : null }),
      ...(suspendReason !== undefined && { suspendReason: suspendReason || null }),
    },
    select: { subscriptionPlan: true, maxBranches: true, maxUsers: true, renewalDate: true, suspendedAt: true, suspendReason: true },
  });

  await logAction(
    String(session.user.id),
    tenantId,
    'SUBSCRIPTION_UPDATED',
    undefined,
    undefined,
    current as Record<string, unknown>,
    updated as Record<string, unknown>,
  );

  return NextResponse.json(updated);
}
