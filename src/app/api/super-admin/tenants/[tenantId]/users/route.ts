import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireRole } from '@/lib/auth/requireRole';
import { logAction } from '@/lib/audit/logAction';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try { await requireRole(['SUPER_ADMIN']); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tenantId } = await params;

  const users = await prisma.user.findMany({
    where: { tenantId },
    select: {
      id: true, email: true, username: true, saasRole: true,
      isActive: true, lastActiveAt: true, createdAt: true,
      branchId: true, branch: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  let session: Awaited<ReturnType<typeof requireRole>>;
  try { session = await requireRole(['SUPER_ADMIN']); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tenantId } = await params;
  const body = await req.json();
  const { email, role, branchId } = body;

  if (!email || !role) {
    return NextResponse.json({ error: 'email and role are required' }, { status: 400 });
  }

  if (!['MANAGER', 'MCA', 'NES'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const tempPassword = `User${Math.random().toString(36).slice(2, 8).toUpperCase()}!`;
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      username: email,
      password: 'NEXTAUTH_MANAGED',
      role: role,
      email,
      passwordHash,
      saasRole: role,
      tenantId,
      branchId: branchId || null,
      isActive: true,
    },
  });

  await logAction(session.user.id, tenantId, 'USER_CREATED', {
    userId: user.id, email, role,
  });

  return NextResponse.json({ user: { id: user.id, email: user.email, role: user.saasRole }, tempPassword }, { status: 201 });
}
