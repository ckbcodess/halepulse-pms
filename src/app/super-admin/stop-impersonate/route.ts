import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const cookieStore = await cookies();
  cookieStore.delete('sa_impersonate');

  return NextResponse.redirect(new URL('/super-admin', req.url));
}
