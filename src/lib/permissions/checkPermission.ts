import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';

/**
 * Checks whether the current user's role has the given permission key
 * within their tenant's RolePermission configuration.
 *
 * SUPER_ADMIN always returns true (bypasses permission checks).
 */
export async function checkPermission(permissionKey: string): Promise<boolean> {
  const session = await getSession();
  if (!session?.user) return false;

  const { role, tenantId } = session.user;

  // Super admin bypasses all permission checks
  if (role === 'SUPER_ADMIN') return true;

  if (!tenantId) return false;

  const record = await prisma.rolePermission.findUnique({
    where: {
      tenantId_role_permissionKey: {
        tenantId,
        role:          role as any,
        permissionKey,
      },
    },
  });

  return record !== null;
}

/**
 * Variant that accepts explicit userId — for use in API routes where
 * the session is already resolved.
 */
export async function checkPermissionForUser(
  userId: string,
  tenantId: string,
  role: string,
  permissionKey: string,
): Promise<boolean> {
  if (role === 'SUPER_ADMIN') return true;

  const record = await prisma.rolePermission.findUnique({
    where: {
      tenantId_role_permissionKey: {
        tenantId,
        role:          role as any,
        permissionKey,
      },
    },
  });

  return record !== null;
}
