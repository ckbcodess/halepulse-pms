import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { getImpersonation } from '@/lib/auth/getImpersonation';
import prisma from '@/lib/prisma';

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const impersonation = await getImpersonation();

  // Only MANAGER (or super admin impersonating) can update settings
  const role = session.user.role;
  if (role !== 'MANAGER' && role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tenantId = impersonation?.tenantId ?? session.user.tenantId ?? null;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  try {
    const body = await request.json();
    const {
      name, legalName, address, primaryPhone,
      primaryEmail, primaryContact, licenceNumber, taxVatNumber,
    } = body;

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(name           ? { name }           : {}),
        ...(legalName      !== undefined ? { legalName: legalName || null }           : {}),
        ...(address        !== undefined ? { address: address || null }               : {}),
        ...(primaryPhone   !== undefined ? { primaryPhone: primaryPhone || null }     : {}),
        ...(primaryEmail   !== undefined ? { primaryEmail: primaryEmail || null }     : {}),
        ...(primaryContact !== undefined ? { primaryContact: primaryContact || null } : {}),
        ...(licenceNumber  !== undefined ? { licenceNumber: licenceNumber || null }   : {}),
        ...(taxVatNumber   !== undefined ? { taxVatNumber: taxVatNumber || null }     : {}),
      },
    });

    return NextResponse.json({ tenant: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
