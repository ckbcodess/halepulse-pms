import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { getImpersonation } from '@/lib/auth/getImpersonation';
import ImpersonationBanner from '@/components/layout/ImpersonationBanner';

/**
 * Dashboard layout — guards all /dashboard/* routes.
 * Super admins are redirected to /super-admin UNLESS they are impersonating a role.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/login');

  // Allow super admin through if impersonating
  if (session.user.role === 'SUPER_ADMIN') {
    const impersonation = await getImpersonation();
    if (!impersonation) redirect('/super-admin');

    return (
      <>
        <ImpersonationBanner />
        <div className="pt-10">{children}</div>
      </>
    );
  }

  return <>{children}</>;
}
