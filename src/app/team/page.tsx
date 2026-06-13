import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { redirect } from 'next/navigation';
import TeamView from './TeamView';

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const role = session.user.role;
  const isManager = role === 'MANAGER' || role === 'SUPER_ADMIN' || role === 'tenant_admin' || role === 'branch_manager';
  if (!isManager) redirect('/');

  return <TeamView />;
}
