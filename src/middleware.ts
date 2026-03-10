import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Always allow: NextAuth internals, login pages, static assets ──────────
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/sp-login') ||
    pathname.startsWith('/change-password') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico')
  ) {
    return NextResponse.next();
  }

  // ── Validate JWT session ──────────────────────────────────────────────────
  const token = await getToken({
    req:    request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ── Force password change ──────────────────────────────────────────────────
  if (token.mustChangePassword && !pathname.startsWith('/api/auth')) {
    return NextResponse.redirect(new URL('/change-password', request.url));
  }

  // ── Super-admin route guard ───────────────────────────────────────────────
  // Check both legacy role string AND new roleLevel
  if (pathname.startsWith('/super-admin')) {
    const isSuperAdmin = token.role === 'SUPER_ADMIN' || token.roleLevel === 0;
    if (!isSuperAdmin) {
      return new NextResponse(
        JSON.stringify({ error: 'Forbidden — Super Admin required' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return NextResponse.next();
  }

  // ── Allow super admin impersonation on dashboard routes ──────────────────
  const isSuperAdmin = token.role === 'SUPER_ADMIN' || token.roleLevel === 0;
  if (isSuperAdmin && pathname.startsWith('/dashboard')) {
    const impersonateCookie = request.cookies.get('sa_impersonate')?.value;
    if (impersonateCookie) {
      return NextResponse.next(); // allowed — impersonating a role
    }
    return NextResponse.redirect(new URL('/super-admin', request.url));
  }

  // ── Tenant-scoped route guard ────────────────────────────────────────────
  // Non-super-admin users must have a tenantId
  if (!isSuperAdmin && !token.tenantId) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
