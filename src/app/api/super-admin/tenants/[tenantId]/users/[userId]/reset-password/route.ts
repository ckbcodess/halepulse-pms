import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireRole } from '@/lib/auth/requireRole';
import { logAction } from '@/lib/audit/logAction';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; userId: string }> },
) {
  let session: Awaited<ReturnType<typeof requireRole>>;
  try { session = await requireRole(['SUPER_ADMIN']); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tenantId, userId } = await params;
  const userIdNum = parseInt(userId, 10);

  const user = await prisma.user.findFirst({
    where: { id: userIdNum, tenantId },
    select: { id: true, email: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const tempPassword = `Rst${Math.random().toString(36).slice(2, 8).toUpperCase()}!`;
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  await prisma.user.update({
    where: { id: userIdNum },
    data: { passwordHash, mustChangePassword: true },
  });

  await logAction(
    String(session.user.id),
    tenantId,
    'PASSWORD_RESET',
    { userId: userIdNum, email: user.email },
  );

  return NextResponse.json({ tempPassword });
}
