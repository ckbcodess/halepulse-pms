import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from './authOptions';

/**
 * Returns impersonation context if a SUPER_ADMIN is impersonating a role.
 * Returns null if not impersonating.
 */
export async function getImpersonation(): Promise<{ tenantId: string; role: string } | null> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'SUPER_ADMIN') return null;

  const cookieStore = await cookies();
  const raw = cookieStore.get('sa_impersonate')?.value;
  if (!raw) return null;

  try {
    const { tenantId, role } = JSON.parse(raw);
    if (tenantId && role) return { tenantId, role };
  } catch {}
  return null;
}
