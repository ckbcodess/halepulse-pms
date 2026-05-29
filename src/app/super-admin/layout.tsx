import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import SuperAdminShell from '@/components/layout/SuperAdminShell';

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session)                         redirect('/login');
  if (session.user.role !== 'SUPER_ADMIN') redirect('/');

  return (
    <SuperAdminShell email={session.user.email}>
      {children}
    </SuperAdminShell>
  );
}
