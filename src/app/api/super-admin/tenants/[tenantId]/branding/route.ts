import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/requireRole';
import { logAction } from '@/lib/audit/logAction';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  let session: Awaited<ReturnType<typeof requireRole>>;
  try { session = await requireRole(['SUPER_ADMIN']); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { tenantId } = await params;

  let body: { name?: string; primaryColor?: string; secondaryColor?: string; baseColor?: string; logoUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, primaryColor, secondaryColor, baseColor, logoUrl } = body;

  // When baseColor is provided, sync it to primaryColor for backward compat
  const effectivePrimary = baseColor || primaryColor;

  let tenant;
  try {
    tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data:  {
        name,
        primaryColor: effectivePrimary,
        secondaryColor,
        baseColor: baseColor || null,
        logoUrl: logoUrl || null,
      },
    });
  } catch (err) {
    console.error('[branding PUT] Prisma error:', err);
    return NextResponse.json(
      { error: 'Database error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  await logAction(session.user.id, tenantId, 'BRANDING_UPDATED', {
    baseColor: baseColor || effectivePrimary,
    primaryColor: effectivePrimary,
    secondaryColor,
  });

  // Write a long-lived cookie so the root layout can inject the brand color
  // without hitting the DB on every request. Cookie is per-tenant so multiple
  // tenant previews don't conflict.
  const color = baseColor || effectivePrimary || '#6366f1';
  const res = NextResponse.json(tenant);
  res.cookies.set(`hp_brand_${tenantId}`, color, {
    path:     '/',
    maxAge:   60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
    httpOnly: false, // readable client-side too for immediate live preview
  });
  return res;
}
