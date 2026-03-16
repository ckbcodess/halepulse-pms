import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from './authOptions';
import { verifyImpersonation } from './impersonationToken';

/**
 * Returns impersonation context if a SUPER_ADMIN is impersonating a role.
 * Verifies the HMAC signature on the cookie — rejects tampered values.
 * Returns null if not impersonating or if the cookie is invalid.
 */
export async function getImpersonation(): Promise<{ tenantId: string; role: string } | null> {
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    return null;
  }
  if (!session || session.user.role !== 'SUPER_ADMIN') return null;

  const cookieStore = await cookies();
  const raw = cookieStore.get('sa_impersonate')?.value;
  if (!raw) return null;

  // verifyImpersonation checks HMAC signature — returns null if tampered
  return verifyImpersonation(raw);
}
