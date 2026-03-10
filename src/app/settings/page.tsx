import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { getImpersonation } from '@/lib/auth/getImpersonation';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import SettingsView from './SettingsView';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const impersonation = await getImpersonation();
  const tenantId = impersonation?.tenantId ?? session.user.tenantId ?? null;

  if (!tenantId) redirect('/');

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      subdomain: true,
      primaryColor: true,
      secondaryColor: true,
      logoUrl: true,
      address: true,
      primaryPhone: true,
      primaryEmail: true,
      primaryContact: true,
      legalName: true,
      licenceNumber: true,
      taxVatNumber: true,
      businessId: true,
      subscriptionTier: true,
    },
  });

  if (!tenant) redirect('/');

  const isManager = session.user.role === 'MANAGER' || !!impersonation;

  return <SettingsView tenant={tenant} canEdit={isManager} />;
}
