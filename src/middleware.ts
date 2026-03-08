import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Always allow: NextAuth internals, login page, static assets ──────────
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/login') ||
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

  // ── Super-admin route guard ───────────────────────────────────────────────
  if (pathname.startsWith('/super-admin')) {
    if (token.role !== 'SUPER_ADMIN') {
      return new NextResponse(
        JSON.stringify({ error: 'Forbidden — SUPER_ADMIN role required' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return NextResponse.next();
  }

  // ── Allow super admin impersonation on dashboard routes ──────────────────
  if (token.role === 'SUPER_ADMIN' && pathname.startsWith('/dashboard')) {
    const impersonateCookie = request.cookies.get('sa_impersonate')?.value;
    if (impersonateCookie) {
      return NextResponse.next(); // allowed — impersonating a role
    }
    return NextResponse.redirect(new URL('/super-admin', request.url));
  }

  // ── Tenant-scoped route guard ────────────────────────────────────────────
  // Non-super-admin users must have a tenantId
  if (token.role !== 'SUPER_ADMIN' && !token.tenantId) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
