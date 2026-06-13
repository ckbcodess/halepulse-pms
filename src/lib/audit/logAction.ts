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
 * @param oldValue  Optional: previous state snapshot (stored as JSON)
 * @param newValue  Optional: new state snapshot (stored as JSON)
 */
export async function logAction(
  userId:    string,
  tenantId:  string | null | undefined,
  action:    string,
  metadata?: Record<string, unknown>,
  ipAddress?: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        tenantId:  tenantId ?? null,
        action,
        metadata:  metadata ? JSON.stringify(metadata) : null,
        ipAddress: ipAddress ?? null,
        oldValue:  oldValue ? (oldValue as any) : undefined,
        newValue:  newValue ? (newValue as any) : undefined,
      },
    });
  } catch (err) {
    // Never let audit logging failures crash the main operation
    console.error('[AuditLog] Failed to write:', err);
  }
}
