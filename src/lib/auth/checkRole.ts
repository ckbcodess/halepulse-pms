import { getTenantContext, TenantContext } from './getTenantContext';

/**
 * Checks that the current user has one of the required roles.
 * Returns the tenant context on success; throws 403-style error on failure.
 *
 * Accepts EITHER legacy role strings or canonical hierarchy slugs, so callers
 * can migrate gradually:
 *   legacy:    'SUPER_ADMIN' | 'MANAGER' | 'MCA' | 'NES'
 *   canonical: 'tenant_admin' | 'branch_manager' | 'pharmacist' | 'cashier'
 *
 * super_admin (level 0) always passes.
 */
export async function checkRole(
  ...allowedRoles: string[]
): Promise<TenantContext> {
  const ctx = await getTenantContext();

  // super_admin always has access (legacy string or level 0)
  if (ctx.role === 'SUPER_ADMIN' || ctx.roleLevel === 0) return ctx;

  const matches =
    allowedRoles.includes(ctx.role) ||
    (ctx.dynamicRoleSlug !== null && allowedRoles.includes(ctx.dynamicRoleSlug));

  if (!matches) {
    throw new Error('Forbidden');
  }

  return ctx;
}
