import { getSession } from './getSession';

/**
 * Asserts that a valid session exists.
 * Throws if unauthenticated. Use in API Routes and Server Actions.
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}
