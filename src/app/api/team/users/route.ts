import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Role } from '@prisma/client';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { logAction } from '@/lib/audit/logAction';
import bcrypt from 'bcryptjs';

const ALLOWED_ROLES = ['PHARMACIST', 'MCA', 'AUDIT'];

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let pwd = '';
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantContext();

    // Only managers with canCreateUsers permission can use this route
    if (ctx.role !== 'MANAGER' && ctx.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // For managers, verify canCreateUsers flag
    if (ctx.role === 'MANAGER') {
      const manager = await prisma.user.findUnique({
        where: { id: Number(ctx.userId) },
        select: { canCreateUsers: true },
      });
      if (!manager?.canCreateUsers) {
        return NextResponse.json({ error: 'You do not have permission to create users' }, { status: 403 });
      }
    }

    const body = await request.json();
    const { firstName, lastName, email, contact, dob, ghanaCard, residence, role } = body;

    if (!firstName || !lastName || !email || !role) {
      return NextResponse.json({ error: 'First name, last name, email and role are required' }, { status: 400 });
    }

    // Managers can only create PHM, MCA, AUDIT
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'You can only create Pharmacist, MCA, or Audit roles' }, { status: 403 });
    }

    // Check email uniqueness within tenant
    const existing = await prisma.user.findFirst({
      where: { email, tenantId: ctx.tenantId },
    });
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
    }

    const tempPassword = generatePassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email:              email as string,
        username:           email as string,
        contact:            contact ?? null,
        dob:                dob ? new Date(dob) : null,
        ghanaCard:          ghanaCard ?? null,
        residence:          residence ?? null,
        role:               role as Role,
        saasRole:           role as Role,
        password:           'NEXTAUTH_MANAGED',
        passwordHash,
        branch:             ctx.branchId ? { connect: { id: ctx.branchId } } : undefined,
        tenant:             ctx.tenantId ? { connect: { id: ctx.tenantId } } : undefined,
        isActive:           true,
        mustChangePassword: true,
        canCreateUsers:     false,
      } as any,
    });

    await logAction(ctx.userId, ctx.tenantId, 'USER_CREATED', {
      createdBy: ctx.userId,
      newUserId: user.id,
      role,
      firstName,
      lastName,
    });

    return NextResponse.json({
      user: {
        id:        user.id,
        firstName: user.firstName,
        lastName:  user.lastName,
        email:     user.email,
        role:      user.role,
      },
      tempPassword,
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message?.startsWith('No tenant')) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Create team user error:', err);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
