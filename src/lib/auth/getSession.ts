import { getServerSession } from 'next-auth';
import { authOptions } from './authOptions';

/**
 * Returns the current session from the JWT.
 * Works in both Server Components and API Routes.
 */
export async function getSession() {
  return getServerSession(authOptions);
}
