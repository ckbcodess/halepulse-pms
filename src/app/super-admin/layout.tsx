import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import SuperAdminSidebar from '@/components/layout/SuperAdminSidebar';

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session)                         redirect('/login');
  if (session.user.role !== 'SUPER_ADMIN') redirect('/');

  return (
    <div className="flex h-screen overflow-hidden bg-muted dark:bg-[#0a0a0c]">
      <SuperAdminSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white dark:bg-[#111113] border-b border-border dark:border-border flex items-center px-6 flex-shrink-0">
          <p className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest">
            Super Admin Console
          </p>
          <div className="ml-auto text-xs text-muted-foreground">{session.user.email}</div>
        </header>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
