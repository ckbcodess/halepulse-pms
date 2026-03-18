import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';

const ROLE_DASHBOARD: Record<string, string> = {
  MANAGER: '/dashboard/manager',
  MCA:     '/dashboard/mca',
  NES:     '/dashboard/nes',
};

export default async function RootPage() {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/login');

  if (session.user.role === 'SUPER_ADMIN') {
    redirect('/super-admin');
  }

  const dest = ROLE_DASHBOARD[session.user.role] ?? '/dashboard/manager';
  redirect(dest);
}
