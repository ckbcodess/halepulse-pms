import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/requireRole';
import { logAction } from '@/lib/audit/logAction';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

/**
 * Stores the logo as a base64 data URI directly on Tenant.logoUrl.
 * Filesystem storage would be lost on redeploy in containerized/serverless
 * environments (no shared volume), so a data URI keeps this portable without
 * needing an external object store. Known limitation: large images bloat the
 * row — mitigated by the 2MB cap above.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  let session: Awaited<ReturnType<typeof requireRole>>;
  try { session = await requireRole(['SUPER_ADMIN']); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { tenantId } = await params;

  const form = await req.formData();
  const file = form.get('logo');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No logo file provided' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `Unsupported image type: ${file.type}` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image too large (max 2MB)' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dataUri = `data:${file.type};base64,${buffer.toString('base64')}`;

  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data:  { logoUrl: dataUri },
  });

  await logAction(session.user.id, tenantId, 'BRANDING_LOGO_UPDATED', { tenantId });

  return NextResponse.json({ logoUrl: tenant.logoUrl });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  let session: Awaited<ReturnType<typeof requireRole>>;
  try { session = await requireRole(['SUPER_ADMIN']); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { tenantId } = await params;

  await prisma.tenant.update({ where: { id: tenantId }, data: { logoUrl: null } });
  await logAction(session.user.id, tenantId, 'BRANDING_LOGO_REMOVED', { tenantId });

  return NextResponse.json({ logoUrl: null });
}
