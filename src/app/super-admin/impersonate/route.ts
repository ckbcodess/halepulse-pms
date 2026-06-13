import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { cookies } from 'next/headers';
import { signImpersonation } from '@/lib/auth/impersonationToken';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL('/super-admin', req.url));
  }

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get('tenantId');
  const role     = searchParams.get('role');

  if (!tenantId || !role || !['MANAGER', 'PHARMACIST', 'MCA', 'AUDIT', 'NES'].includes(role)) {
    return NextResponse.redirect(new URL('/super-admin', req.url));
  }

  // Sign the impersonation payload with HMAC-SHA256 — prevents cookie tampering
  const signedToken = signImpersonation({ tenantId, role });

  const cookieStore = await cookies();
  cookieStore.set('sa_impersonate', signedToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   3600,
    path:     '/',
  });

  const dashboardPath = `/dashboard/${role.toLowerCase()}`;
  return NextResponse.redirect(new URL(dashboardPath, req.url));
}
