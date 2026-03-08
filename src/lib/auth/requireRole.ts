import { getSession } from './getSession';

/**
 * Asserts that the current user has one of the allowed roles.
 * Throws if unauthenticated or role not in allowed list.
 */
export async function requireRole(allowedRoles: string[]) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('UNAUTHORIZED');
  }
  if (!allowedRoles.includes(session.user.role)) {
    throw new Error('FORBIDDEN');
  }
  return session;
}
