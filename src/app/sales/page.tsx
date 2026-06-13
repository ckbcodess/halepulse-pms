import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { redirect } from 'next/navigation';
import SalesView from './SalesView';

export default async function SalesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <SalesView />;
}
