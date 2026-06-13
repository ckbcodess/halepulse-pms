import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/requireRole';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { logAction } from '@/lib/audit/logAction';
import { appRoleLabel } from '@/lib/auth/roleHierarchy';

// GET — list the 4 role credentials for a branch
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenantId: string; branchId: string }> },
) {
  const auth = await requireRole(['SUPER_ADMIN']);
  if (auth instanceof NextResponse) return auth;

  const { tenantId, branchId } = await params;

  const credentials = await prisma.user.findMany({
    where: { tenantId, branchId, isRoleCredential: true },
    orderBy: { role: 'asc' },
    select: { id: true, credentialCode: true, role: true },
  });

  return NextResponse.json({
    credentials: credentials.map((c) => ({
      userId: c.id,
      credentialCode: c.credentialCode,
      role: c.role,
      roleName: appRoleLabel(c.role),
    })),
  });
}

// POST — reset the password for a single role credential
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; branchId: string }> },
) {
  const auth = await requireRole(['SUPER_ADMIN']);
  if (auth instanceof NextResponse) return auth;

  const { tenantId, branchId } = await params;
  const body = await request.json();
  const userId = parseInt(body.userId, 10);
  if (isNaN(userId)) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });

  const credential = await prisma.user.findFirst({
    where: { id: userId, tenantId, branchId, isRoleCredential: true },
    select: { id: true, credentialCode: true, role: true },
  });
  if (!credential) return NextResponse.json({ error: 'Credential not found' }, { status: 404 });

  const slug = credential.credentialCode?.split('-').pop() ?? 'PWD';
  const newPassword = `${slug}${Math.random().toString(36).slice(2, 8).toUpperCase()}!`;
  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({ where: { id: userId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } });

  await logAction(String(auth.user.id), tenantId, 'CREDENTIAL_PASSWORD_RESET', {
    credentialCode: credential.credentialCode,
  });

  return NextResponse.json({ credentialCode: credential.credentialCode, password: newPassword });
}
