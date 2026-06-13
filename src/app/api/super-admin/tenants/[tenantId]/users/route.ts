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
      firstName: true, lastName: true, credentialCode: true,
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

  try {
    const { tenantId } = await params;
    const body = await req.json();
    const { email, role, branchId, firstName, lastName, contact, dob, ghanaCard, residence, canCreateUsers } = body;

    if (!email || !role) {
      return NextResponse.json({ error: 'email and role are required' }, { status: 400 });
    }

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 });
    }

    if (!['MANAGER', 'PHARMACIST', 'MCA', 'AUDIT', 'NES'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Check both email and username uniqueness
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username: email }] },
    });
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Subscription limit check
    const userCount = await prisma.user.count({ where: { tenantId } });
    if (userCount >= tenant.maxUsers) {
      return NextResponse.json(
        { error: 'User limit reached for your subscription plan' },
        { status: 403 },
      );
    }

    const tempPassword = `User${Math.random().toString(36).slice(2, 8).toUpperCase()}!`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        username:      email,
        password:      'NEXTAUTH_MANAGED',
        role,
        email,
        passwordHash,
        saasRole:      role as import('@prisma/client').Role,
        tenant:        { connect: { id: tenantId } },
        branch:        branchId ? { connect: { id: branchId } } : undefined,
        isActive:      true,
        firstName:     firstName?.trim() || null,
        lastName:      lastName?.trim() || null,
        contact:       contact?.trim() || null,
        dob:           dob ? new Date(dob) : null,
        ghanaCard:     ghanaCard?.trim() || null,
        residence:     residence?.trim() || null,
        canCreateUsers: role === 'MANAGER' ? !!canCreateUsers : false,
      },
    });

    await logAction(session.user.id, tenantId, 'USER_CREATED', {
      userId: user.id, email, role,
    });

    return NextResponse.json(
      { user: { id: user.id, email: user.email, role: user.saasRole }, tempPassword },
      { status: 201 },
    );
  } catch (err: unknown) {
    console.error('[POST /users] Error:', err);
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    // Surface Prisma unique constraint violations clearly
    if (message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
