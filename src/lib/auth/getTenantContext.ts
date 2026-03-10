import { getServerSession } from 'next-auth';
import { authOptions } from './authOptions';
import { getImpersonation } from './getImpersonation';

export interface TenantContext {
  tenantId: string;
  userId:   string;
  role:     string;
}

/**
 * Returns the effective tenant context for the current request.
 *
 * Resolution order:
 *   1. Super-admin impersonation cookie (overrides session)
 *   2. Session user's own tenantId
 *
 * Throws if:
 *   - No session exists (unauthenticated)
 *   - Non-SUPER_ADMIN user has no tenantId (broken state)
 *
 * SUPER_ADMIN without impersonation returns null tenantId — callers
 * must handle that case explicitly if needed.
 */
export async function getTenantContext(): Promise<TenantContext> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('Unauthorized');

  const impersonation = await getImpersonation();

  const tenantId = impersonation?.tenantId ?? session.user.tenantId ?? null;
  const role     = impersonation?.role     ?? session.user.role;
  const userId   = session.user.id;

  // Non-SA users MUST have a tenantId — if missing, something is broken
  if (!tenantId && role !== 'SUPER_ADMIN') {
    throw new Error('No tenant context');
  }

  // SA without impersonation — no tenant context, callers should guard
  if (!tenantId) {
    throw new Error('No tenant context — use impersonation to view tenant data');
  }

  return { tenantId, userId, role };
}
