import { getTenantContext, TenantContext } from './getTenantContext';

/**
 * Checks that the current user has one of the required roles.
 * Returns the tenant context on success; throws 403-style error on failure.
 *
 * Accepted role values match the `role` field in the session:
 *   'SUPER_ADMIN' | 'MANAGER' | 'MCA' | 'NES'
 *
 * For inventory module mapping:
 *   Manager    → 'MANAGER' (or 'SUPER_ADMIN')
 *   Pharmacist → 'MCA'
 *   Stock Clerk → 'NES'
 */
export async function checkRole(
  ...allowedRoles: string[]
): Promise<TenantContext> {
  const ctx = await getTenantContext();

  // SUPER_ADMIN always has access
  if (ctx.role === 'SUPER_ADMIN') return ctx;

  if (!allowedRoles.includes(ctx.role)) {
    throw new Error('Forbidden');
  }

  return ctx;
}
