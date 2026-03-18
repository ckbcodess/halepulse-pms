import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import prisma from '@/lib/prisma';

export async function POST() {
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'Session expired' }, { status: 401 });
  }
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  await prisma.user.update({
    where: { id: Number(session.user.id) },
    data: { lastActiveAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
