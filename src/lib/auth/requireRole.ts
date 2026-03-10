import { getSession } from './getSession';
import type { Session } from 'next-auth';

/**
 * Asserts that the current user has one of the allowed roles (by slug or legacy string)
 * OR has a role at or above the required hierarchy level.
 *
 * Usage:
 *   await requireRole(['SUPER_ADMIN', 'MANAGER']);           // Legacy: check role strings
 *   await requireRole(['super_admin', 'business_admin']);    // Dynamic: check role slugs
 *   await requireRole({ minLevel: 1 });                     // Level-based: 0=SA, 1=BA, 2=Mgr, 3=Viewer
 */
export async function requireRole(arg: string[] | { minLevel: number }): Promise<Session> {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('UNAUTHORIZED');
  }

  if (Array.isArray(arg)) {
    // Check against both legacy role string and dynamic role slug
    const { role, dynamicRoleSlug } = session.user;
    const hasAccess =
      arg.includes(role) ||
      (dynamicRoleSlug && arg.includes(dynamicRoleSlug));

    if (!hasAccess) {
      throw new Error('FORBIDDEN');
    }
  } else {
    // Level-based check: lower number = higher privilege
    // roleLevel of 0 (Super Admin) passes any minLevel check
    if (session.user.roleLevel > arg.minLevel) {
      throw new Error('FORBIDDEN');
    }
  }

  return session;
}
