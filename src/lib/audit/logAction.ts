import prisma from '@/lib/prisma';

/**
 * Writes an audit log entry.
 * Call in every sensitive API route: login, permission change, user creation, etc.
 *
 * @param userId    The user's id (Int cast to string for legacy users)
 * @param tenantId  The tenant context (null for super admin)
 * @param action    Short action label e.g. "USER_LOGIN", "PERMISSION_UPDATED"
 * @param metadata  Any extra context — will be JSON-serialised
 * @param ipAddress The request IP (pass from req.headers or middleware)
 */
export async function logAction(
  userId:    string,
  tenantId:  string | null | undefined,
  action:    string,
  metadata?: Record<string, unknown>,
  ipAddress?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        tenantId:  tenantId ?? null,
        action,
        metadata:  metadata ? JSON.stringify(metadata) : null,
        ipAddress: ipAddress ?? null,
      },
    });
  } catch (err) {
    // Never let audit logging failures crash the main operation
    console.error('[AuditLog] Failed to write:', err);
  }
}
