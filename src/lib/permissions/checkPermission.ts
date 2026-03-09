import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';
import { getBothKeys } from './permissionMap';

/**
 * Checks whether the current user has the given permission key.
 *
 * Resolution order:
 *   1. Super Admin (level 0 or role === SUPER_ADMIN) → always true
 *   2. DynamicRolePermission lookup (if user has dynamicRoleId)
 *   3. Legacy RolePermission lookup (fallback for unmigrated users)
 *
 * Accepts both legacy flat keys ("view_inventory") and new dot-notation keys
 * ("inventory.stock.view") — both variants are checked automatically.
 */
export async function checkPermission(permissionKey: string): Promise<boolean> {
  const session = await getSession();
  if (!session?.user) return false;

  const { role, tenantId, dynamicRoleId, roleLevel } = session.user;

  // Super admin bypasses all permission checks
  if (role === 'SUPER_ADMIN' || roleLevel === 0) return true;

  if (!tenantId) return false;

  // Get both legacy and new key variants for the permission
  const keyVariants = getBothKeys(permissionKey);

  // Strategy 1: Dynamic role permission (preferred)
  if (dynamicRoleId) {
    const dynamicRecord = await prisma.dynamicRolePermission.findFirst({
      where: {
        dynamicRoleId,
        permissionKey: { in: keyVariants },
      },
    });
    if (dynamicRecord) return true;
  }

  // Strategy 2: Legacy role permission (fallback)
  const legacyRecord = await prisma.rolePermission.findFirst({
    where: {
      tenantId,
      role: role as any,
      permissionKey: { in: keyVariants },
    },
  });

  return legacyRecord !== null;
}

/**
 * Variant that accepts explicit user details — for use in API routes where
 * the session is already resolved.
 */
export async function checkPermissionForUser(
  userId: string,
  tenantId: string,
  role: string,
  permissionKey: string,
  dynamicRoleId?: string | null,
  roleLevel?: number,
): Promise<boolean> {
  // Super admin bypass
  if (role === 'SUPER_ADMIN' || roleLevel === 0) return true;

  const keyVariants = getBothKeys(permissionKey);

  // Strategy 1: Dynamic role permission
  if (dynamicRoleId) {
    const dynamicRecord = await prisma.dynamicRolePermission.findFirst({
      where: {
        dynamicRoleId,
        permissionKey: { in: keyVariants },
      },
    });
    if (dynamicRecord) return true;
  }

  // Strategy 2: Legacy fallback
  const legacyRecord = await prisma.rolePermission.findFirst({
    where: {
      tenantId,
      role: role as any,
      permissionKey: { in: keyVariants },
    },
  });

  return legacyRecord !== null;
}
